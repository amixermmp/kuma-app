import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeLog } from '@/lib/log'
import { getStaffOwnBranchId } from '@/lib/staffBranch'
import { recalcNeverDoneRoutines } from '@/lib/routines'
import { checkBlacklist } from '@/lib/blacklist'
import { hasOpenContract } from '@/lib/availability'
import { findModelBookingConflict } from '@/lib/bookingConflicts'
import { isRealPhone, isThaiIdNumber } from '@/lib/customer'
import { queueMarketingPhoto } from '@/lib/marketingPhotos'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const {
    bikeId, staffId,
    customer,
    startDate,
    paymentDay,
    monthlyRate,
    depositAmount,
    depositMethod,
    isForeignNoPhone,
    odometer,
    fuelFull,
    paymentMethod,
    photos,
    signature,
    overrideBookingConflict,
    slipCustomerName, slipNameMismatchConfirmed,
  } = body

  if (!bikeId || !staffId || !customer?.name || (!isForeignNoPhone && !customer?.phone) || !startDate || !monthlyRate) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }
  if (!customer?.idCardNumber) {
    return NextResponse.json({ error: 'กรุณากรอกเลขบัตรประชาชน/พาสปอร์ต' }, { status: 400 })
  }
  // นโยบายร้าน: บัตรไทยต้องโอนเงินเท่านั้น จ่ายเงินสดได้เฉพาะต่างชาติ (พาสปอร์ต) — เช็คซ้ำฝั่งเซิร์ฟเวอร์
  if (paymentMethod === 'cash' && isThaiIdNumber(customer.idCardNumber)) {
    return NextResponse.json({ error: 'บัตรประชาชนไทย — จ่ายเงินสดไม่ได้ ต้องโอนเงินเท่านั้น' }, { status: 400 })
  }

  let BRANCH_ID: string
  try {
    BRANCH_ID = await getStaffOwnBranchId(staffId)
  } catch {
    return NextResponse.json({ error: 'ไม่พบสาขาของ Staff' }, { status: 400 })
  }

  // หลักฐานที่พักไม่บังคับอีกต่อไป — ถ้าลูกค้าไม่มีจะเก็บมัดจำแทน แต่ถ้าแนบมาต้องมีรูปจริง
  const REQUIRED_PHOTOS = ['id_card', 'selfie', 'with_bike', 'damage', 'payment']
  const missingPhotos = REQUIRED_PHOTOS.filter(k => !photos?.[k])
  if (missingPhotos.length > 0) {
    return NextResponse.json({ error: 'กรุณาอัปโหลดรูปภาพให้ครบ (บัตร, รูปถ่าย, รถ, ตำหนิ, ชำระเงิน)' }, { status: 400 })
  }
  // สัญญารายเดือนถือเป็นเช่าระยะยาวเสมอ — วางบัตรแทนมัดจำไม่ได้
  if (depositMethod === 'id_card') {
    return NextResponse.json({ error: 'สัญญารายเดือน วางบัตรแทนมัดจำไม่ได้ ต้องเก็บเป็นเงินสด/โอน' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Guard: กันสัญญาซ้อน — รถที่ยังมีสัญญาค้าง (ยังไม่กดจบ) ห้ามทำสัญญาใหม่
  if (await hasOpenContract(supabase, bikeId)) {
    return NextResponse.json({ error: 'รถคันนี้ยังมีสัญญาค้างอยู่ (ยังไม่ได้กดจบสัญญา) — ปิดสัญญาเดิมก่อนจึงจะทำสัญญาใหม่ได้' }, { status: 409 })
  }

  // กันทำสัญญารายเดือนทับคิวจองของลูกค้าคนอื่นแบบไม่รู้ตัว — สัญญารายเดือนไม่มีวันสิ้นสุดตายตัว
  // จึงถือว่าชนกับคิวจองในอนาคตของรถคันนี้ทั้งหมด ไม่ว่าจะไกลแค่ไหน
  const { data: conflictBookings } = await supabase
    .from('bookings')
    .select('id, booking_ref, customer_name, start_datetime')
    .eq('bike_id', bikeId)
    .eq('status', 'confirmed')
    .gt('end_datetime', new Date().toISOString())
    .order('start_datetime', { ascending: true })
  let conflict = (conflictBookings ?? [])[0]
  if (conflict && !overrideBookingConflict) {
    return NextResponse.json({
      error: `ทำสัญญารายเดือนนี้จะไปชนคิวจอง ${conflict.booking_ref} (คุณ${conflict.customer_name} รับรถ ${new Date(conflict.start_datetime).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}) — ใช้ Fast lane เพื่อยืนยันทำต่อได้ (คิวนั้นจะยังไม่ถูกยกเลิก จะไปโผล่ในคิวมีปัญหาให้จัดการแทน)`,
      conflictBookingId: conflict.id,
    }, { status: 409 })
  }

  // กันทำสัญญารายเดือนแล้วทำให้คิวจองแบบ "ระบุแค่รุ่น ไม่เจาะจงคัน" ของรุ่นเดียวกันขาดรถแบบไม่รู้ตัว
  // รายเดือนไม่มีวันสิ้นสุดตายตัว ใช้ 1 ปีข้างหน้าแทน "ไม่จำกัด" ในการเช็ค
  if (!conflict) {
    const { data: bikeRow } = await supabase.from('bikes').select('brand, model').eq('id', bikeId).single()
    if (bikeRow) {
      const farFuture = new Date(Date.now() + 365 * 86_400_000).toISOString()
      const modelConflict = await findModelBookingConflict(
        supabase, BRANCH_ID, bikeRow.brand, bikeRow.model, bikeId, new Date().toISOString(), farFuture,
      )
      if (modelConflict && !overrideBookingConflict) {
        return NextResponse.json({
          error: `ทำสัญญารายเดือนนี้จะทำให้รุ่น ${bikeRow.brand} ${bikeRow.model} ไม่พอสำหรับคิวจอง ${modelConflict.booking_ref} (คุณ${modelConflict.customer_name} รับรถ ${new Date(modelConflict.start_datetime).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}) — ใช้ Fast lane เพื่อยืนยันทำต่อได้ (คิวนั้นจะยังไม่ถูกยกเลิก จะไปโผล่ในคิวมีปัญหาให้จัดการแทน)`,
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

  // Upsert customer — match ด้วยเบอร์โทรเฉพาะเบอร์ที่ดูจริง (>= 9 หลัก) เท่านั้น กันลูกค้าที่ไม่มี
  // เบอร์จริงพิมพ์ "," หรือ "-" ผ่าน required field เฉยๆ แล้วไปจับคู่ทับลูกค้าคนอื่นที่ทำแบบเดียวกัน
  let customerId: string
  const { data: existing } = isRealPhone(customer.phone)
    ? await supabase
        .from('customers')
        .select('id')
        .eq('phone', customer.phone)
        .eq('branch_id', BRANCH_ID)
        .maybeSingle()
    : { data: null }

  if (existing) {
    customerId = existing.id
    await supabase.from('customers').update({
      name: customer.name,
      workplace: customer.address || null,
      id_card_number: customer.idCardNumber,
      alt_contact: customer.altContact || null,
    }).eq('id', customerId)
  } else {
    const { data: newCustomer, error: cErr } = await supabase
      .from('customers')
      .insert({
        branch_id: BRANCH_ID,
        name: customer.name,
        phone: customer.phone || null,
        id_card_number: customer.idCardNumber,
        workplace: customer.address || null,
        alt_contact: customer.altContact || null,
      })
      .select('id')
      .single()
    if (cErr || !newCustomer) {
      return NextResponse.json({ error: 'สร้างลูกค้าไม่สำเร็จ' }, { status: 500 })
    }
    customerId = newCustomer.id
  }

  // Create monthly rental
  const sendPhotos = Object.entries(photos as Record<string, string>)
    .filter(([, url]) => url)
    .map(([label, url]) => ({ label, url }))

  const { data: rental, error: rErr } = await supabase
    .from('monthly_rentals')
    .insert({
      branch_id: BRANCH_ID,
      bike_id: bikeId,
      customer_id: customerId,
      staff_id: staffId,
      start_date: startDate,
      payment_day: paymentDay,
      monthly_rate: monthlyRate,
      deposit_amount: depositAmount || 0,
      deposit_method: depositMethod === 'id_card' ? 'id_card' : 'cash',
      status: 'active',
      send_odometer: parseInt(odometer) || 0,
      send_photos: sendPhotos,
      customer_signature: signature ?? null,
      ...(conflict && overrideBookingConflict ? { fast_lane: true } : {}),
    })
    .select('id')
    .single()

  if (rErr || !rental) {
    return NextResponse.json({ error: rErr?.message ?? 'บันทึกสัญญาไม่สำเร็จ' }, { status: 500 })
  }

  // คัดลอกรูปคู่รถเข้าคิวโปรโมท (best-effort ไม่ block การส่งรถ)
  await queueMarketingPhoto(supabase, BRANCH_ID, rental.id, 'monthly', photos?.with_bike)

  // Update bike status + odometer + fuel
  const { error: bikeUpdateErr } = await supabase.from('bikes').update({
    status: 'rented',
    odometer: parseInt(odometer) || 0,
    fuel_level: fuelFull ? 8 : 0,
    updated_at: new Date().toISOString(),
  }).eq('id', bikeId)
  // เคยเงียบไม่เช็ค error ตรงนี้ — ถ้า update ล้มเหลวรถจะค้างสถานะผิดแบบไม่มีร่องรอย
  if (bikeUpdateErr) console.error('[monthly/create] bike update failed:', bikeId, JSON.stringify(bikeUpdateErr))

  // กันรูทีนที่ไม่เคยทำแจ้งเตือนผิด เมื่อเลขไมล์จริงเพิ่งถูกบันทึกครั้งแรก
  await recalcNeverDoneRoutines(supabase, bikeId, parseInt(odometer) || 0)

  // Record first payment with correct due date
  let firstPaymentId: string | null = null
  if (paymentMethod) {
    const start = new Date(startDate)
    const offset = paymentDay < start.getDate() ? 1 : 0
    const firstDue = new Date(start)
    firstDue.setMonth(firstDue.getMonth() + offset)
    const daysInMonth = new Date(firstDue.getFullYear(), firstDue.getMonth() + 1, 0).getDate()
    firstDue.setDate(Math.min(paymentDay, daysInMonth))
    const firstDueDateStr = firstDue.toISOString().split('T')[0]

    const { data: firstPayment, error: firstPaymentErr } = await supabase.from('monthly_payments').insert({
      monthly_rental_id: rental.id,
      due_date: firstDueDateStr,
      paid_date: startDate,
      amount: monthlyRate,
      payment_method: paymentMethod,
      status: 'paid',
      staff_id: staffId,
    }).select('id').single()
    if (firstPaymentErr) console.error('[monthly/create] first payment insert failed:', JSON.stringify(firstPaymentErr))
    firstPaymentId = firstPayment?.id ?? null
  }

  const { data: staffRow } = await supabase.from('staff').select('name').eq('id', staffId).single()
  const staffName = staffRow?.name ?? staffId

  await writeLog({
    actorType: 'staff',
    actorId: staffId,
    actorName: staffName,
    action: 'monthly_created',
    description: `เช่ารายเดือน — ลูกค้า ${customer.name} (${customer.phone}) — ฿${monthlyRate.toLocaleString()}/เดือน` +
      (conflict && overrideBookingConflict ? ` ⚡ Fast lane ทับคิวจอง ${conflict.booking_ref}` : '') +
      (slipNameMismatchConfirmed ? ` ⚡ ยืนยันชื่อสลิปไม่ตรงบัตร — บัตร "${customer.name}" ผู้โอน "${slipCustomerName}"` : ''),
    metadata: {
      rentalId: rental.id, bikeId, customerId, monthlyRate,
      fastLaneOverBookingId: conflict && overrideBookingConflict ? conflict.id : null,
      slipNameMismatch: slipNameMismatchConfirmed ? { idName: customer.name, slipName: slipCustomerName } : null,
    },
  })

  return NextResponse.json({
    success: true,
    rentalId: rental.id,
    paymentId: firstPaymentId,
    fastLaneConflictId: conflict && overrideBookingConflict ? conflict.id : null,
  })
}
