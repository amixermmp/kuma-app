import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeLog } from '@/lib/log'
import { findModelBookingConflict } from '@/lib/bookingConflicts'
import { isThaiIdNumber } from '@/lib/customer'

// แปลงสัญญารายวันที่กำลังเช่าอยู่ ให้เป็นสัญญารายเดือน (ลูกค้าเช่าสั้นทดลองก่อนแล้วโอนรายเดือนเพิ่มมา)
// ปิดสัญญารายวันเดิม (ไม่แตะยอด rental_payments ที่เก็บไปแล้ว — ยึดตามกฎบัญชี "รายได้ตามวันที่เก็บจริง")
// เปิดสัญญารายเดือนใหม่ให้รถ/ลูกค้าคันเดิม ใช้รูปบัตร+ลายเซ็นจากสัญญารายวันเดิม ไม่ต้องถ่าย/เซ็นซ้ำ
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rentalId, monthlyRate, paymentDay, depositAmount, paymentMethod, overrideBookingConflict } = await request.json()

  if (!rentalId || !monthlyRate || !paymentDay || depositAmount == null || !paymentMethod) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: rental, error: rentalErr } = await supabase
    .from('rentals')
    .select('id, bike_id, customer_id, branch_id, send_photos, customer_signature, bikes(brand, model), customers(name, phone, id_card_number)')
    .eq('id', rentalId)
    .in('status', ['active', 'extended'])
    .single()

  if (rentalErr || !rental) return NextResponse.json({ error: 'ไม่พบสัญญารายวันที่ active' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bike = Array.isArray((rental as any).bikes) ? (rental as any).bikes[0] : (rental as any).bikes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customer = Array.isArray((rental as any).customers) ? (rental as any).customers[0] : (rental as any).customers

  // นโยบายร้าน: บัตรไทยต้องโอนเงินเท่านั้น จ่ายเงินสดได้เฉพาะต่างชาติ (พาสปอร์ต)
  if (paymentMethod === 'cash' && isThaiIdNumber(customer?.id_card_number ?? '')) {
    return NextResponse.json({ error: 'บัตรประชาชนไทย — จ่ายเงินสดไม่ได้ ต้องโอนเงินเท่านั้น' }, { status: 400 })
  }

  const bikeId = rental.bike_id
  const branchId = rental.branch_id
  const nowIso = new Date().toISOString()

  // กันแปลงเป็นรายเดือนแล้วไปชนคิวจองของลูกค้าคนอื่น — สัญญารายเดือนไม่มีวันสิ้นสุดตายตัว
  const { data: conflictBookings } = await supabase
    .from('bookings')
    .select('id, booking_ref, customer_name, start_datetime')
    .eq('bike_id', bikeId)
    .eq('status', 'confirmed')
    .gt('end_datetime', nowIso)
    .order('start_datetime', { ascending: true })
  let conflict = (conflictBookings ?? [])[0]
  if (conflict && !overrideBookingConflict) {
    return NextResponse.json({
      error: `แปลงเป็นรายเดือนจะไปชนคิวจอง ${conflict.booking_ref} (คุณ${conflict.customer_name} รับรถ ${new Date(conflict.start_datetime).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}) — ใช้ Fast lane เพื่อยืนยันทำต่อได้ (คิวนั้นจะยังไม่ถูกยกเลิก จะไปโผล่ในคิวมีปัญหาให้จัดการแทน)`,
      conflictBookingId: conflict.id,
    }, { status: 409 })
  }

  if (!conflict && bike?.brand && bike?.model) {
    const farFuture = new Date(Date.now() + 365 * 86_400_000).toISOString()
    const modelConflict = await findModelBookingConflict(
      supabase, branchId, bike.brand, bike.model, bikeId, nowIso, farFuture,
    )
    if (modelConflict && !overrideBookingConflict) {
      return NextResponse.json({
        error: `แปลงเป็นรายเดือนจะทำให้รุ่น ${bike.brand} ${bike.model} ไม่พอสำหรับคิวจอง ${modelConflict.booking_ref} (คุณ${modelConflict.customer_name} รับรถ ${new Date(modelConflict.start_datetime).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}) — ใช้ Fast lane เพื่อยืนยันทำต่อได้ (คิวนั้นจะยังไม่ถูกยกเลิก จะไปโผล่ในคิวมีปัญหาให้จัดการแทน)`,
        conflictBookingId: modelConflict.id,
      }, { status: 409 })
    }
    if (modelConflict) conflict = modelConflict
  }

  // ยกรูปบัตร/ลายเซ็นจากสัญญารายวันเดิมมาใช้ต่อ — ลูกค้าคนเดิม ไม่ต้องถ่าย/เซ็นซ้ำ
  const dailyPhotos = (rental.send_photos ?? {}) as Record<string, string>
  const sendPhotos = Array.isArray(dailyPhotos)
    ? dailyPhotos
    : Object.entries(dailyPhotos).filter(([, url]) => url).map(([label, url]) => ({ label, url }))

  const todayStr = new Date().toISOString().split('T')[0]

  const { data: monthlyRental, error: mErr } = await supabase
    .from('monthly_rentals')
    .insert({
      branch_id: branchId,
      bike_id: bikeId,
      customer_id: rental.customer_id,
      staff_id: staffId,
      start_date: todayStr,
      payment_day: paymentDay,
      monthly_rate: monthlyRate,
      deposit_amount: depositAmount,
      status: 'active',
      send_photos: sendPhotos,
      customer_signature: rental.customer_signature ?? null,
      ...(conflict && overrideBookingConflict ? { fast_lane: true } : {}),
    })
    .select('id')
    .single()

  if (mErr || !monthlyRental) {
    return NextResponse.json({ error: mErr?.message ?? 'สร้างสัญญารายเดือนไม่สำเร็จ' }, { status: 500 })
  }

  // ปิดสัญญารายวันเดิม — ไม่แตะยอดที่เก็บไปแล้ว (rental_payments เดิมยังเป็นรายได้ตามวันที่เก็บจริง)
  await supabase.from('rentals').update({ status: 'converted' }).eq('id', rentalId)

  // บันทึกงวดแรกของรายเดือน (ลูกค้าโอนมาแล้วตอนขอแปลง)
  const start = new Date(todayStr)
  const offset = paymentDay < start.getDate() ? 1 : 0
  const firstDue = new Date(start)
  firstDue.setMonth(firstDue.getMonth() + offset)
  const daysInMonth = new Date(firstDue.getFullYear(), firstDue.getMonth() + 1, 0).getDate()
  firstDue.setDate(Math.min(paymentDay, daysInMonth))
  const firstDueDateStr = firstDue.toISOString().split('T')[0]

  await supabase.from('monthly_payments').insert({
    monthly_rental_id: monthlyRental.id,
    due_date: firstDueDateStr,
    paid_date: todayStr,
    amount: monthlyRate,
    payment_method: paymentMethod,
    status: 'paid',
  })

  const { data: staffRow } = await supabase.from('staff').select('name').eq('id', staffId).single()
  const staffName = staffRow?.name ?? staffId

  await writeLog({
    actorType: 'staff',
    actorId: staffId,
    actorName: staffName,
    action: 'rental_converted_to_monthly',
    description: `แปลงสัญญารายวัน → รายเดือน — ลูกค้า ${customer?.name ?? '—'} (${customer?.phone ?? '—'}) — ฿${Number(monthlyRate).toLocaleString()}/เดือน` +
      (conflict && overrideBookingConflict ? ` ⚡ Fast lane ทับคิวจอง ${conflict.booking_ref}` : ''),
    metadata: {
      oldRentalId: rentalId, newMonthlyRentalId: monthlyRental.id, bikeId, monthlyRate, depositAmount,
      fastLaneOverBookingId: conflict && overrideBookingConflict ? conflict.id : null,
    },
  })

  return NextResponse.json({
    success: true,
    monthlyRentalId: monthlyRental.id,
    fastLaneConflictId: conflict && overrideBookingConflict ? conflict.id : null,
  })
}
