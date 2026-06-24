import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import BrokenForm from './BrokenForm'

export const dynamic = 'force-dynamic'

export default async function BrokenPage({ params }: { params: { bikeId: string } }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()
  const { data: bike } = await supabase
    .from('bikes')
    .select('id, license_plate, brand, model, status')
    .eq('id', params.bikeId)
    .single()

  if (!bike) redirect('/staff/broken')

  return <BrokenForm bike={bike} staffId={staffId} />
}
