import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { detectFacePositions, compositeMarketingPhoto, uploadMarketingResult, storagePathOf } from '@/lib/marketingPhotos'
import { getMarketingAccess, canTouchPhoto } from '@/lib/marketingAuth'

export async function POST(request: Request) {
  const access = await getMarketingAccess()
  if (!access.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // onlySecond = รูปนี้ทำกรอบสาขาไว้แล้ว ขอทำเฉพาะกรอบที่ 2 (กรอบรวม) เพิ่ม — ใช้ตำแหน่งสติ๊กเกอร์ที่บันทึกไว้ ไม่ให้ AI เดาใหม่ และไม่แตะรูปกรอบสาขาเดิม
  const { photoId, onlySecond } = await request.json()
  if (!photoId) return NextResponse.json({ error: 'Missing photoId' }, { status: 400 })

  const admin = createAdminClient()

  const { data: photo } = await admin.from('marketing_photos')
    .select('id, branch_id, original_photo_url, processed_photo_url, processed_photo_url_2, sticker_x, sticker_y, sticker_x2, sticker_y2')
    .eq('id', photoId).single()
  if (!photo || !canTouchPhoto(access, photo.branch_id)) return NextResponse.json({ error: 'ไม่พบรูป' }, { status: 404 })

  const { data: settings } = await admin.from('branch_settings').select('frame_url, frame2_url, sticker_url').eq('branch_id', photo.branch_id).maybeSingle()

  if (onlySecond) {
    if (!settings?.frame2_url) return NextResponse.json({ error: 'สาขานี้ยังไม่ได้อัปโหลดกรอบรวม' }, { status: 400 })
    const saved: { x: number; y: number }[] = []
    if (photo.sticker_x != null && photo.sticker_y != null) saved.push({ x: photo.sticker_x, y: photo.sticker_y })
    if (photo.sticker_x2 != null && photo.sticker_y2 != null) saved.push({ x: photo.sticker_x2, y: photo.sticker_y2 })

    let uploaded2: { path: string; url: string }
    try {
      const buf2 = await compositeMarketingPhoto(photo.original_photo_url, settings.frame2_url, settings.sticker_url, saved)
      uploaded2 = await uploadMarketingResult(admin, photoId, buf2, '_b')
    } catch (e) {
      return NextResponse.json({ error: 'ประมวลผลรูปไม่สำเร็จ', detail: String(e) }, { status: 500 })
    }
    await admin.from('marketing_photos').update({ processed_photo_url_2: uploaded2.url }).eq('id', photoId)
    const old2 = storagePathOf(photo.processed_photo_url_2)
    if (old2 && old2 !== uploaded2.path) await admin.storage.from('rental-photo').remove([old2])
    return NextResponse.json({ success: true, processedUrl2: uploaded2.url })
  }

  if (!settings?.frame_url) {
    return NextResponse.json({ error: 'ยังไม่ได้อัปโหลดกรอบของสาขานี้ — ตั้งค่าที่หน้า Settings ก่อน' }, { status: 400 })
  }

  const faces = settings.sticker_url ? await detectFacePositions(photo.original_photo_url) : []

  // ประกอบทั้งสองกรอบก่อนอัปโหลด — ถ้าอันไหนพังจะไม่มีไฟล์ค้างครึ่งๆ กลางๆ
  let outputBuf: Buffer
  let outputBuf2: Buffer | null = null
  try {
    outputBuf = await compositeMarketingPhoto(
      photo.original_photo_url, settings.frame_url, settings.sticker_url, faces,
    )
    if (settings.frame2_url) {
      outputBuf2 = await compositeMarketingPhoto(photo.original_photo_url, settings.frame2_url, settings.sticker_url, faces)
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
    sticker_x: faces[0]?.x ?? null,
    sticker_y: faces[0]?.y ?? null,
    sticker_x2: faces[1]?.x ?? null,
    sticker_y2: faces[1]?.y ?? null,
  }).eq('id', photoId)

  // เวอร์ชันที่ประมวลผลก่อนหน้าไม่มีใครอ้างถึงแล้ว — ลบทิ้ง ไม่งั้นทุกครั้งที่ประมวลผลซ้ำจะมีไฟล์ค้างเพิ่ม
  const oldPaths = [
    storagePathOf(photo.processed_photo_url) !== uploaded1.path ? storagePathOf(photo.processed_photo_url) : null,
    storagePathOf(photo.processed_photo_url_2) !== (uploaded2?.path ?? null) ? storagePathOf(photo.processed_photo_url_2) : null,
  ].filter((p): p is string => !!p)
  if (oldPaths.length > 0) await admin.storage.from('rental-photo').remove(oldPaths)

  return NextResponse.json({
    success: true, processedUrl: uploaded1.url, processedUrl2: uploaded2?.url ?? null,
    stickerX: faces[0]?.x ?? null, stickerY: faces[0]?.y ?? null,
    stickerX2: faces[1]?.x ?? null, stickerY2: faces[1]?.y ?? null,
  })
}
