import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds, getAllowedBikeIds, getStaffOwnBranchId } from '@/lib/staffBranch'
import { loadQuestBoard } from '@/lib/questItems'
import QuestsClient from './QuestsClient'

export const dynamic = 'force-dynamic'

export default async function StaffQuestsPage() {
  const staffId = (await cookies()).get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  let ownBranchId: string
  try {
    ownBranchId = await getStaffOwnBranchId(staffId)
  } catch {
    redirect('/staff/login')
  }

  const supabase = createAdminClient()
  const allowedBranchIds = await getStaffBranchIds(staffId)
  const allowedBikeIds = await getAllowedBikeIds(allowedBranchIds)
  const board = await loadQuestBoard(supabase, { allowedBranchIds, allowedBikeIds, ownBranchId })

  return <QuestsClient board={board} />
}
