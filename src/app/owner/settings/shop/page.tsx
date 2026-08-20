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

  const [shopRes, branchRes] = await Promise.all([
    admin.from('shop_settings').select('*').limit(1).maybeSingle(),
    admin.from('branches').select('id, name').order('name'),
  ])

  return (
    <div className="app-wrap">
      <ShopClient shop={shopRes.data ?? {}} branches={branchRes.data ?? []} />
    </div>
  )
}
