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
  searchParams: { bookingId?: string }
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
      .select('id, code, description, discount_type, discount_value, eligible_bike_ids')
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
  ])

  if (!bike) redirect('/staff/home')

  // Pre-fill from booking if coming from assign flow
  let booking = null
  if (searchParams.bookingId) {
    const { data } = await supabase
      .from('bookings')
      .select('id, customer_name, customer_phone, customer_hotel, start_datetime, end_datetime, total_days, notes')
      .eq('id', searchParams.bookingId)
      .eq('status', 'confirmed')
      .single()
    booking = data ?? null
  }

  return (
    <SendCarForm
      bike={bike}
      staffId={staffId}
      promotions={promotions ?? []}
      prefillBooking={booking}
    />
  )
}
