import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { logStaffAction } from '@/lib/log'
import { getBusyBikeIds, BUFFER_MS } from '@/lib/availability'
import { getModelBikeAvailability } from '@/lib/bookingConflicts'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    bookingId, startDatetime, endDatetime, totalDays, totalAmount,
    customerName, customerPhone, customerHotel, notes,
    overrideConflict,
  } = body

  if (!bookingId || !startDatetime || !endDatetime || !totalDays || totalAmount == null || !customerName || !customerPhone) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booking_ref, branch_id, bike_id, requested_brand, requested_model, customer_name')
    .eq('id', bookingId)
    .eq('status', 'confirmed')
    .single()

  if (!booking) return NextResponse.json({ error: 'ไม่พบคิวจองนี้ หรือถูกยกเลิก/ทำรายการไปแล้ว' }, { status: 404 })

  const bufferStart = new Date(new Date(startDatetime).getTime() - BUFFER_MS).toISOString()
  const bufferEnd = new Date(new Date(endDatetime).getTime() + BUFFER_MS).toISOString()

  // ชนคิวไหม — ใช้ตัดสินว่าต้อง Fast lane หรือเปล่า เหมือนตอนสร้างคิวจองใหม่ (booking/create)
  let hasConflict = false
  let conflictBookingId: string | null = null

  if (booking.bike_id) {
    const [busyIds, { data: bookingConflict }] = await Promise.all([
      getBusyBikeIds(supabase, startDatetime, endDatetime),
      supabase.from('bookings')
        .select('id')
        .eq('bike_id', booking.bike_id)
        .eq('status', 'confirmed')
        .neq('id', bookingId)
        .lt('start_datetime', bufferEnd)
        .gt('end_datetime', bufferStart)
        .maybeSingle(),
    ])
    hasConflict = busyIds.has(booking.bike_id) || !!bookingConflict
    conflictBookingId = bookingConflict?.id ?? null
    if (hasConflict && !overrideConflict) {
      return NextResponse.json({
        error: 'วันที่ใหม่นี้จะไปชนคิวจอง/สัญญาเช่าอื่นของรถคันนี้ — ใช้ Fast lane เพื่อยืนยันแก้ไขได้ (คิวเดิมจะยังไม่ถูกยกเลิก จะไปโผล่ในคิวมีปัญหาให้จัดการแทน)',
        conflict: true,
      }, { status: 409 })
    }
  } else if (booking.requested_brand && booking.requested_model) {
    // ไม่นับตัวเองเป็นคู่แข่งชิงโควต้ารุ่น (excludeBookingId) เพราะกำลังจะย้ายวันของตัวเองอยู่แล้ว
    const availability = await getModelBikeAvailability(
      supabase, booking.branch_id, booking.requested_brand, booking.requested_model,
      startDatetime, endDatetime, undefined, bookingId,
    )
    hasConflict = availability.freeBikeIds.length <= 0
    if (hasConflict && !overrideConflict) {
      return NextResponse.json({
        error: `วันที่ใหม่นี้ไม่มีรถรุ่น ${booking.requested_brand} ${booking.requested_model} ว่างพอ — ใช้ Fast lane เพื่อยืนยันแก้ไขได้ (ระบบจะเตือนให้หารถเพิ่ม/จัดรถให้ทันเมื่อใกล้ถึงกำหนด)`,
        conflict: true,
      }, { status: 409 })
    }
  }

  const { error } = await supabase
    .from('bookings')
    .update({
      start_datetime: startDatetime,
      end_datetime: endDatetime,
      total_days: totalDays,
      total_amount: totalAmount,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_hotel: customerHotel || null,
      notes: notes || null,
      ...(hasConflict && overrideConflict ? { fast_lane: true } : {}),
    })
    .eq('id', bookingId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logStaffAction(staffId, 'booking_updated',
    `แก้ไขคิวจอง ${booking.booking_ref} — ลูกค้า ${customerName} — ย้ายวันที่/แก้ข้อมูล` +
      (hasConflict && overrideConflict ? ` ⚡ Fast lane ทับคิว ${conflictBookingId ?? 'รุ่นเดียวกัน'}` : ''),
    { bookingId, startDatetime, endDatetime, conflictBookingId: hasConflict && overrideConflict ? conflictBookingId : null })

  return NextResponse.json({ success: true, bookingId })
}
