import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { recalcNeverDoneRoutines } from '@/lib/routines'
import { logStaffAction } from '@/lib/log'

// ค่าเริ่มต้นวันเช่าสะสม — ใช้ตอนรูทีนนี้ยังไม่เคยตั้งค่านี้มาก่อน (เพิ่งย้ายมาระบบใหม่รอบแรก)
// เจ้าของแก้ต่อบัตรได้ทีหลังผ่านหน้าแก้ไขรถ ค่านี้จะไม่ทับของที่ตั้งไว้แล้ว
const DEFAULT_INTERVAL_RENTED_DAYS: Record<string, number> = {
  'เปลี่ยนน้ำมันเครื่อง': 30,
  'เปลี่ยนน้ำมันเฟืองท้าย': 90,
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { routineId, bikeId, doneKm, shop, cost, receiptUrl, intervalKm, intervalDays, oilType, usedShopOil } = await request.json()
  if (!routineId) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  if (oilType && usedShopOil == null) return NextResponse.json({ error: 'กรุณาเลือกว่าใช้น้ำมันร้านหรือไม่' }, { status: 400 })

  const supabase = createAdminClient()

  // เอาค่าปัจจุบันมาดูก่อน — ถ้ายังไม่เคยตั้ง interval_rented_days เลย (รอบแรกที่เข้าระบบใหม่) ค่อย seed ค่า default ให้
  const { data: currentRoutine } = await supabase
    .from('bike_routines')
    .select('task_name, interval_rented_days')
    .eq('id', routineId)
    .single()
  const intervalRentedDays = currentRoutine?.interval_rented_days
    ?? DEFAULT_INTERVAL_RENTED_DAYS[currentRoutine?.task_name ?? ''] ?? null

  // Calculate next due
  const today = new Date().toISOString().split('T')[0]
  const nextDueKm = doneKm && intervalKm ? doneKm + intervalKm : null
  const nextDueDate = intervalDays
    ? new Date(Date.now() + intervalDays * 86_400_000).toISOString().split('T')[0]
    : null

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
    })
    .eq('id', routineId)

  if (error) {
    console.error('Routine complete error:', error.message)
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
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
  if (oilType && usedShopOil === true && bike?.branch_id) {
    const { data: stockRow } = await supabase
      .from('branch_oil_stock')
      .select('id, quantity')
      .eq('branch_id', bike.branch_id)
      .eq('oil_type', oilType)
      .maybeSingle()
    const newQuantity = Math.max(0, (stockRow?.quantity ?? 0) - 1)
    const { error: stockErr } = stockRow
      ? await supabase.from('branch_oil_stock').update({ quantity: newQuantity, updated_at: new Date().toISOString() }).eq('id', stockRow.id)
      : await supabase.from('branch_oil_stock').insert({ branch_id: bike.branch_id, oil_type: oilType, quantity: 0 })
    if (stockErr) console.error('[routine/complete] oil stock update failed:', JSON.stringify(stockErr))
  }

  // ลงบัญชีรายจ่าย — ค่าทำรูทีนเข้า Dashboard/Statement อัตโนมัติ (waive ได้ถ้าลงผิด)
  if (cost && Number(cost) > 0 && bikeId) {
    const bkkToday = new Date(Date.now() + 7 * 3600_000).toISOString().split('T')[0]
    await supabase.from('expenses').insert({
      branch_id: bike?.branch_id ?? null,
      recorded_by: staffId,
      category: 'maintenance',
      description: `${taskName} — ${plate}${shop ? ` (${shop})` : ''}`,
      amount: Number(cost),
      expense_date: bkkToday,
    })
  }

  await logStaffAction(staffId, 'routine_completed',
    `ทำรูทีนเสร็จ: ${taskName} — ${plate}${doneKm ? ` ที่ ${Number(doneKm).toLocaleString()} กม.` : ''}${cost ? ` — ฿${Number(cost).toLocaleString()}` : ''}`,
    { routineId, bikeId, doneKm: doneKm ?? null, cost: cost ?? null, shop: shop ?? null })

  return NextResponse.json({ success: true })
}
