import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import MarketingClient, { MarketingPhoto } from './MarketingClient'

export const dynamic = 'force-dynamic'

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const { branch = '' } = await searchParams

  const admin = createAdminClient()

  const [{ data: branches }, { data: settingsRows }] = await Promise.all([
    admin.from('branches').select('id, name').order('name'),
    admin.from('branch_settings').select('branch_id, frame_url'),
  ])

  let q = admin.from('marketing_photos')
    .select('id, branch_id, original_photo_url, processed_photo_url, sticker_x, sticker_y, created_at')
    .order('created_at', { ascending: false })
  if (branch) q = q.eq('branch_id', branch)
  const { data: rows } = await q

  const photos: MarketingPhoto[] = (rows ?? []).map(r => ({
    id: r.id,
    branchId: r.branch_id,
    originalUrl: r.original_photo_url,
    processedUrl: r.processed_photo_url,
    stickerX: r.sticker_x,
    stickerY: r.sticker_y,
    createdAt: r.created_at,
  }))

  const branchHasFrame = new Set((settingsRows ?? []).filter(s => s.frame_url).map(s => s.branch_id))

  return (
    <MarketingClient
      photos={photos}
      branches={branches ?? []}
      branch={branch}
      branchHasFrame={Array.from(branchHasFrame)}
    />
  )
}
