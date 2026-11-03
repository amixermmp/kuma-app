import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffOwnBranchId } from '@/lib/staffBranch'
import { getCheckinMode } from '@/lib/schedule'
import { bkkDateStr } from '@/lib/scheduleCalc'

// "ดูตารางอย่างเดียว" — คนที่มีแบบแผนแต่วันนี้ไม่มีงาน เข้าดูปฏิทินงานได้โดยไม่ต้องเช็คอิน
// ตั้งคุกกี้ที่ด่านใน middleware ยอมให้เฉพาะหน้า /staff/schedule เท่านั้น (หน้าอื่นยังเด้งไปเช็คอินเหมือนเดิม)
// ตรวจฝั่งเซิร์ฟเวอร์ว่าเป็นคน "ไม่มีงานวันนี้" จริง — คนที่มีงานหรือคนที่ไม่มีแบบแผนใช้ช่องทางนี้ข้ามเช็คอินไม่ได้
export async function POST() {
  const staffId = (await cookies()).get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let branchId: string
  try {
    branchId = await getStaffOwnBranchId(staffId)
  } catch {
    return NextResponse.json({ error: 'ไม่พบสาขาของพนักงาน' }, { status: 400 })
  }
  const today = bkkDateStr()
  const mode = await getCheckinMode(createAdminClient(), staffId, branchId, today)
  if (mode !== 'off_shift') return NextResponse.json({ error: 'วันนี้ต้องเช็คอินเข้างานตามปกติ' }, { status: 403 })

  const res = NextResponse.json({ success: true })
  res.cookies.set('kuma_schedule_view', `${staffId}:${today}`, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24,
  })
  return res
}
