import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AddBikeForm from './AddBikeForm'

export const dynamic = 'force-dynamic'

export default async function AddBikePage() {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  return <AddBikeForm staffId={staffId} />
}
