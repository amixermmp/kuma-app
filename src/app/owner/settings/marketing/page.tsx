import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import MarketingSettingsClient from './MarketingSettingsClient'

export const dynamic = 'force-dynamic'

export default async function MarketingSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()

  const [branchRes, branchAssetsRes] = await Promise.all([
    admin.from('branches').select('id, name').order('name'),
    admin.from('branch_settings').select('branch_id, frame_url, sticker_url'),
  ])

  return (
    <div className="app-wrap">
      <MarketingSettingsClient branches={branchRes.data ?? []} branchAssets={branchAssetsRes.data ?? []} />
    </div>
  )
}
