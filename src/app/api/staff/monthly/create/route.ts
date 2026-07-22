import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeLog } from '@/lib/log'
import { getStaffOwnBranchId } from '@/lib/staffBranch'
import { recalcNeverDoneRoutines } from '@/lib/routines'
import { checkBlacklist } from '@/lib/blacklist'
import { hasOpenContract } from '@/lib/availability'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const {
    bikeId, staffId,
    customer,
    startDate,
    paymentDay,
    monthlyRate,
    depositAmount,
    odometer,
    fuelLevel,
    paymentMethod,
    photos,
    signature,
    overrideBookingConflict,
  } = body

  if (!bikeId || !staffId || !customer?.name || !customer?.phone || !startDate || !monthlyRate) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  let BRANCH_ID: string
  try {
    BRANCH_ID = await getStaffOwnBranchId(staffId)
  } catch {
    return NextResponse.json({ error: 'ไม่พบสาขาของ Staff' }, { status: 400 })
  }

  const REQUIRED_PHOTOS = ['id_card', 'selfie', 'with_bike', 'damage', 'payment']
  const missingPhotos = REQUIRED_PHOTOS.filter(k => !photos?.[k])
  if (missingPhotos.length > 0) {
    return NextResponse.json({ error: 'กรุณาอัปโหลดรูปภาพให้ครบ (บัตร, รูปถ่าย, รถ, ตำหนิ, ชำระเงิน)' }, { status: 400 })
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
  const conflict = (conflictBookings ?? [])[0]
  if (conflict && !overrideBookingConflict) {
    return NextResponse.json({
      error: `ทำสัญญารายเดือนนี้จะไปชนคิวจอง ${conflict.booking_ref} (คุณ${conflict.customer_name} รับรถ ${new Date(conflict.start_datetime).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}) — ใช้ Fast lane เพื่อยืนยันทำต่อได้ (คิวนั้นจะยังไม่ถูกยกเลิก จะไปโผล่ในคิวมีปัญหาให้จัดการแทน)`,
      conflictBookingId: conflict.id,
    }, { status: 409 })
  }

  // กันชั้นสุดท้าย — คนติดบัญชีดำของร้าน ทำสัญญาไม่ได้
  const blHit = await checkBlacklist(supabase, { name: customer.name, phone: customer.phone })
  if (blHit) {
    return NextResponse.json({
      error: `⛔ ${blHit.name} ติดบัญชีแบล็คลิสต์ของร้าน ไม่สามารถเช่าได้${blHit.reason ? ` (${blHit.reason})` : ''}`,
    }, { status: 403 })
  }

  // Upsert customer
  let customerId: string
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('phone', customer.phone)
    .eq('branch_id', BRANCH_ID)
    .maybeSingle()

  if (existing) {
    customerId = existing.id
    await supabase.from('customers').update({
      name: customer.name,
      workplace: customer.address || null,
    }).eq('id', customerId)
  } else {
    const { data: newCustomer, error: cErr } = await supabase
      .from('customers')
      .insert({
        branch_id: BRANCH_ID,
        name: customer.name,
        phone: customer.phone,
        workplace: customer.address || null,
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
      status: 'active',
      send_photos: sendPhotos,
      customer_signature: signature ?? null,
      ...(conflict && overrideBookingConflict ? { fast_lane: true } : {}),
    })
    .select('id')
    .single()

  if (rErr || !rental) {
    return NextResponse.json({ error: rErr?.message ?? 'บันทึกสัญญาไม่สำเร็จ' }, { status: 500 })
  }

  // Update bike status + odometer + fuel
  await supabase.from('bikes').update({
    status: 'rented',
    odometer: parseInt(odometer) || 0,
    fuel_level: fuelLevel,
    updated_at: new Date().toISOString(),
  }).eq('id', bikeId)

  // กันรูทีนที่ไม่เคยทำแจ้งเตือนผิด เมื่อเลขไมล์จริงเพิ่งถูกบันทึกครั้งแรก
  await recalcNeverDoneRoutines(supabase, bikeId, parseInt(odometer) || 0)

  // Record first payment with correct due date
  if (paymentMethod) {
    const start = new Date(startDate)
    const offset = paymentDay < start.getDate() ? 1 : 0
    const firstDue = new Date(start)
    firstDue.setMonth(firstDue.getMonth() + offset)
    const daysInMonth = new Date(firstDue.getFullYear(), firstDue.getMonth() + 1, 0).getDate()
    firstDue.setDate(Math.min(paymentDay, daysInMonth))
    const firstDueDateStr = firstDue.toISOString().split('T')[0]

    await supabase.from('monthly_payments').insert({
      monthly_rental_id: rental.id,
      due_date: firstDueDateStr,
      paid_date: startDate,
      amount: monthlyRate,
      payment_method: paymentMethod,
      status: 'paid',
    })
  }

  const { data: staffRow } = await supabase.from('staff').select('name').eq('id', staffId).single()
  const staffName = staffRow?.name ?? staffId

  await writeLog({
    actorType: 'staff',
    actorId: staffId,
    actorName: staffName,
    action: 'monthly_created',
    description: `เช่ารายเดือน — ลูกค้า ${customer.name} (${customer.phone}) — ฿${monthlyRate.toLocaleString()}/เดือน` +
      (conflict && overrideBookingConflict ? ` ⚡ Fast lane ทับคิวจอง ${conflict.booking_ref}` : ''),
    metadata: { rentalId: rental.id, bikeId, customerId, monthlyRate, fastLaneOverBookingId: conflict && overrideBookingConflict ? conflict.id : null },
  })

  return NextResponse.json({
    success: true,
    rentalId: rental.id,
    fastLaneConflictId: conflict && overrideBookingConflict ? conflict.id : null,
  })
}
