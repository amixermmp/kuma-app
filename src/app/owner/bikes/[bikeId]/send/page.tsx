import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
    .select('id, license_plate, brand, model, color, year, daily_rate, deposit_amount, odometer, status')
    .eq('id', bikeId)
    .single()

  if (!bike) notFound()
  if (bike.status !== 'available') redirect(`/owner/bikes/${bikeId}`)

  return <OwnerSendForm bike={bike} />
}
