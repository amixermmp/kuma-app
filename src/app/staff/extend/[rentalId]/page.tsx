import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import ExtendForm from './ExtendForm'

export const dynamic = 'force-dynamic'

export default async function ExtendPage({ params }: { params: { rentalId: string } }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()
  const { data: rental } = await supabase
    .from('rentals')
    .select(`
      id, expected_end_datetime, total_amount, daily_rate, outstanding_credit, status,
      bikes(id, license_plate, brand, model, daily_rate),
      customers(id, name)
    `)
    .eq('id', params.rentalId)
    .in('status', ['active', 'extended'])
    .single()

  if (!rental) redirect('/staff/home')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ExtendForm rental={rental