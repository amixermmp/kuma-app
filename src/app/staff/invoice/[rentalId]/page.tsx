import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import InvoiceView from './InvoiceView'

export const dynamic = 'force-dynamic'

export default async function InvoicePage({ params }: { params: Promise<{ rentalId: string }> }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const { rentalId } = await params
  const supabase = createAdminClient()

  const [{ data: rental }, { data: shop }] = await Promise.all([
    supabase
      .from('rentals')
      .select(`
        id, start_datetime, end_datetime, total_days, daily_rate,
        total_amount, deposit_amount, discount, payment_method, created_at,
        bikes(license_plate, brand, model),
        customers(name, phone, hotel)
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

  return <InvoiceView rental={rental as any} shop={shop ?? {}} type="daily" />
}
