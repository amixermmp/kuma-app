import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import SettingsClient from './SettingsClient'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()

  const [shopRes, staffRes, branchRes, promoRes] = await Promise.all([
    admin.from('shop_settings').select('*').limit(1).maybeSingle(),
    admin.from('staff').select('id, name, pin, branch_id, is_active, branches(name)').order('name'),
    admin.from('branches').select('id, name').order('name'),
    admin.from('promotions').select('id, name, code, description, discount_type, discount_value, min_days, bonus_days, is_active').order('created_at'),
  ])

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
        <Link href="/owner/dashboard" className="app-header-back">←</Link>
        <div style={{ flex: 1 }}>
          <h1>ตั้งค่าระบบ</h1>
          <div className="sub">Owner — จัดการร้าน</div>
        </div>
        <div style={{ fontSize: '28px' }}>👑</div>
      </div>

      <SettingsClient
        shop={shopRes.data ?? {}}
        staff={(staffRes.data ?? []) as any[]}
        branches={branchRes.data ?? []}
        promotions={promoRes.data ?? []}
      />
    </div>
  )
}
