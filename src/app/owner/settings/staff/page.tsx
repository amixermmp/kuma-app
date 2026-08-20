import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import StaffClient from './StaffClient'

export const dynamic = 'force-dynamic'

export default async function StaffSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()

  const [staffRes, branchRes] = await Promise.all([
    admin.from('staff').select('id, name, pin, branch_id, allowed_branch_ids, is_active, branches(name)').order('name'),
    admin.from('branches').select('id, name').order('name'),
  ])

  return (
    <div className="app-wrap">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <StaffClient staff={(staffRes.data ?? []) as any[]} branches={branchRes.data ?? []} />
    </div>
  )
}
