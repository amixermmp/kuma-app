import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import RepairDoneForm from './RepairDoneForm'

export const dynamic = 'force-dynamic'

export default async function RepairDonePage({ params }: { params: { repairId: string } }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()
  const { data: repair } = await supabase
    .from('repairs')
    .select('id, description, severity, status, location_note, photo_url, created_at, bikes(id, license_plate, brand, model)')
    .eq('id', params.repairId)
    .single()

  if (!repair || repair.status === 'done') redirect('/staff/jobs')

  return <RepairDoneForm repair={repair as any} staffId={staffId} />
}
