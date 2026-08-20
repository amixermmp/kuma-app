import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import NotificationsClient from './NotificationsClient'

export const dynamic = 'force-dynamic'

export default async function NotificationsSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()

  const [shopRes, branchRes, branchLineRes] = await Promise.all([
    admin.from('shop_settings').select('*').limit(1).maybeSingle(),
    admin.from('branches').select('id, name').order('name'),
    admin.from('branch_settings').select('branch_id, line_token, line_liff_id, promptpay_id, line_notify_customer'),
  ])

  return (
    <div className="app-wrap">
      <NotificationsClient
        shop={shopRes.data ?? {}}
        branches={branchRes.data ?? []}
        branchLine={branchLineRes.data ?? []}
      />
    </div>
  )
}
