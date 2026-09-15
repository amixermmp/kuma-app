import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PostersClient from './PostersClient'

export const dynamic = 'force-dynamic'

export default async function PostersSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()

  const [{ data: branches }, { data: bikes }, { data: posters }] = await Promise.all([
    admin.from('branches').select('id, name').order('name'),
    admin.from('bikes').select('branch_id, brand, model'),
    admin.from('availability_posters').select('id, branch_id, image_url, out_of_stock_models').order('created_at'),
  ])

  // รุ่นที่มีจริงต่อสาขา (เอาไว้ให้ติ๊กเลือกตอนแท็กรูป) — ไม่เอารุ่นซ้ำ
  const modelsByBranch: Record<string, string[]> = {}
  for (const b of bikes ?? []) {
    if (!b.branch_id) continue
    const key = `${b.brand}||${b.model}`
    if (!modelsByBranch[b.branch_id]) modelsByBranch[b.branch_id] = []
    if (!modelsByBranch[b.branch_id].includes(key)) modelsByBranch[b.branch_id].push(key)
  }
  for (const id in modelsByBranch) modelsByBranch[id].sort()

  return (
    <div className="app-wrap">
      <PostersClient
        branches={branches ?? []}
        modelsByBranch={modelsByBranch}
        posters={posters ?? []}
      />
    </div>
  )
}
