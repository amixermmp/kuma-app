import { createAdminClient } from '@/lib/supabase/admin'
import sharp from 'sharp'

const MAX_PER_BRANCH = 50

// คัดลอกรูปคู่รถ (with_bike) เข้าคิวโปรโมทแยกต่างหากทันทีตอนสร้างสัญญา — กันโดนลบตอนคืนรถ
// (send_photos ถูกลบทิ้งอัตโนมัติเมื่อคืนรถ) หมุนเวียนสูงสุด 50 รูปต่อสาขา ตัวเก่าสุดหลุดออกเมื่อเกิน
export async function queueMarketingPhoto(
  supabase: ReturnType<typeof createAdminClient>,
  branchId: string,
  rentalId: string,
  rentalType: 'daily' | 'monthly',
  withBikePhotoUrl: string | undefined | null
) {
  if (!withBikePhotoUrl) return

  await supabase.from('marketing_photos').insert({
    branch_id: branchId,
    rental_id: rentalId,
    rental_type: rentalType,
    original_photo_url: withBikePhotoUrl,
  })

  const { data: rows } = await supabase
    .from('marketing_photos')
    .select('id')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })

  const overflow = (rows ?? []).slice(MAX_PER_BRANCH)
  if (overflow.length > 0) {
    await supabase.from('marketing_photos').delete().in('id', overflow.map(r => r.id))
  }
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('โหลดรูปไม่สำเร็จ: ' + url)
  return Buffer.from(await res.arrayBuffer())
}

// ให้ Gemini เดาตำแหน่งใบหน้าในรูปคู่รถ — คืนพิกัดสัดส่วน 0-1 ของขนาดรูป สูงสุด 2 คน (ว่างถ้าไม่เจอหน้าคนเลย เช่น ถ่ายแค่รถ)
export async function detectFacePositions(imageUrl: string): Promise<{ x: number; y: number }[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return []

  try {
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) return []
    const imgBuffer = await imgRes.arrayBuffer()
    const base64 = Buffer.from(imgBuffer).toString('base64')
    const mimeType = imgRes.headers.get('content-type') || 'image/jpeg'

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `นี่คือรูปถ่ายลูกค้ายืนคู่รถมอเตอร์ไซค์เช่า กรุณาหาตำแหน่งใบหน้าคนในรูป (ถ้ามีมากกว่า 2 คน เอาแค่ 2 คนที่เห็นหน้าชัดที่สุด)
ตอบเป็น JSON array เท่านั้น พิกัดเป็นสัดส่วน 0-1 ของขนาดรูป (0,0 คือมุมซ้ายบน) แต่ละจุดคือจุดกึ่งกลางใบหน้าคนนั้น เช่น: [{"x":0.3,"y":0.4},{"x":0.7,"y":0.4}]
ถ้าไม่เจอใบหน้าคนเลยในรูป (เช่นถ่ายแค่ตัวรถ) ตอบ: []`,
              },
              { inline_data: { mime_type: mimeType, data: base64 } },
            ],
          }],
          generationConfig: { temperature: 0 },
        }),
      }
    )
    if (!geminiRes.ok) return []

    const geminiData = await geminiRes.json()
    const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return []
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((p): p is { x: number; y: number } => typeof p?.x === 'number' && typeof p?.y === 'number')
      .slice(0, 2)
  } catch {
    return []
  }
}

// ประกอบรูปสุดท้าย: รูปคู่รถ (ครอปให้เต็มขนาดกรอบ) + สติ๊กเกอร์ปิดหน้า (ถ้ามีตำแหน่ง สูงสุด 2 จุด) + กรอบสาขาทับบนสุด
export async function compositeMarketingPhoto(
  originalUrl: string,
  frameUrl: string,
  stickerUrl: string | null,
  stickerPositions: { x: number; y: number }[],
): Promise<Buffer> {
  const [originalBuf, frameBuf, stickerBuf] = await Promise.all([
    fetchBuffer(originalUrl),
    fetchBuffer(frameUrl),
    stickerUrl ? fetchBuffer(stickerUrl) : Promise.resolve(null),
  ])

  const frameMeta = await sharp(frameBuf).metadata()
  const W = frameMeta.width ?? 1080
  const H = frameMeta.height ?? 1080

  const photoResized = await sharp(originalBuf).resize(W, H, { fit: 'cover' }).toBuffer()

  const composites: { input: Buffer; left: number; top: number }[] = []

  if (stickerBuf && stickerPositions.length > 0) {
    const stickerMeta = await sharp(stickerBuf).metadata()
    const stickerW = Math.round(W * 0.22)
    const ratio = (stickerMeta.height ?? 1) / (stickerMeta.width ?? 1)
    const stickerH = Math.round(stickerW * ratio)
    const stickerResized = await sharp(stickerBuf).resize(stickerW, stickerH).toBuffer()
    for (const pos of stickerPositions) {
      composites.push({
        input: stickerResized,
        left: Math.round(pos.x * W - stickerW / 2),
        top: Math.round(pos.y * H - stickerH / 2),
      })
    }
  }

  composites.push({ input: frameBuf, left: 0, top: 0 })

  return sharp(photoResized).composite(composites).jpeg({ quality: 90 }).toBuffer()
}
