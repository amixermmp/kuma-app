import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import ReturnCarForm from './ReturnCarForm'

export const dynamic = 'force-dynamic'

export default async function ReturnCarPage({ params }: { params: { rentalId: string } }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()
  const { data: rental } = await supabase
    .from('rentals')
    .select(`
      id, start_datetime, expected_end_datetime,
      total_amount, deposit_amount, daily_rate, total_days, outstanding_credit, status, notes,
      bikes(id, license_plate, brand, model, odometer),
      customers(id, name, phone)
    `)
    .eq('id', params.rentalId)
    .in('status', ['active', 'extended'])
    .single()

  if (!rental) redirect('/staff/home')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ReturnCarForm rental={rental as any} staffId={staffId} />
}
