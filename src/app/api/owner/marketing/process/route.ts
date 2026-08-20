import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { detectFacePosition, compositeMarketingPhoto } from '@/lib/marketingPhotos'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { photoId } = await request.json()
  if (!photoId) return NextResponse.json({ error: 'Missing photoId' }, { status: 400 })

  const admin = createAdminClient()

  const { data: photo } = await admin.from('marketing_photos').select('id, branch_id, original_photo_url').eq('id', photoId).single()
  if (!photo) return NextResponse.json({ error: 'ไม่พบรูป' }, { status: 404 })

  const { data: settings } = await admin.from('branch_settings').select('frame_url, sticker_url').eq('branch_id', photo.branch_id).maybeSingle()
  if (!settings?.frame_url) {
    return NextResponse.json({ error: 'ยังไม่ได้อัปโหลดกรอบของสาขานี้ — ตั้งค่าที่หน้า Settings ก่อน' }, { status: 400 })
  }

  const face = settings.sticker_url ? await detectFacePosition(photo.original_photo_url) : null

  let outputBuf: Buffer
  try {
    outputBuf = await compositeMarketingPhoto(
      photo.original_photo_url, settings.frame_url, settings.sticker_url,
      face?.x ?? null, face?.y ?? null,
    )
  } catch (e) {
    return NextResponse.json({ error: 'ประมวลผลรูปไม่สำเร็จ', detail: String(e) }, { status: 500 })
  }

  const filename = `marketing/${photoId}_${Date.now()}.jpg`
  const { data: uploaded, error: upErr } = await admin.storage.from('rental-photo').upload(filename, outputBuf, { contentType: 'image/jpeg', upsert: false })
  if (upErr || !uploaded) return NextResponse.json({ error: 'บันทึกรูปไม่สำเร็จ', detail: upErr?.message }, { status: 500 })

  const { data: signed } = await admin.storage.from('rental-photo').createSignedUrl(uploaded.path, 60 * 60 * 24 * 365)
  const processedUrl = signed?.signedUrl ?? ''

  await admin.from('marketing_photos').update({
    processed_photo_url: processedUrl,
    sticker_x: face?.x ?? null,
    sticker_y: face?.y ?? null,
  }).eq('id', photoId)

  return NextResponse.json({ success: true, processedUrl, stickerX: face?.x ?? null, stickerY: face?.y ?? null })
}
