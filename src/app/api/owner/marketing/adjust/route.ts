import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { compositeMarketingPhoto, uploadMarketingResult, storagePathOf } from '@/lib/marketingPhotos'
import { getMarketingAccess, canTouchPhoto } from '@/lib/marketingAuth'

// ปรับตำแหน่งสติ๊กเกอร์ปิดหน้าเอง (แตะทีละจุด สูงสุด 2 จุด) แล้วประกอบรูปใหม่ — ใช้ตอน AI เดาตำแหน่งเบี้ยว
// สาขาที่ตั้งกรอบรวมไว้ด้วย จะประกอบกรอบรวมใหม่ด้วยตำแหน่งและการครอปเดียวกันพร้อมกัน
export async function POST(request: Request) {
  const access = await getMarketingAccess()
  if (!access.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { photoId, positions, cropPos } = await request.json()
  const valid = Array.isArray(positions) && positions.length <= 2
    && positions.every((p: unknown) => typeof (p as { x?: unknown })?.x === 'number' && typeof (p as { y?: unknown })?.y === 'number')
  if (!photoId || !valid) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }
  const stickerPositions: { x: number; y: number }[] = positions

  const admin = createAdminClient()

  const { data: photo } = await admin.from('marketing_photos').select('id, branch_id, original_photo_url, processed_photo_url, processed_photo_url_2').eq('id', photoId).single()
  if (!photo || !canTouchPhoto(access, photo.branch_id)) return NextResponse.json({ error: 'ไม่พบรูป' }, { status: 404 })

  const { data: settings } = await admin.from('branch_settings').select('frame_url, frame2_url, sticker_url').eq('branch_id', photo.branch_id).maybeSingle()
  if (!settings?.frame_url) return NextResponse.json({ error: 'ยังไม่ได้อัปโหลดกรอบของสาขานี้' }, { status: 400 })

  const crop = typeof cropPos === 'number' ? cropPos : 0.5

  let outputBuf: Buffer
  let outputBuf2: Buffer | null = null
  try {
    outputBuf = await compositeMarketingPhoto(
      photo.original_photo_url, settings.frame_url, settings.sticker_url, stickerPositions, crop,
    )
    if (settings.frame2_url) {
      outputBuf2 = await compositeMarketingPhoto(
        photo.original_photo_url, settings.frame2_url, settings.sticker_url, stickerPositions, crop,
      )
    }
  } catch (e) {
    return NextResponse.json({ error: 'ประมวลผลรูปไม่สำเร็จ', detail: String(e) }, { status: 500 })
  }

  let uploaded1: { path: string; url: string }
  let uploaded2: { path: string; url: string } | null = null
  try {
    uploaded1 = await uploadMarketingResult(admin, photoId, outputBuf)
    if (outputBuf2) {
      try {
        uploaded2 = await uploadMarketingResult(admin, photoId, outputBuf2, '_b')
      } catch (e) {
        await admin.storage.from('rental-photo').remove([uploaded1.path])
        throw e
      }
    }
  } catch (e) {
    return NextResponse.json({ error: 'บันทึกรูปไม่สำเร็จ', detail: String(e) }, { status: 500 })
  }

  await admin.from('marketing_photos').update({
    processed_photo_url: uploaded1.url,
    processed_photo_url_2: uploaded2?.url ?? null,
    sticker_x: stickerPositions[0]?.x ?? null, sticker_y: stickerPositions[0]?.y ?? null,
    sticker_x2: stickerPositions[1]?.x ?? null, sticker_y2: stickerPositions[1]?.y ?? null,
  }).eq('id', photoId)

  // เวอร์ชันที่ประมวลผลก่อนหน้าไม่มีใครอ้างถึงแล้ว — ลบทิ้ง ไม่งั้นทุกครั้งที่ปรับตำแหน่งจะมีไฟล์ค้างเพิ่ม
  const old1 = storagePathOf(photo.processed_photo_url)
  const old2 = storagePathOf(photo.processed_photo_url_2)
  const oldPaths = [
    old1 && old1 !== uploaded1.path ? old1 : null,
    old2 && old2 !== (uploaded2?.path ?? null) ? old2 : null,
  ].filter((p): p is string => !!p)
  if (oldPaths.length > 0) await admin.storage.from('rental-photo').remove(oldPaths)

  return NextResponse.json({
    success: true, processedUrl: uploaded1.url, processedUrl2: uploaded2?.url ?? null,
    stickerX: stickerPositions[0]?.x ?? null, stickerY: stickerPositions[0]?.y ?? null,
    stickerX2: stickerPositions[1]?.x ?? null, stickerY2: stickerPositions[1]?.y ?? null,
  })
}
