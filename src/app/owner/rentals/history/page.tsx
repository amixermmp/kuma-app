import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import HistoryClient from './HistoryClient'

export const dynamic = 'force-dynamic'

export default async function OwnerRentalHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()

  const [{ data: dailyRentals }, { data: monthlyRentals }] = await Promise.all([
    admin
      .from('rentals')
      .select(`
        id, start_datetime, actual_end_datetime, total_amount,
        send_odometer, return_odometer,
        bikes(id, license_plate, brand, model, color),
        customers(name, phone)
      `)
      .eq('status', 'returned')
      .order('actual_end_datetime', { ascending: false })
      .limit(300),
    admin
      .from('monthly_rentals')
      .select(`
        id, start_date, end_date, monthly_rate,
        send_odometer, return_odometer,
        bikes(id, license_plate, brand, model, color),
        customers(name, phone)
      `)
      .eq('status', 'ended')
      .order('end_date', { ascending: false })
      .limit(300),
  ])

  return <HistoryClient dailyRentals={dailyRentals ?? []} monthlyRentals={monthlyRentals ?? []} />
}
