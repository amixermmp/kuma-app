import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { writeLog } from '@/lib/log'
import { ENGINE_TASK, GEAR_TASK, GEAR_CEILING_DAYS, planGearForNewBike, type GearChoice } from '@/lib/routineCycle'

export async function POST(request: NextRequest) {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    branch_id: BRANCH_ID,
    license_plate, brand, model, year, color,
    odometer, notes, photo_url,
    daily_rate, monthly_rate, deposit_amount, lessor_profile_id,
    docs, routines, gear,
  } = body

  if (!BRANCH_ID) return NextResponse.json({ error: 'Missing branch' }, { status: 400 })

  if (!license_plate || !brand || !model) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }
  // บังคับกรอกเลขไมล์ตั้งแต่ตอนเพิ่มรถเสมอ — กันรูทีน (เปลี่ยนน้ำมันเครื่องฯลฯ) ตั้งเป้าจากไมล์เดา (0) ที่ผิดจากไมล์จริงตั้งแต่ต้น
  if (odometer === undefined || odometer === null || odometer === '') {
    return NextResponse.json({ error: 'กรุณากรอกเลขไมล์เริ่มต้น' }, { status: 400 })
  }

  // เฟืองท้ายตามรอบน้ำมันเครื่อง — ตรวจก่อนสร้างรถ กันสร้างรถไปแล้วเฟืองท้ายไม่ครบ (ฟอร์มเก่าที่ไม่ส่ง gear มา ทำงานแบบเดิม)
  const today = new Date().toISOString().split('T')[0]
  const engineLastDone: string | null = Array.isArray(routines)
    ? (routines.find((r: { task_name?: string }) => r.task_name === ENGINE_TASK)?.last_done_date ?? null)
    : null
  const gearPlan = gear ? planGearForNewBike(gear as GearChoice, engineLastDone, today) : null
  if (gearPlan && !gearPlan.ok) return NextResponse.json({ error: gearPlan.error }, { status: 400 })

  const supabase = createAdminClient()

  // Create bike
  const { data: bike, error: bikeErr } = await supabase
    .from('bikes')
    .insert({
      branch_id: BRANCH_ID,
      license_plate,
      brand,
      model,
      year: year ?? null,
      color: color ?? null,
      odometer: odometer ?? 0,
      notes: notes ?? null,
      photo_url: photo_url ?? null,
      daily_rate: daily_rate ?? null,
      monthly_rate: monthly_rate ?? null,
      deposit_amount: deposit_amount ?? 0,
      lessor_profile_id: lessor_profile_id ?? null,
      status: 'available',
    })
    .select('id')
    .single()

  if (bikeErr || !bike) {
    console.error('Create bike error:', bikeErr?.message)
    if (bikeErr?.message?.includes('unique')) {
      return NextResponse.json({ error: `ทะเบียน ${license_plate} มีในระบบแล้ว` }, { status: 400 })
    }
    return NextResponse.json({ error: 'เพิ่มรถไม่สำเร็จ' }, { status: 500 })
  }

  const bikeId = bike.id

  await writeLog({
    actorType: 'owner',
    actorId: user.id,
    actorName: user.email ?? 'Owner',
    action: 'bike_created',
    description: `เพิ่มรถใหม่ ${license_plate} (${brand} ${model})${daily_rate ? ` — ฿${daily_rate}/วัน` : ' — ใช้ราคามาตรฐาน'}`,
    metadata: { bikeId, license_plate, brand, model },
  })

  // Create documents (only if has data)
  const docInserts = []
  if (docs?.registration?.photo_url) {
    docInserts.push({ bike_id: bikeId, doc_type: 'registration', doc_photo_url: docs.registration.photo_url })
  }
  if (docs?.tax?.photo_url || docs?.tax?.expiry_date) {
    docInserts.push({
      bike_id: bikeId, doc_type: 'tax',
      doc_photo_url: docs.tax.photo_url ?? null,
      expiry_date: docs.tax.expiry_date ?? null,
    })
  }
  if (docs?.pob?.photo_url || docs?.pob?.expiry_date) {
    docInserts.push({
      bike_id: bikeId, doc_type: 'pob',
      doc_photo_url: docs.pob.photo_url ?? null,
      expiry_date: docs.pob.expiry_date ?? null,
    })
  }
  if (docInserts.length > 0) {
    await supabase.from('bike_documents').insert(docInserts)
  }

  // Create routines (โหมดเฟืองท้ายตามรอบ: ไม่รับงานเฟืองท้ายจากรายการ — สร้างจากตัวเลือก gear ด้านล่างแทน)
  const routinesToCreate = Array.isArray(routines)
    ? routines.filter((r: { task_name?: string }) => !(gearPlan && r.task_name === GEAR_TASK))
    : []
  if (routinesToCreate.length > 0) {
    const routineInserts = routinesToCreate.map((r: {
      task_name: string; interval_km: number | null; interval_days: number | null; last_done_date: string | null
    }) => {
      const nextDueKm = r.interval_km ? (odometer ?? 0) + r.interval_km : null
      let nextDueDate: string | null = null
      if (r.interval_days) {
        const base = r.last_done_date ? new Date(r.last_done_date) : new Date()
        base.setDate(base.getDate() + r.interval_days)
        nextDueDate = base.toISOString().split('T')[0]
      }
      return {
        bike_id: bikeId,
        task_name: r.task_name,
        interval_km: r.interval_km ?? null,
        interval_days: r.interval_days ?? null,
        last_done_date: r.last_done_date ?? null,
        next_due_km: nextDueKm,
        next_due_date: nextDueDate,
      }
    })
    await supabase.from('bike_routines').insert(routineInserts)
  }

  if (gearPlan?.ok) {
    const { error: gearErr } = await supabase.from('bike_routines').insert({
      bike_id: bikeId,
      task_name: GEAR_TASK,
      interval_km: null,
      interval_days: GEAR_CEILING_DAYS,
      interval_rented_days: null,
      last_done_date: gearPlan.lastDoneDate,
      next_due_km: null,
      next_due_date: gearPlan.ceilingDate,
      follows_engine: true,
      engine_changes_since: gearPlan.count,
    })
    if (gearErr) console.error('[bikes/create] gear routine insert failed:', bikeId, JSON.stringify(gearErr))
  }

  return NextResponse.json({ bikeId })
}
