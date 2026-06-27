import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import ContractView from './ContractView'

export const dynamic = 'force-dynamic'

export default async function ContractPage({ params }: { params: Promise<{ rentalId: string }> }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const { rentalId } = await params
  const supabase = createAdminClient()

  const [{ data: rental }, { data: shop }] = await Promise.all([
    supabase
      .from('rentals')
      .select(`
        id, start_datetime, expected_end_datetime, total_days, daily_rate,
        total_amount, deposit_amount, discount, payment_method, created_at, notes,
        customer_signature,
        bikes(license_plate, brand, model, color),
        customers(name, phone, workplace)
      `)
      .eq('id', rentalId)
      .single(),
    supabase
      .from('shop_settings')
      .select('shop_name, address, phone, tax_id')
      .limit(1)
      .maybeSingle(),
  ])

  if (!rental) redirect('/staff/home')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ContractView rental={rental as any} shop={shop ?? {}} />
}
