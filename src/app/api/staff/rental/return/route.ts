import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeLog } from '@/lib/log'
import { recalcNeverDoneRoutines, calcRoutineUrgency } from '@/lib/routines'
import { hasOpenContract } from '@/lib/availability'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    rentalId, bikeId,
    returnOdometer, returnFuelFull, returnFuelRefueledByCustomer,
    fuelFee, damageFee, damageNotes,
    returnPhotoUrl, refundAmount,
    finalRentAmount, overtimeCharge, earlyReturnRefund,
    newReturnType, newReturnAddress, newReturnFee,
  } = body

  if (!rentalId || !bikeId) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }
  if (!returnOdometer) {
    return NextResponse.json({ error: 'กรุณากรอกเลขไมล์ตอนรับคืน' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('rentals')
    .select('branch_id, customers(name, phone), bikes(license_plate, odometer)')
    .eq('id', rentalId)
    .single()

  // Close the rental — รูปตอนส่งรถเก็บไว้ 30 วันหลังคืน (ลบอัตโนมัติผ่าน cron ไม่ใช่ตอนนี้)
  const { error: rentalErr } = await supabase
    .from('rentals')
    .update({
      status: 'returned',
      actual_end_datetime: new Date().toISOString(),
      return_odometer: returnOdometer ?? null,
      return_fuel_full: returnFuelFull ?? null,
      return_fuel_refueled_by_customer: returnFuelRefueledByCustomer ?? null,
      fuel_fee: fuelFee ?? 0,
      damage_fee: damageFee ?? 0,
      damage_notes: damageNotes ?? null,
      return_photos: returnPhotoUrl ? [{ url: returnPhotoUrl, label: 'รูปรับคืน' }] : [],
      refund_amount: refundAmount,
      total_amount: finalRentAmount,
      // จุดคืนรถยังไม่ฟันธงตอนส่งรถ — ตัดสินใจจริงตอนนี้แทน (ถ้ายืนยันนอกสถานที่ไปแล้วตอนส่งรถ ไม่ต้องแตะ ไม่ส่ง newReturnType มา)
      ...(newReturnType !== undefined ? {
        return_type: newReturnType ?? null,
        return_address: newReturnType === 'offsite' ? (newReturnAddress || null) : null,
        return_fee: newReturnType === 'offsite' ? (newReturnFee || 0) : 0,
      } : {}),
    })
    .eq('id', rentalId)
    .in('status', ['active', 'extended'])

  if (rentalErr) {
    console.error('Return rental error:', rentalErr.message)
    return NextResponse.json({ error: 'บันทึกการคืนรถไม่สำเร็จ' }, { status: 500 })
  }

  // ลงสมุดรายรับ — ค่าล่วงเวลาเก็บตอนคืนรถ (หักจากมัดจำที่คืนลูกค้า)
  if (Number(overtimeCharge) > 0) {
    const { error: overtimeErr } = await supabase.from('rental_payments').insert({
      rental_id: rentalId,
      branch_id: existing?.branch_id ?? null,
      staff_id: staffId,
      kind: 'overtime',
      amount: Number(overtimeCharge),
    })
    if (overtimeErr) console.error('[rental/return] overtime payment insert failed:', rentalId, JSON.stringify(overtimeErr))
  }

  // คืนเงินค่าเช่าส่วนที่ไม่ได้ใช้ (คืนรถก่อนกำหนด) — ลงเป็นรายรับติดลบ ตามวันที่คืนจริง
  // เพื่อให้ยอดรายได้ (sum ของ rental_payments) หักลบถูกต้องตามเงินสดที่จ่ายคืนจริง
  if (Number(earlyReturnRefund) > 0) {
    const { error: refundErr } = await supabase.from('rental_payments').insert({
      rental_id: rentalId,
      branch_id: existing?.branch_id ?? null,
      staff_id: staffId,
      kind: 'early_return_refund',
      amount: -Number(earlyReturnRefund),
    })
    if (refundErr) console.error('[rental/return] early-return refund insert failed:', rentalId, JSON.stringify(refundErr))
  }

  // ค่าบริการรับคืนนอกสถานที่ — เพิ่งฟันธงตอนนี้ (ยังไม่เคยเก็บตอนส่งรถ) เก็บเป็นรายรับจริงตอนนี้เลย
  if (newReturnType === 'offsite' && Number(newReturnFee) > 0) {
    const { error: returnFeeErr } = await supabase.from('rental_payments').insert({
      rental_id: rentalId,
      branch_id: existing?.branch_id ?? null,
      staff_id: staffId,
      kind: 'return_fee',
      amount: Number(newReturnFee),
    })
    if (returnFeeErr) console.error('[rental/return] return fee payment insert failed:', rentalId, JSON.stringify(returnFeeErr))
  }

  // Set bike back to available — เว้นแต่รถมีสัญญาอื่นเปิดค้างอยู่แล้ว (เช่น ปิดสัญญานี้ช้า
  // หลังจากสัญญาใหม่บนคันเดียวกันเปิดไปแล้ว) กันสถานะ available ทับสัญญาที่ยังเปิดอยู่จริง
  const stillOpen = await hasOpenContract(supabase, bikeId, rentalId)
  // เต็ม+ลูกค้าเติมมายืนยันแล้ว = เชื่อว่าเต็มจริง — นอกนั้น (ไม่เต็ม หรือเต็มแต่ไม่ยืนยัน) = ยังต้องไปเติม
  // ถ้าตอนส่งไม่ได้บังคับเช็ค (returnFuelFull เป็น null) ไม่ต้องแตะสถานะน้ำมันของรถเลย
  const nextFuelLevel = returnFuelFull == null ? undefined : (returnFuelFull === true && returnFuelRefueledByCustomer === true ? 8 : 0)
  const { error: bikeUpdateErr } = await supabase
    .from('bikes')
    .update({
      ...(stillOpen ? {} : { status: 'available' }),
      ...(returnOdometer ? { odometer: returnOdometer } : {}),
      ...(nextFuelLevel !== undefined ? { fuel_level: nextFuelLevel } : {}),
    })
    .eq('id', bikeId)
  // เคยเงียบไม่เช็ค error ตรงนี้ — ถ้า update ล้มเหลว (constraint/network) รถจะค้างสถานะผิดแบบไม่มีร่องรอย
  // ให้ตามสาเหตุยาก log ไว้เผื่อเกิดซ้ำจะได้เห็นสาเหตุจริงใน Vercel logs
  if (bikeUpdateErr) {
    console.error('[rental/return] bike update failed:', bikeId, JSON.stringify(bikeUpdateErr))
  }

  if (returnOdometer) {
    await recalcNeverDoneRoutines(supabase, bikeId, Number(returnOdometer))
  }

  // เช็ครูทีนถึงกำหนดไหม ณ ตอนรับคืนนี้เลย — จังหวะที่รถอยู่ตรงหน้าพอดี กันลืมเช็คตอนเย็นเพราะรถถูกเช่าไปอีกก่อน
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingBike = Array.isArray(existing?.bikes) ? existing.bikes[0] : existing?.bikes as any
  const currentOdometer = returnOdometer ? Number(returnOdometer) : (existingBike?.odometer ?? 0)
  const { data: routines } = await supabase
    .from('bike_routines')
    .select('id, task_name, next_due_km, next_due_date, interval_rented_days, rented_days_accumulated')
    .eq('bike_id', bikeId)
  const routineDue = (routines ?? [])
    .map(r => ({ ...r, ...calcRoutineUrgency(r, currentOdometer) }))
    .filter(r => r.urgency === 'overdue')
    .map(r => ({ taskName: r.task_name, dueReason: r.due_reason }))

  // หมายเหตุ: "วันเช่าสะสม" ของรูทีนนับทีละ 1 วันทุกวันที่รถออกใช้งานจริงผ่าน cron รายวันแทนแล้ว
  // (เดิมบวกยกก้อนทั้งสัญญาตรงนี้ ทำให้นับซ้ำวันที่เกิดก่อนเปลี่ยนน้ำมันครั้งล่าสุดไปแล้ว)

  // Lookup staff name
  const { data: staffRow } = await supabase.from('staff').select('name').eq('id', staffId).single()
  const staffName = staffRow?.name ?? staffId
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customerName = (existing?.customers as any)?.name ?? 'ลูกค้า'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plate = (existing?.bikes as any)?.license_plate ?? ''

  // Log staff return
  await writeLog({
    actorType: 'staff',
    actorId: staffId,
    actorName: staffName,
    action: 'bike_returned',
    description: `รับรถคืน ${plate} — ลูกค้า ${customerName}${damageFee > 0 ? ` • ค่าเสียหาย ฿${damageFee}` : ''}${fuelFee > 0 ? ` • ค่าน้ำมัน ฿${fuelFee}` : ''}`,
    metadata: { rentalId, bikeId, damageFee, fuelFee, refundAmount },
  })

  return NextResponse.json({ success: true, routineDue })
}
