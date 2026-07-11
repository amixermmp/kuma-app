import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bookingId, bikeId } = await request.json()
  if (!bookingId || !bikeId) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Fetch booking to get date range
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, start_datetime, end_datetime, status')
    .eq('id', bookingId)
    .single()

  if (!booking || booking.status !== 'confirmed') {
    return NextResponse.json({ error: 'ไม่พบการจอง' }, { status: 404 })
  }

  // Verify selected bike has no conflicts
  const bufferStart = new Date(new Date(booking.start_datetime).getTime() - 3 * 3_600_000).toISOString()
  const bufferEnd = new Date(new Date(booking.end_datetime).getTime() + 3 * 3_600_000).toISOString()

  const [{ data: rentalConflict }, { data: bookingConflict }, { data: monthlyConflict }] = await Promise.all([
    supabase.from('rentals')
      .select('id')
      .eq('bike_id', bikeId)
      .in('status', ['active', 'extended'])
      .lt('start_datetime', bufferEnd)
      .gt('expected_end_datetime', bufferStart)
      .maybeSingle(),
    supabase.from('bookings')
      .select('id')
      .eq('bike_id', bikeId)
      .eq('status', 'confirmed')
      .neq('id', bookingId)
      .lt('start_datetime', bufferEnd)
      .gt('end_datetime', bufferStart)
      .maybeSingle(),
    supabase.from('monthly_rentals')
      .select('id')
      .eq('bike_id', bikeId)
      .eq('status', 'active')
      .maybeSingle(),
  ])

  if (rentalConflict || bookingConflict || monthlyConflict) {
    return NextResponse.json({ error: 'รถคันนี้ไม่ว่างในช่วงเวลาที่จอง' }, { status: 409 })
  }

  // Update booking with assigned bike
  const { error } = await supabase
    .from('bookings')
    .update({ bike_id: bikeId })
    .eq('id', bookingId)

  if (error) {
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
