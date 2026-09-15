import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { SettingsHeader } from '../_shared'

export const dynamic = 'force-dynamic'

export default async function PostersSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()

  const [{ data: branches }, { data: posters }] = await Promise.all([
    admin.from('branches').select('id, name').order('name'),
    admin.from('availability_posters').select('branch_id'),
  ])

  const countByBranch: Record<string, number> = {}
  for (const p of posters ?? []) {
    countByBranch[p.branch_id] = (countByBranch[p.branch_id] ?? 0) + 1
  }

  return (
    <div className="app-wrap">
      <SettingsHeader title="🖼️ โปสเตอร์รถว่าง" sub="เลือกสาขาเพื่อจัดการโปสเตอร์" />
      <div style={{ padding: '12px 16px 40px' }}>
        {(branches ?? []).map(b => (
          <Link key={b.id} href={`/owner/settings/posters/${b.id}`} style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '12px',
              padding: '14px', marginBottom: '10px',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>📍 {b.name}</div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                  {countByBranch[b.id] ?? 0} รูป
                </div>
              </div>
              <div style={{ color: '#d1d5db', fontSize: '18px' }}>›</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
