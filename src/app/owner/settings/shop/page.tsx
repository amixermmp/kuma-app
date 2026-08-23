import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ShopClient from './ShopClient'

export const dynamic = 'force-dynamic'

export default async function ShopSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()

  const [shopRes, branchRes, branchSettingsRes] = await Promise.all([
    admin.from('shop_settings').select('*').limit(1).maybeSingle(),
    admin.from('branches').select('id, name').order('name'),
    admin.from('branch_settings').select('branch_id, close_time_earliest'),
  ])

  const closeTimeMap = new Map((branchSettingsRes.data ?? []).map(b => [b.branch_id, b.close_time_earliest]))
  const branches = (branchRes.data ?? []).map(b => ({ ...b, closeTimeEarliest: closeTimeMap.get(b.id) ?? null }))

  return (
    <div className="app-wrap">
      <ShopClient shop={shopRes.data ?? {}} branches={branches} />
    </div>
  )
}
