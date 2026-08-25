import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveSingleBikeRate } from '@/lib/bikeCatalog'
import ConvertToMonthlyForm from './ConvertToMonthlyForm'

export const dynamic = 'force-dynamic'

export default async function ConvertToMonthlyPage({ params }: { params: Promise<{ rentalId: string }> }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const { rentalId } = await params
  const supabase = createAdminClient()

  const { data: rental } = await supabase
    .from('rentals')
    .select(`
      id, start_datetime, expected_end_datetime, total_days, total_amount, deposit_amount, status,
      bikes(id, license_plate, brand, model, branch_id, daily_rate, monthly_rate, deposit_amount, photo_url),
      customers(name, phone, id_card_number)
    `)
    .eq('id', rentalId)
    .in('status', ['active', 'extended'])
    .single()

  if (!rental) redirect('/staff/home')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rentalBike = (rental as any).bikes
  const resolvedRental = rentalBike ? { ...rental, bikes: await resolveSingleBikeRate(supabase, rentalBike) } : rental

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ConvertToMonthlyForm rental={resolvedRental as any} staffId={staffId} />
}
