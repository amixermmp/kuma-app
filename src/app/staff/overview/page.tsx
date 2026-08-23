import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds } from '@/lib/staffBranch'
import { getShopOverviewGroups } from '@/lib/shopOverview'
import OverviewClient from './OverviewClient'

export const dynamic = 'force-dynamic'

export default async function StaffOverviewPage() {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()
  const allowedBranchIds = await getStaffBranchIds(staffId)

  const groups = await getShopOverviewGroups(supabase, allowedBranchIds)

  let branchName = 'ทุกสาขา'
  if (allowedBranchIds) {
    const { data: branches } = await supabase.from('branches').select('name').in('id', allowedBranchIds)
    branchName = branches?.map(b => b.name).join(', ') ?? 'สาขา'
  }

  return <OverviewClient groups={groups} branchName={branchName} />
}
