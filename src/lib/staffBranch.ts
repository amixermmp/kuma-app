import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Returns the staff member's own branch_id (the branch they belong to).
 * Used when creating records that must be tagged to a specific branch.
 * Throws if staffId is invalid.
 */
export async function getStaffOwnBranchId(staffId: string): Promise<string> {
  const admin = createAdminClient()
  const { data } = await admin.from('staff').select('branch_id, allowed_branch_ids').eq('id', staffId).single()
  if (data?.branch_id) return data.branch_id
  // Fallback: use first allowed branch if branch_id is not set
  const ids = data?.allowed_branch_ids
  if (Array.isArray(ids) && ids.length > 0) return ids[0]
  throw new Error('Staff has no branch_id')
}

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
