import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import BikePublicClient from './BikePublicClient'

export const dynamic = 'force-dynamic'

export default async function BikePublicPage({ params }: { params: { bikeId: string } }) {
  const supabase = createAdminClient()

  const [{ data: bike }, { data: docs }] = await Promise.all([
    supabase
      .from('bikes')
      .select('id, license_plate, brand, model, year, color, photo_url, daily_rate, monthly_rate, deposit_amount, status, odometer')
      .eq('id', params.bikeId)
      .single(),
    supabase
      .from('bike_documents')
      .select('doc_type, doc_photo_url, expiry_date')
      .eq('bike_id', params.bikeId),
  ])

  if (!bike) notFound()

  const docMap = Object.fromEntries((docs ?? []).map(d => [d.doc_type, d]))

  return <BikePublicClient bike={bike} docMap={docMap} />
}
