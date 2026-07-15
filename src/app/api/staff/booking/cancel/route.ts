import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { logStaffAction } from '@/lib/log'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bookingId } = await request.json()
  if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('booking_ref, customer_name, requested_brand, requested_model')
    .eq('id', bookingId)
    .single()
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .eq('status', 'confirmed') // safety: only cancel confirmed bookings

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logStaffAction(staffId, 'booking_cancelled',
    `ยกเลิกจอง ${booking?.booking_ref ?? bookingId} — ลูกค้า ${booking?.customer_name ?? ''}${booking?.requested_model ? ` (${booking.requested_brand} ${booking.requested_model})` : ''}`,
    { bookingId })

  return NextResponse.json({ success: true })
}
