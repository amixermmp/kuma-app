import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

// API สาธารณะสำหรับเว็บหน้าร้าน (/api/public/web/*) — เรียกจาก "เซิร์ฟเวอร์ของเว็บ" เท่านั้นด้วยกุญแจลับใน header
// ลูกค้าไม่เคยเห็นกุญแจหรือที่อยู่ของแอปนี้ในเบราว์เซอร์ (เว็บเรียกฝั่งเซิร์ฟเวอร์ตัวเอง)
export function webApiGuard(request: Request): NextResponse | null {
  const secret = process.env.PUBLIC_WEB_SECRET
  const given = request.headers.get('x-web-secret')
  if (!secret || secret.length < 16) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }
  const a = Buffer.from(secret)
  const b = Buffer.from(given ?? '')
  if (!given || a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)
