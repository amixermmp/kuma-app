import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import BookingForm from './BookingForm'

export const dynamic = 'force-dynamic'

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: { bikeId: string }
  searchParams: { from?: string; to?: string }
}) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()

  const [{ data: bike }, { data: promotions }] = await Promise.all([
    supabase
      .from('bikes')
      .select('id, license_plate, brand, model, color, year, daily_rate, monthly_rate, deposit_amount, odometer')
      .eq('id', params.bikeId)
      .single(),
    supabase
      .from('promotions')
      .select('id, code, description, discount_type, discount_value')
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
  ])

  if (!bike) redirect('/staff/search')

  return (
    <BookingForm
      bike={bike}
      staffId={staffId}
      promotions={promotions ?? []}
      preFrom={searchParams.from ?? null}
      preTo={searchParams.to ?? null}
    />
  )
}
