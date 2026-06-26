import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import RentalsClient from './RentalsClient'

export const dynamic = 'force-dynamic'

export default async function OwnerRentalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()

  const [{ data: dailyRentals }, { data: monthlyRentals }] = await Promise.all([
    admin
      .from('rentals')
      .select(`
        id, start_datetime, expected_end_datetime, status,
        daily_rate, total_days, total_amount, deposit_amount, payment_method,
        send_photos, notes,
        bikes(id, license_plate, brand, model, color),
        customers(name, phone)
      `)
      .in('status', ['active', 'extended', 'overdue'])
      .order('created_at', { ascending: false }),
    admin
      .from('monthly_rentals')
      .select(`
        id, start_date, payment_day, monthly_rate, deposit_amount, status,
        send_photos,
        bikes(id, license_plate, brand, model, color),
        customers(name, phone)
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
  ])

  return <RentalsClient dailyRentals={dailyRentals ?? []} monthlyRentals={monthlyRentals ?? []} />
}
