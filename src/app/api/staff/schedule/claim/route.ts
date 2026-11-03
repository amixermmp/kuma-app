import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffOwnBranchId } from '@/lib/staffBranch'
import { claimScheduleShift } from '@/lib/schedule'
import { logStaffAction } from '@/lib/log'

// พนักงานกด "ลงงานนี้" — ใครไวได้ก่อน ลงแล้วยกเลิกเองไม่ได้ (ถอนต้องใช้ระบบลา)
// ใช้ได้แม้ยังไม่เช็คอิน (โหมด "ดูตารางอย่างเดียว") — เส้นทาง /api ไม่ผ่านด่านเช็คอิน และการลงงานไม่ต้องใช้สิทธิ์ทำงานหน้าร้าน
export async function POST(request: NextRequest) {
  const staffId = (await cookies()).get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { day } = await request.json().catch(() => ({}))
  let branchId: string
  try {
    branchId = await getStaffOwnBranchId(staffId)
  } catch {
    return NextResponse.json({ error: 'ไม่พบสาขาของพนักงาน' }, { status: 400 })
  }

  const result = await claimScheduleShift(createAdminClient(), staffId, branchId, day)
  if ('error' in result) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.code === 'full' || result.code === 'dup' ? 409 : 400 })
  }
  await logStaffAction(staffId, 'schedule_claim', `ลงงานที่ว่างวันที่ ${day}`, { day, branchId })
  return NextResponse.json({ success: true })
}
