import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveSingleBikeRate } from '@/lib/bikeCatalog'
import OwnerSendForm from './OwnerSendForm'

export const dynamic = 'force-dynamic'

export default async function OwnerSendPage({ params }: { params: Promise<{ bikeId: string }> }) {
  const { bikeId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()
  const { data: bike } = await admin
    .from('bikes')
    .select('id, license_plate, brand, model, color, year, branch_id, daily_rate, monthly_rate, deposit_amount, odometer, status')
    .eq('id', bikeId)
    .single()

  if (!bike) notFound()
  if (bike.status !== 'available') redirect(`/owner/bikes/${bikeId}`)

  const resolvedBike = await resolveSingleBikeRate(admin, bike)

  return <OwnerSendForm bike={resolvedBike} />
}
