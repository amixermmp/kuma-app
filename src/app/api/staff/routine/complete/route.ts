import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { recalcNeverDoneRoutines } from '@/lib/routines'
import { logStaffAction } from '@/lib/log'
import { odometerLowerError } from '@/lib/odometerCheck'
import { ENGINE_TASK, GEAR_TASK, GEAR_CEILING_DAYS, addDaysIso, initialCycleCount } from '@/lib/routineCycle'

// ค่าเริ่มต้นวันเช่าสะสม — ใช้ตอนรูทีนนี้ยังไม่เคยตั้งค่านี้มาก่อน (เพิ่งย้ายมาระบบใหม่รอบแรก)
// เจ้าของแก้ต่อบัตรได้ทีหลังผ่านหน้าแก้ไขรถ ค่านี้จะไม่ทับของที่ตั้งไว้แล้ว
const DEFAULT_INTERVAL_RENTED_DAYS: Record<string, number> = {
  'เปลี่ยนน้ำมันเครื่อง': 30,
  'เปลี่ยนน้ำมันเฟืองท้าย': 90,
}

// กันกดบันทึกซ้ำของรถที่ใช้ตัวนับรอบ — ตัวนับเพิ่มซ้ำแล้วรอบจะเพี้ยน (ฝั่งหน้าเว็บกันแค่ปุ่ม ไม่กันเน็ตสะดุดแล้วส่งซ้ำ)
const DUPLICATE_WINDOW_MS = 15_000

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    routineId, bikeId, doneKm, shop, cost, receiptUrl, intervalKm, intervalDays, oilType, usedShopOil,
    alsoGear, gearUsedShopOil,
  } = await request.json()
  if (!routineId) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  if (oilType && usedShopOil == null) return NextResponse.json({ error: 'กรุณาเลือกว่าใช้น้ำมันร้านหรือไม่' }, { status: 400 })

  const supabase = createAdminClient()

  // ไมล์ตอนทำรูทีนต้องไม่ต่ำกว่าไมล์รถในระบบ — เลขนี้เขียนทับไมล์รถ ถ้าพิมพ์หลักหายรูทีนทุกอันของรถเพี้ยน
  if (doneKm && bikeId) {
    const { data: bikeRow } = await supabase.from('bikes').select('odometer').eq('id', bikeId).single()
    const lowerErr = odometerLowerError(Number(doneKm), bikeRow?.odometer)
    if (lowerErr) return NextResponse.json({ error: lowerErr }, { status: 400 })
  }

  // สต๊อกน้ำมันร้านของสาขาที่รถผูกอยู่ (ไม่มีแถว = 0)
  const getShopStock = async (type: string) => {
    if (!bikeId) return null
    const { data: stockBike } = await supabase.from('bikes').select('branch_id').eq('id', bikeId).single()
    if (!stockBike?.branch_id) return null
    const { data: stockCheck } = await supabase
      .from('branch_oil_stock')
      .select('quantity')
      .eq('branch_id', stockBike.branch_id)
      .eq('oil_type', type)
      .maybeSingle()
    return stockCheck?.quantity ?? 0
  }

  // น้ำมันร้านหมดแล้วห้ามบันทึกว่าใช้น้ำมันร้าน — ไม่งั้นประวัติบอกว่าใช้ทั้งที่ไม่มีของ และสต๊อกค้างที่ 0 โดยไม่มีใครรู้
  if (oilType && usedShopOil === true && bikeId) {
    const qty = await getShopStock(oilType)
    if (qty != null && qty <= 0) {
      return NextResponse.json({ error: 'น้ำมันร้านของสาขานี้หมด (สต๊อก 0) — เลือก "ไม่ใช่" หรือทักหาพี่เจ้าของร้านให้เติมสต๊อกก่อน' }, { status: 409 })
    }
  }

  // เอาค่าปัจจุบันมาดูก่อน — ถ้ายังไม่เคยตั้ง interval_rented_days เลย (รอบแรกที่เข้าระบบใหม่) ค่อย seed ค่า default ให้
  const { data: currentRoutine } = await supabase
    .from('bike_routines')
    .select('task_name, bike_id, interval_rented_days, follows_engine, updated_at')
    .eq('id', routineId)
    .single()
  const taskNameNow = currentRoutine?.task_name ?? ''
  const routineBikeId: string | null = bikeId ?? currentRoutine?.bike_id ?? null

  // ── โหมดเฟืองท้ายตามรอบน้ำมันเครื่อง (เฉพาะรถที่เปิดโหมดนี้ — รถอื่นไม่เข้าเงื่อนไขเหล่านี้เลย ทำงานเหมือนเดิมทุกอย่าง) ──
  // gearRow = แถวเฟืองท้ายของรถคันนี้ ถ้าเปิดโหมดตามรอบ (ใช้ตอนทำน้ำมันเครื่อง)
  let gearRow: { id: string; engine_changes_since: number; interval_days: number | null; last_done_date: string | null } | null = null
  if (taskNameNow === ENGINE_TASK && routineBikeId) {
    const { data } = await supabase
      .from('bike_routines')
      .select('id, engine_changes_since, interval_days, last_done_date')
      .eq('bike_id', routineBikeId)
      .eq('task_name', GEAR_TASK)
      .eq('follows_engine', true)
      .maybeSingle()
    gearRow = data ?? null
  }
  const engineCycleMode = gearRow != null
  const gearFollowsEngine = taskNameNow === GEAR_TASK && currentRoutine?.follows_engine === true

  if (alsoGear && !engineCycleMode) {
    return NextResponse.json({ error: 'รถคันนี้ไม่ได้ใช้โหมดเฟืองท้ายตามรอบน้ำมันเครื่อง' }, { status: 400 })
  }
  const doGear = !!alsoGear && engineCycleMode
  if (doGear && gearUsedShopOil == null) {
    return NextResponse.json({ error: 'กรุณาเลือกว่าใช้น้ำมันเฟืองท้ายร้านหรือไม่' }, { status: 400 })
  }
  if (doGear && gearUsedShopOil === true) {
    const qty = await getShopStock('gear')
    if (qty != null && qty <= 0) {
      return NextResponse.json({ error: 'น้ำมันเฟืองท้ายร้านของสาขานี้หมด (สต๊อก 0) — เลือก "ไม่ใช่" หรือทักหาพี่เจ้าของร้านให้เติมสต๊อกก่อน' }, { status: 409 })
    }
  }

  if ((engineCycleMode || gearFollowsEngine) && currentRoutine?.updated_at
    && Date.now() - new Date(currentRoutine.updated_at).getTime() < DUPLICATE_WINDOW_MS) {
    return NextResponse.json({ error: 'เพิ่งบันทึกรายการนี้ไปเมื่อสักครู่ — ไม่ต้องกดซ้ำ ถ้าไม่แน่ใจให้รีเฟรชหน้าแล้วดูสถานะ' }, { status: 409 })
  }

  const intervalRentedDays = gearFollowsEngine
    ? null // เฟืองท้ายตามรอบน้ำมันเครื่อง ไม่นับวันเช่าสะสมของตัวเอง
    : currentRoutine?.interval_rented_days ?? DEFAULT_INTERVAL_RENTED_DAYS[taskNameNow] ?? null

  // Calculate next due
  const today = new Date().toISOString().split('T')[0]
  const nextDueKm = gearFollowsEngine ? null : (doneKm && intervalKm ? doneKm + intervalKm : null)
  const nextDueDate = gearFollowsEngine
    ? addDaysIso(today, intervalDays || GEAR_CEILING_DAYS)
    : intervalDays
      ? new Date(Date.now() + intervalDays * 86_400_000).toISOString().split('T')[0]
      : null

  // เฟืองท้ายเดี่ยว: เทียบวันที่ทำน้ำมันเครื่องล่าสุด → วันเดียวกันเริ่มรอบใหม่ที่ 0, คนละวันถือว่าเครื่องครั้งล่าสุดเป็นรอบที่ 1
  let gearStandaloneCount: number | null = null
  if (gearFollowsEngine && routineBikeId) {
    const { data: engineRow } = await supabase
      .from('bike_routines')
      .select('last_done_date')
      .eq('bike_id', routineBikeId)
      .eq('task_name', ENGINE_TASK)
      .maybeSingle()
    gearStandaloneCount = initialCycleCount(engineRow?.last_done_date ?? null, today)
  }

  const { error } = await supabase
    .from('bike_routines')
    .update({
      last_done_km: doneKm ?? null,
      last_done_date: today,
      next_due_km: nextDueKm,
      next_due_date: nextDueDate,
      interval_rented_days: intervalRentedDays,
      rented_days_accumulated: 0,
      last_cost: cost ?? null,
      receipt_url: receiptUrl ?? null,
      updated_at: new Date().toISOString(),
      ...(gearStandaloneCount != null ? { engine_changes_since: gearStandaloneCount } : {}),
    })
    .eq('id', routineId)

  if (error) {
    console.error('Routine complete error:', error.message)
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
  }

  // น้ำมันเครื่องของรถที่ใช้โหมดตามรอบ: ทำเฟืองท้ายพร้อมกัน (รีเซ็ตรอบเป็น 0) หรือนับรอบเพิ่ม 1
  if (gearRow) {
    const { error: gearErr } = await supabase
      .from('bike_routines')
      .update(doGear
        ? {
            last_done_km: doneKm ?? null,
            last_done_date: today,
            next_due_km: null,
            next_due_date: addDaysIso(today, gearRow.interval_days || GEAR_CEILING_DAYS),
            interval_rented_days: null,
            rented_days_accumulated: 0,
            engine_changes_since: 0,
            last_cost: null,
            receipt_url: receiptUrl ?? null,
            updated_at: new Date().toISOString(),
          }
        // เฟืองท้ายเพิ่งทำวันนี้ (พนักงานมักกดเฟืองท้ายก่อนแล้วบันทึกน้ำมันเครื่องตามมา) = รอบเดียวกัน นับ 0 ไม่ใช่ +1
        : { engine_changes_since: gearRow.last_done_date === today ? 0 : gearRow.engine_changes_since + 1 })
      .eq('id', gearRow.id)
    if (gearErr) {
      console.error('[routine/complete] gear cycle update failed:', JSON.stringify(gearErr))
      return NextResponse.json({ error: 'บันทึกน้ำมันเครื่องแล้ว แต่ปรับรอบเฟืองท้ายไม่สำเร็จ — ห้ามกดซ้ำ ทักหาพี่เจ้าของร้านให้ตรวจสอบ' }, { status: 500 })
    }
  }

  // Update bike odometer if provided
  if (doneKm && bikeId) {
    const { error: odoErr } = await supabase.from('bikes').update({ odometer: doneKm }).eq('id', bikeId)
    if (odoErr) console.error('[routine/complete] odometer update failed:', bikeId, JSON.stringify(odoErr))
    // รูทีนอื่นของรถคันนี้ที่ไม่เคยทำ อาจโดนเลขไมล์ใหม่ทำให้แจ้งเตือนผิด
    await recalcNeverDoneRoutines(supabase, bikeId, Number(doneKm))
  }

  const [{ data: bike }, { data: routineRow }] = await Promise.all([
    bikeId
      ? supabase.from('bikes').select('branch_id, license_plate').eq('id', bikeId).single()
      : Promise.resolve({ data: null }),
    supabase.from('bike_routines').select('task_name').eq('id', routineId).single(),
  ])
  const taskName = routineRow?.task_name ?? 'งานรูทีน'
  const plate = bike?.license_plate ?? ''

  // หักสต๊อกน้ำมันสาขา 1 ขวด — เฉพาะกรณีใช้น้ำมันร้าน (ไม่ต่ำกว่า 0 กันสต๊อกติดลบ)
  const deductShopOil = async (type: string) => {
    if (!bike?.branch_id) return
    const { data: stockRow } = await supabase
      .from('branch_oil_stock')
      .select('id, quantity')
      .eq('branch_id', bike.branch_id)
      .eq('oil_type', type)
      .maybeSingle()
    const newQuantity = Math.max(0, (stockRow?.quantity ?? 0) - 1)
    const { error: stockErr } = stockRow
      ? await supabase.from('branch_oil_stock').update({ quantity: newQuantity, updated_at: new Date().toISOString() }).eq('id', stockRow.id)
      : await supabase.from('branch_oil_stock').insert({ branch_id: bike.branch_id, oil_type: type, quantity: 0 })
    if (stockErr) console.error('[routine/complete] oil stock update failed:', JSON.stringify(stockErr))
  }
  if (oilType && usedShopOil === true) await deductShopOil(oilType)
  if (doGear && gearUsedShopOil === true) await deductShopOil('gear')

  // ลงบัญชีรายจ่าย — ค่าทำรูทีนเข้า Dashboard/Statement อัตโนมัติ (waive ได้ถ้าลงผิด)
  // รอบที่ทำเฟืองท้ายพร้อมกัน ค่าแรงช่องเดียวรวมทั้งสองงาน ระบุไว้ในคำอธิบาย
  if (cost && Number(cost) > 0 && bikeId) {
    const bkkToday = new Date(Date.now() + 7 * 3600_000).toISOString().split('T')[0]
    await supabase.from('expenses').insert({
      branch_id: bike?.branch_id ?? null,
      recorded_by: staffId,
      category: 'maintenance',
      description: `${taskName}${doGear ? ` + ${GEAR_TASK}` : ''} — ${plate}${shop ? ` (${shop})` : ''}`,
      amount: Number(cost),
      expense_date: bkkToday,
    })
  }

  await logStaffAction(staffId, 'routine_completed',
    `ทำรูทีนเสร็จ: ${taskName}${doGear ? ` + ${GEAR_TASK}` : ''} — ${plate}${doneKm ? ` ที่ ${Number(doneKm).toLocaleString()} กม.` : ''}${cost ? ` — ฿${Number(cost).toLocaleString()}` : ''}`,
    { routineId, bikeId, doneKm: doneKm ?? null, cost: cost ?? null, shop: shop ?? null, alsoGear: doGear })

  return NextResponse.json({ success: true })
}
