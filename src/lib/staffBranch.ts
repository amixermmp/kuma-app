import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Returns allowed_branch_ids for a staff member.
 * null = no restriction (see all branches)
 * string[] = only see these branches
 */
export async function getStaffBranchIds(staffId: string): Promise<string[] | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('staff').select('allowed_branch_ids').eq('id', staffId).single()
  const ids = data?.allowed_branch_ids
  return Array.isArray(ids) && ids.length > 0 ? ids : null
}

/**
 * Returns bike IDs that belong to the allowed branches.
 * null = no restriction
 */
export async function getAllowedBikeIds(allowedBranchIds: string[] | null): Promise<string[] | null> {
  if (!allowedBranchIds) return null
  const admin = createAdminClient()
  const { data } = await admin.from('bikes').select('id').in('branch_id', allowedBranchIds)
  return data?.map(b => b.id) ?? []
}
