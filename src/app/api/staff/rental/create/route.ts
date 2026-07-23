import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeLog } from '@/lib/log'
import { getStaffOwnBranchId } from '@/lib/staffBranch'
import { hasOpenContract } from '@/lib/availability'
import { findModelBookingConflict } from '@/lib/bookingConflicts'
import { recalcNeverDoneRoutines } from '@/lib/routines'
import { checkBlacklist } from '@/lib/blacklist'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const BRANCH_ID = await getStaffOwnBranchId(staffId)
  const body = await request.json()
  const {
    bikeId, customer, startDatetime, endDatetime,
    dailyRate, totalDays, totalAmount, depositAmount,
    discount, paymentMethod, fuelLevel, odometer, photos, signature, lockBike,
    excludeBookingId, overrideBookingConflict,
  } = body

  if (!bikeId || !customer?.name || !customer?.phone || !startDatetime || !endDatetime) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }
  if (!customer?.idCardNumber) {
    return NextResponse.json({ error: 'กรุณากรอกเลขบัตรประชาชน/พาสปอร์ต' }, { status: 400 })
  }

  const REQUIRED_PHOTOS = ['id_card', 'selfie', 'with_bike', 'damage', 'payment']
  const missingPhotos = REQUIRED_PHOTOS.filter(k => !photos?.[k])
  if (missingPhotos.length > 0) {
    return NextResponse.json({ error: 'กรุณาอัปโหลดรูปภาพให้ครบ (บัตร, รูปถ่าย, รถ, ตำหนิ, ชำระเงิน)' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Guard: กันสัญญาซ้อน — รถที่ยังมีสัญญาค้าง (ยังไม่กดจบ) ห้ามส่งซ้ำ
  if (await hasOpenContract(supabase, bikeId)) {
    return NextResponse.json({ error: 'รถคันนี้ยังมีสัญญาค้างอยู่ (ยังไม่ได้กดจบสัญญา) — ปิดสัญญาเดิมก่อนจึงจะส่งรถได้' }, { status: 409 })
  }

  // กันส่งรถทับคิวจองของลูกค้าคนอื่นแบบไม่รู้ตัว (ไม่นับคิวที่กำลังจะปิดจากการส่งรถครั้งนี้เอง)
  let conflictQuery = supabase
    .from('bookings')
    .select('id, booking_ref, customer_name, start_datetime')
    .eq('bike_id', bikeId)
    .eq('status', 'confirmed')
    .lt('start_datetime', new Date(endDatetime).toISOString())
    .gt('end_datetime', new Date(startDatetime).toISOString())
  if (excludeBookingId) conflictQuery = conflictQuery.neq('id', excludeBookingId)
  const { data: conflictBookings } = await conflictQuery
  let conflict = (conflictBookings ?? [])[0]
  if (conflict && !overrideBookingConflict) {
    return NextResponse.json({
      error: `ส่งรถนี้จะไปชนคิวจอง ${conflict.booking_ref} (คุณ${conflict.customer_name} รับรถ ${new Date(conflict.start_datetime).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}) — ใช้ Fast lane เพื่อยืนยันทำต่อได้ (คิวนั้นจะยังไม่ถูกยกเลิก จะไปโผล่ในคิวมีปัญหาให้จัดการแทน)`,
      conflictBookingId: conflict.id,
    }, { status: 409 })
  }

  // กันเอารถคันนี้ไปแล้วทำให้คิวจองแบบ "ระบุแค่รุ่น ไม่เจาะจงคัน" ของรุ่นเดียวกันขาดรถแบบไม่รู้ตัว
  // (เดิมเช็คแค่ชนคิวที่เจาะจงคันนี้ตรงๆ เท่านั้น ไม่เคยเช็คผลกระทบต่อคิวจองแบบรุ่น)
  if (!conflict) {
    const { data: bikeRow } = await supabase.from('bikes').select('brand, model').eq('id', bikeId).single()
    if (bikeRow) {
      const modelConflict = await findModelBookingConflict(
        supabase, BRANCH_ID, bikeRow.brand, bikeRow.model, bikeId, startDatetime, endDatetime,
      )
      if (modelConflict && !overrideBookingConflict) {
        return NextResponse.json({
          error: `เอารถคันนี้ไปจะทำให้รุ่น ${bikeRow.brand} ${bikeRow.model} ไม่พอสำหรับคิวจอง ${modelConflict.booking_ref} (คุณ${modelConflict.customer_name} รับรถ ${new Date(modelConflict.start_datetime).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}) — ใช้ Fast lane เพื่อยืนยันทำต่อได้ (คิวนั้นจะยังไม่ถูกยกเลิก จะไปโผล่ในคิวมีปัญหาให้จัดการแทน)`,
          conflictBookingId: modelConflict.id,
        }, { status: 409 })
      }
      if (modelConflict) conflict = modelConflict
    }
  }

  // กันชั้นสุดท้าย — คนติดบัญชีดำของร้าน ทำสัญญาไม่ได้ (เช็คทั้งชื่อ/เบอร์/เลขบัตร กันเคสเปลี่ยนชื่อ)
  const blHit = await checkBlacklist(supabase, { name: customer.name, phone: customer.phone, idCardNumber: customer.idCardNumber })
  if (blHit) {
    return NextResponse.json({
      error: `⛔ ${blHit.name} ติดบัญชีแบล็คลิสต์ของร้าน ไม่สามารถเช่าได้${blHit.reason ? ` (${blHit.reason})` : ''}`,
    }, { status: 403 })
  }

  // Find or create customer
  let customerId: string
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('phone', customer.phone)
    .eq('branch_id', BRANCH_ID)
    .maybeSingle()

  if (existing) {
    customerId = existing.id
    await supabase
      .from('customers')
      .update({ name: customer.name, workplace: customer.hotel || null, id_card_number: customer.idCardNumber })
      .eq('id', customerId)
  } else {
    const { data: newCust, error: custErr } = await supabase
      .from('customers')
      .insert({ branch_id: BRANCH_ID, name: customer.name, phone: customer.phone, workplace: customer.hotel || null, id_card_number: customer.idCardNumber })
      .select('id')
      .single()
    if (custErr || !newCust) return NextResponse.json({ error: 'สร้างข้อมูลลูกค้าไม่สำเร็จ' }, { status: 500 })
    customerId = newCust.id
  }

  // Create rental
  const { data: rental, error: rentalErr } = await supabase
    .from('rentals')
    .insert({
      branch_id: BRANCH_ID,
      bike_id: bikeId,
      customer_id: customerId,
      staff_id: staffId,
      start_datetime: new Date(startDatetime).toISOString(),
      expected_end_datetime: new Date(endDatetime).toISOString(),
      daily_rate: dailyRate,
      total_days: totalDays,
      total_amount: totalAmount,
      deposit_amount: depositAmount || 0,
      discount: discount || 0,
      payment_method: paymentMethod,
      paid_amount: totalAmount,
      status: 'active',
      notes: `น้ำมัน ${fuelLevel}/8 แถบ • ไมล์ ${odometer}`,
      send_photos: photos ?? {},
      customer_signature: signature ?? null,
    })
    .select('id')
    .single()

  if (rentalErr || !rental) {
    return NextResponse.json({ error: 'บันทึกการเช่าไม่สำเร็จ' }, { status: 500 })
  }

  // ลงสมุดรายรับ — ค่าเช่าเก็บตอนส่งรถ (best-effort ไม่ block การส่งรถ)
  await supabase.from('rental_payments').insert({
    rental_id: rental.id,
    branch_id: BRANCH_ID,
    staff_id: staffId,
    kind: 'rental',
    amount: totalAmount ?? 0,
    paid_at: new Date(startDatetime).toISOString(),
  })

  // ปิดคิวจองที่กำลังเติมเต็มด้วยสัญญานี้ (ถ้ามาจากการจอง) — คิวจองอื่นที่ชนช่วงเวลานี้ (ถ้ามี — ต้องผ่าน
  // Fast lane override มาแล้วเท่านั้นถึงมาถึงจุดนี้ได้) จะไม่ถูกยกเลิก ปล่อยให้ยัง confirmed อยู่
  // ระบบคิวมีปัญหาจะจับได้เองว่าชนกับสัญญานี้ ให้ staff ไปจัดการต่อ (โทร/หารถแทน) แทนที่จะหายไปเงียบๆ
  if (excludeBookingId) {
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', excludeBookingId)
  }
  if (conflict && overrideBookingConflict) {
    await supabase.from('rentals').update({ fast_lane: true }).eq('id', rental.id)
  }

  // Update bike status + odometer
  const newOdometer = parseInt(odometer) || 0
  const { error: bikeErr } = await supabase
    .from('bikes')
    .update({ status: lockBike ? 'locked' : 'rented', odometer: newOdometer })
    .eq('id', bikeId)

  if (bikeErr) {
    console.error('[rental/create] bike update error:', JSON.stringify(bikeErr))
  }

  // Recalculate next_due_km for never-done routines (prevents false alerts
  // when a bike is first sent with a high odometer value)
  await recalcNeverDoneRoutines(supabase, bikeId, newOdometer)

  // Lookup staff name for log
  const { data: staffRow } = await supabase.from('staff').select('name').eq('id', staffId).single()
  const staffName = staffRow?.name ?? staffId

  await writeLog({
    actorType: 'staff',
    actorId: staffId,
    actorName: staffName,
    action: 'rental_created',
    description: `ส่งรถให้ลูกค้า ${customer.name} (${customer.phone}) — ฿${totalAmount?.toLocaleString() ?? 0} / ${totalDays} วัน` +
      (conflict && overrideBookingConflict ? ` ⚡ Fast lane ทับคิวจอง ${conflict.booking_ref}` : ''),
    metadata: { rentalId: rental.id, bikeId, customerId, totalAmount, totalDays, fastLaneOverBookingId: conflict && overrideBookingConflict ? conflict.id : null },
  })

  return NextResponse.json({ success: true, rentalId: rental.id })
}
