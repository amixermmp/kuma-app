import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { logStaffAction } from '@/lib/log'

// ถอดคันออกจากการจอง — กลับเป็น "จองตามรุ่น" (แบบโรงแรม: จองประเภทห้อง ไม่ผูกเลขห้อง)
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bookingId } = await request.json()
  if (!bookingId) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booking_ref, status, bike_id, requested_brand, requested_model, daily_rate, requested_daily_rate, bikes(license_plate, brand, model)')
    .eq('id', bookingId)
    .single()

  if (!booking || booking.status !== 'confirmed') {
    return NextResponse.json({ error: 'ไม่พบการจอง' }, { status: 404 })
  }
  if (!booking.bike_id) {
    return NextResponse.json({ error: 'การจองนี้ไม่ได้ผูกคันอยู่แล้ว' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bike = (Array.isArray((booking as any).bikes) ? (booking as any).bikes[0] : (booking as any).bikes) as { license_plate?: string; brand?: string; model?: string } | null

  const { error } = await supabase
    .from('bookings')
    .update({
      bike_id: null,
      // เก็บรุ่นที่ลูกค้าจองไว้ ให้ availability นับถูก (ถ้าไม่เคยมีให้ใช้รุ่นของคันที่เพิ่งถอด)
      requested_brand: booking.requested_brand ?? bike?.brand ?? null,
      requested_model: booking.requested_model ?? bike?.model ?? null,
      requested_daily_rate: booking.requested_daily_rate ?? booking.daily_rate ?? null,
    })
    .eq('id', bookingId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logStaffAction(staffId, 'booking_unassigned',
    `ถอดคันออกจากจอง ${booking.booking_ref} — ${bike?.license_plate ?? ''} กลับเป็นจองตามรุ่น ${booking.requested_brand ?? bike?.brand ?? ''} ${booking.requested_model ?? bike?.model ?? ''}`,
    { bookingId, previousBikeId: booking.bike_id })

  return NextResponse.json({ success: true })
}
