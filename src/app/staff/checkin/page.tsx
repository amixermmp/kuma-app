import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import CheckinForm from './CheckinForm'

export const dynamic = 'force-dynamic'

export default async function StaffCheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const { redirect: redirectTo } = await searchParams

  const supabase = createAdminClient()
  const { data: staffRow } = await supabase.from('staff').select('name, branches(name)').eq('id', staffId).single()
  const staffName = staffRow?.name ?? 'Staff'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const branchName = (staffRow as any)?.branches?.name ?? 'Kuma Bikes'

  return (
    <CheckinForm staffName={staffName} branchName={branchName} redirectTo={redirectTo || '/staff/home'} />
  )
}
