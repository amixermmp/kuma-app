import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import ContractPublicView from './ContractPublicView'

export const dynamic = 'force-dynamic'

export default async function PublicContractPage({ params }: { params: Promise<{ rentalId: string }> }) {
  const { rentalId } = await params
  const supabase = createAdminClient()

  const [{ data: daily }, { data: monthly }, { data: shop }] = await Promise.all([
    supabase
      .from('rentals')
      .select(`
        id, branch_id, start_datetime, expected_end_datetime, total_days, daily_rate,
        total_amount, deposit_amount, payment_method, notes,
        customer_signature,
        bikes(license_plate, brand, model, color),
        customers(name, phone, workplace)
      `)
      .eq('id', rentalId)
      .maybeSingle(),
    supabase
      .from('monthly_rentals')
      .select(`
        id, branch_id, start_date, payment_day, monthly_rate,
        deposit_amount, customer_signature,
        bikes(license_plate, brand, model, color),
        customers(name, phone, workplace)
      `)
      .eq('id', rentalId)
      .maybeSingle(),
    supabase
      .from('shop_settings')
      .select('shop_name, address, phone, tax_id')
      .limit(1)
      .maybeSingle(),
  ])

  // Normalize to common shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rental: any = null

  if (daily) {
    rental = daily
    rental._type = 'daily'
  } else if (monthly) {
    rental = {
      ...monthly,
      start_datetime: monthly.start_date + 'T00:00:00+07:00',
      expected_end_datetime: null,
      total_days: null,
      daily_rate: monthly.monthly_rate,
      total_amount: monthly.monthly_rate,
      payment_method: null,
      notes: `รายเดือน ชำระทุกวันที่ ${monthly.payment_day} ของเดือน`,
      _type: 'monthly',
    }
  }

  if (!rental) notFound()

  // QR รับเงินของสาขานั้น — เลือกตามประเภทการเช่า (รายวัน/รายเดือน ใช้คนละ QR ได้)
  const { data: branchSettings } = await supabase
    .from('branch_settings')
    .select('payment_qr_daily_url, payment_qr_monthly_url')
    .eq('branch_id', rental.branch_id)
    .maybeSingle()
  const qrImageUrl = rental._type === 'monthly'
    ? branchSettings?.payment_qr_monthly_url ?? null
    : branchSettings?.payment_qr_daily_url ?? null

  return <ContractPublicView rental={rental} shop={shop ?? {}} qrImageUrl={qrImageUrl} />
}
