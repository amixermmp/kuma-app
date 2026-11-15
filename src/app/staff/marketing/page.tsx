import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffOwnBranchId } from '@/lib/staffBranch'
import MarketingClient, { MarketingPhoto } from '@/app/owner/marketing/MarketingClient'

export const dynamic = 'force-dynamic'

// รูปโปรโมทฝั่งพนักงาน — หน้าตาและการทำงานเหมือนฝั่งโอนเนอร์ แต่เห็นเฉพาะสาขาของพนักงานเอง
export default async function StaffMarketingPage() {
  const staffId = (await cookies()).get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  let branchId: string
  try {
    branchId = await getStaffOwnBranchId(staffId)
  } catch {
    redirect('/staff/login')
  }

  const admin = createAdminClient()

  const [{ data: rows }, { data: settings }] = await Promise.all([
    admin.from('marketing_photos')
      .select('id, branch_id, original_photo_url, processed_photo_url, processed_photo_url_2, sticker_x, sticker_y, sticker_x2, sticker_y2, created_at')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false }),
    admin.from('branch_settings').select('frame_url, frame2_url, caption_facebook, caption_instagram, caption_tiktok').eq('branch_id', branchId).maybeSingle(),
  ])

  const photos: MarketingPhoto[] = (rows ?? []).map(r => ({
    id: r.id,
    branchId: r.branch_id,
    originalUrl: r.original_photo_url,
    processedUrl: r.processed_photo_url,
    processedUrl2: r.processed_photo_url_2,
    stickerX: r.sticker_x,
    stickerY: r.sticker_y,
    stickerX2: r.sticker_x2,
    stickerY2: r.sticker_y2,
    createdAt: r.created_at,
  }))

  return (
    <MarketingClient
      photos={photos}
      branches={[]}
      branch={branchId}
      branchHasFrame={settings?.frame_url ? [branchId] : []}
      branchHasFrame2={settings?.frame2_url ? [branchId] : []}
      captions={{
        facebook: settings?.caption_facebook ?? '',
        instagram: settings?.caption_instagram ?? '',
        tiktok: settings?.caption_tiktok ?? '',
      }}
      staffMode
    />
  )
}
