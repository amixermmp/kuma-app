import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import SendCarForm from './SendCarForm'

export const dynamic = 'force-dynamic'

export default async function SendCarPage({
  params,
  searchParams,
}: {
  params: { bikeId: string }
  searchParams: { bookingId?: string; from?: string; to?: string }
}) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()

  const [{ data: bike }, { data: promotions }] = await Promise.all([
    supabase
      .from('bikes')
      .select('id, license_plate, brand, model, daily_rate, monthly_rate, deposit_amount, odometer')
      .eq('id', params.bikeId)
      .single(),
    supabase
      .from('promotions')
      .select('id, code, description, discount_type, discount_value, eligible_bike_ids, is_student_promo')
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
  ])

  if (!bike) redirect('/staff/home')

  // Pre-fill from booking if coming from assign flow
  let booking = null
  if (searchParams.bookingId) {
    const { data } = await supabase
      .from('bookings')
      .select('id, customer_name, customer_phone, customer_hotel, start_datetime, end_datetime, total_days, daily_rate, notes, original_requested_brand, original_requested_model, reassign_reason')
      .eq('id', searchParams.bookingId)
      .eq('status', 'confirmed')
      .single()
    booking = data ?? null
  }

  // คิวจองถัดไปของรถคันนี้ (ไม่รวมคิวที่กำลังจะส่งให้ในรอบนี้เอง) — เอาไว้เตือนตอนตั้งเวลาคืน
  let upcomingBookingsQuery = supabase
    .from('bookings')
    .select('id, booking_ref, customer_name, start_datetime')
    .eq('bike_id', params.bikeId)
    .eq('status', 'confirmed')
    .gt('start_datetime', new Date().toISOString())
    .order('start_datetime', { ascending: true })
  if (booking?.id) upcomingBookingsQuery = upcomingBookingsQuery.neq('id', booking.id)
  const { data: upcomingBookings } = await upcomingBookingsQuery

  return (
    <SendCarForm
      bike={bike}
      staffId={staffId}
      promotions={promotions ?? []}
      prefillBooking={booking}
      prefillFrom={searchParams.from}
      prefillTo={searchParams.to}
      upcomingBookings={upcomingBookings ?? []}
    />
  )
}
