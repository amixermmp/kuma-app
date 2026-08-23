import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getShopOverviewGroups } from '@/lib/shopOverview'
import { BranchSelector } from './BranchSelector'
import OverviewClient from './OverviewClient'

export const dynamic = 'force-dynamic'

export default async function OwnerOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const { branch = '' } = await searchParams

  const admin = createAdminClient()
  const { data: branches } = await admin.from('branches').select('id, name').order('name')

  const groups = await getShopOverviewGroups(admin, branch ? [branch] : null)

  return (
    <div className="app-wrap" style={{ background: '#0f172a' }}>
      <div className="app-header" style={{ background: '#0f172a', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <Link href="/owner/dashboard" className="app-header-back">←</Link>
        <div style={{ flex: 1 }}>
          <h1>ภาพรวมร้าน</h1>
          <div className="sub">สถานะรถทั้งร้าน แยกตามหมวด</div>
        </div>
      </div>

      <BranchSelector branches={branches ?? []} current={branch} />

      <OverviewClient groups={groups} showBranchName={!branch} />
    </div>
  )
}
