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
    admin.from('branch_settings').select('branch_id, close_time_earliest, payment_qr_daily_url, payment_qr_monthly_url'),
  ])

  const settingsMap = new Map((branchSettingsRes.data ?? []).map(b => [b.branch_id, b]))
  const branches = (branchRes.data ?? []).map(b => {
    const s = settingsMap.get(b.id)
    return {
      ...b,
      closeTimeEarliest: s?.close_time_earliest ?? null,
      paymentQrDailyUrl: s?.payment_qr_daily_url ?? null,
      paymentQrMonthlyUrl: s?.payment_qr_monthly_url ?? null,
    }
  })

  return (
    <div className="app-wrap">
      <ShopClient shop={shopRes.data ?? {}} branches={branches} />
    </div>
  )
}
