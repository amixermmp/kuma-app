import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import BikePublicClient from './BikePublicClient'

const BRANCH_ID = '00000000-0000-0000-0000-000000000001'

export const dynamic = 'force-dynamic'

export default async function BikePublicPage({
  params,
  searchParams,
}: {
  params: { bikeId: string }
  searchParams: { error?: string }
}) {
  const supabase = createAdminClient()

  const [{ data: bike }, { data: docs }, { data: settings }, { data: activeRental }, { data: activeMonthly }] = await Promise.all([
    supabase
      .from('bikes')
      .select('id, license_plate, brand, model, year, color, photo_url, daily_rate, monthly_rate, deposit_amount, status, odometer, notes')
      .eq('id', params.bikeId)
      .single(),
    supabase
      .from('bike_documents')
      .select('doc_type, doc_photo_url, expiry_date')
      .eq('bike_id', params.bikeId),
    supabase
      .from('branch_settings')
      .select('terms_photo_url, manual_photo_url, contract_photo_url, contact_line, contact_phone')
      .eq('branch_id', BRANCH_ID)
      .maybeSingle(),
    supabase
      .from('rentals')
      .select('id, expected_end_datetime, status')
      .eq('bike_id', params.bikeId)
      .in('status', ['active', 'extended'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('monthly_rentals')
      .select('id, start_date, payment_day')
      .eq('bike_id', params.bikeId)
      .eq('status', 'active')
      .maybeSingle(),
  ])

  if (!bike) notFound()

  // For extended daily rentals, get the latest extension date
  let expectedEnd = activeRental?.expected_end_datetime ?? null
  if (activeRental) {
    const { data: latestExt } = await supabase
      .from('rental_extensions')
      .select('extended_until')
      .eq('rental_id', activeRental.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latestExt) expectedEnd = latestExt.extended_until
  }

  // Derive effective status from rentals table (source of truth), not bikes.status which may lag
  const effectiveStatus = (activeRental || activeMonthly) ? 'rented' : bike.status
  const bikeWithStatus = { ...bike, status: effectiveStatus }

  const docMap = Object.fromEntries((docs ?? []).map(d => [d.doc_type, d]))

  return (
    <BikePublicClient
      bike={bikeWithStatus}
      docMap={docMap}
      settings={settings ?? null}
      pinError={searchParams.error === 'pin'}
      rentalInfo={activeRental ? { type: 'daily', expectedEnd } : null}
      monthlyInfo={activeMonthly ? { paymentDay: activeMonthly.payment_day } : null}
    />
  )
}
