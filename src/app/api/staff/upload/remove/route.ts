import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

// ชื่อไฟล์ที่ /api/staff/upload สร้าง: <folder>/<timestamp ms>_<random>.<ext>
const UPLOADED_NAME = /^(\d{13})_[a-z0-9]+\.(jpg|png)$/
const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000

// ลบรูปที่พนักงานเพิ่งอัพโหลดแล้วกดลบออกจากฟอร์ม — จำกัดเฉพาะไฟล์อายุไม่เกิน 24 ชม. กันลบหลักฐานเก่าที่ถูกใช้ไปแล้ว
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { path } = await request.json()
  if (typeof path !== 'string' || path.includes('..') || path.startsWith('/')) {
    return NextResponse.json({ error: 'path ไม่ถูกต้อง' }, { status: 400 })
  }
  const match = path.split('/').pop()?.match(UPLOADED_NAME)
  if (!match || Date.now() - Number(match[1]) > FRESH_WINDOW_MS) {
    return NextResponse.json({ error: 'ลบไม่ได้ — ไม่ใช่ไฟล์ที่เพิ่งอัพโหลด' }, { status: 400 })
  }

  const { error } = await createAdminClient().storage.from('rental-photo').remove([path])
  if (error) return NextResponse.json({ error: 'ลบไม่สำเร็จ' }, { status: 500 })
  return NextResponse.json({ success: true })
}
