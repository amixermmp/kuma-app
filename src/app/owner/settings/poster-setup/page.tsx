import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { SettingsHeader } from '../_shared'

export const dynamic = 'force-dynamic'

export default async function PosterSetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()

  const [{ data: branches }, { data: branchSettings }, { data: hotspots }] = await Promise.all([
    admin.from('branches').select('id, name').order('name'),
    admin.from('branch_settings').select('branch_id, poster_template_url'),
    admin.from('poster_hotspots').select('branch_id'),
  ])

  const templateByBranch = new Map((branchSettings ?? []).map(b => [b.branch_id, b.poster_template_url]))
  const hotspotCountByBranch: Record<string, number> = {}
  for (const h of hotspots ?? []) hotspotCountByBranch[h.branch_id] = (hotspotCountByBranch[h.branch_id] ?? 0) + 1

  return (
    <div className="app-wrap">
      <SettingsHeader title="🖼️ โปสเตอร์รถว่าง" sub="อัพโหลดรูปต้นฉบับ + ตั้งตำแหน่งรุ่น ครั้งเดียวต่อสาขา" />
      <div style={{ padding: '12px 16px 40px' }}>
        {(branches ?? []).map(b => {
          const hasTemplate = !!templateByBranch.get(b.id)
          return (
            <Link key={b.id} href={`/owner/settings/poster-setup/${b.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '12px',
                padding: '14px', marginBottom: '10px',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>📍 {b.name}</div>
                  <div style={{ fontSize: '12px', color: hasTemplate ? '#16a34a' : '#9ca3af', marginTop: '2px' }}>
                    {hasTemplate ? `✅ ตั้งค่าแล้ว (${hotspotCountByBranch[b.id] ?? 0} ตำแหน่ง)` : '⚠️ ยังไม่ได้ตั้งค่า'}
                  </div>
                </div>
                <div style={{ color: '#d1d5db', fontSize: '18px' }}>›</div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
