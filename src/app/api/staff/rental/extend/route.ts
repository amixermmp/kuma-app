import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { logStaffAction } from '@/lib/log'
import { findModelBookingConflict } from '@/lib/bookingConflicts'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { rentalId, payment, newEndDatetime, newTotalDays, newCredit, overrideBookingConflict } = body

  if (!rentalId || !newEndDatetime || !newTotalDays || payment == null || newCredit == null) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: current, error: fetchErr } = await supabase
    .from('rentals')
    .select('total_amount, branch_id, bike_id, bikes(license_plate, brand, model)')
    .eq('id', rentalId)
    .in('status', ['active', 'extended'])
    .single()

  if (fetchErr || !current) {
    return NextResponse.json({ error: 'ไม่พบรายการเช่า' }, { status: 404 })
  }

  // กันต่อทับคิวจองแบบไม่รู้ตัว — ต่อได้ต่อเมื่อยืนยัน (override) แล้วไปย้ายคิวให้ลูกค้าจอง
  const bufferMs = 3 * 3_600_000
  const { data: conflictBookings } = await supabase
    .from('bookings')
    .select('id, booking_ref, customer_name, start_datetime')
    .eq('bike_id', current.bike_id)
    .eq('status', 'confirmed')
    .lt('start_datetime', new Date(new Date(newEndDatetime).getTime() + bufferMs).toISOString())
    .gt('end_datetime', new Date().toISOString())
  let conflict = (conflictBookings ?? [])[0]
  if (conflict && !overrideBookingConflict) {
    return NextResponse.json({
      error: `ต่อไม่ได้ — ชนคิวจอง ${conflict.booking_ref} (คุณ${conflict.customer_name} รับรถ ${new Date(conflict.start_datetime).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}) — ใช้ Fast lane เพื่อยืนยันต่อได้ (คิวนั้นจะยังไม่ถูกยกเลิก จะไปโผล่ในคิวมีปัญหาให้จัดการแทน)`,
      conflictBookingId: conflict.id,
    }, { status: 409 })
  }

  // กันต่อเวลาแล้วทำให้คิวจองแบบ "ระบุแค่รุ่น ไม่เจาะจงคัน" ของรุ่นเดียวกันขาดรถแบบไม่รู้ตัว
  if (!conflict) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bikeInfo = Array.isArray((current as any).bikes) ? (current as any).bikes[0] : (current as any).bikes
    if (bikeInfo?.brand && bikeInfo?.model) {
      const modelConflict = await findModelBookingConflict(
        supabase, current.branch_id, bikeInfo.brand, bikeInfo.model, current.bike_id, new Date().toISOString(), newEndDatetime,
      )
      if (modelConflict && !overrideBookingConflict) {
        return NextResponse.json({
          error: `ต่อเวลานี้จะทำให้รุ่น ${bikeInfo.brand} ${bikeInfo.model} ไม่พอสำหรับคิวจอง ${modelConflict.booking_ref} (คุณ${modelConflict.customer_name} รับรถ ${new Date(modelConflict.start_datetime).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}) — ใช้ Fast lane เพื่อยืนยันต่อได้ (คิวนั้นจะยังไม่ถูกยกเลิก จะไปโผล่ในคิวมีปัญหาให้จัดการแทน)`,
          conflictBookingId: modelConflict.id,
        }, { status: 409 })
      }
      if (modelConflict) conflict = modelConflict
    }
  }

  const { error } = await supabase
    .from('rentals')
    .update({
      status: 'extended',
      expected_end_datetime: newEndDatetime,
      total_days: newTotalDays,
      total_amount: current.total_amount + payment,
      outstanding_credit: newCredit,
      ...(conflict && overrideBookingConflict ? { fast_lane: true } : {}),
    })
    .eq('id', rentalId)

  if (error) {
    console.error('Extend error:', error.message)
    return NextResponse.json({ error: 'ต่อเวลาไม่สำเร็จ' }, { status: 500 })
  }

  // ลงสมุดรายรับ — เงินต่อเวลานับ ณ วันที่เก็บจริง (ไม่ใช่วันเริ่มสัญญา)
  if (payment > 0) {
    await supabase.from('rental_payments').insert({
      rental_id: rentalId,
      branch_id: current.branch_id,
      staff_id: staffId,
      kind: 'extend',
      amount: payment,
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plate = (Array.isArray((current as any).bikes) ? (current as any).bikes[0] : (current as any).bikes)?.license_plate ?? ''
  const newEndText = new Date(newEndDatetime).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  await logStaffAction(staffId, 'rental_extended',
    `ต่อเวลาเช่า ${plate} — ถึง ${newEndText} — เก็บเงิน ฿${Number(payment).toLocaleString()}` +
    (conflict && overrideBookingConflict ? ` ⚡ Fast lane ทับคิวจอง ${conflict.booking_ref}` : ''),
    { rentalId, payment, newEndDatetime, overrodeBooking: conflict?.id ?? null })

  return NextResponse.json({ success: true })
}
