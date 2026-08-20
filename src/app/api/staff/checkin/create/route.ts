import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffOwnBranchId } from '@/lib/staffBranch'
import { logStaffAction } from '@/lib/log'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { photoUrl } = await request.json()
  if (!photoUrl) return NextResponse.json({ error: 'ไม่มีรูปถ่าย' }, { status: 400 })

  const branchId = await getStaffOwnBranchId(staffId)
  const supabase = createAdminClient()

  const { error } = await supabase.from('staff_checkins').insert({
    staff_id: staffId,
    branch_id: branchId,
    photo_url: photoUrl,
  })
  if (error) return NextResponse.json({ error: 'บันทึกไม่สำเร็จ: ' + error.message }, { status: 500 })

  await logStaffAction(staffId, 'staff_checkin', 'ลงทะเบียนเข้างาน')

  // เวลาไทยวันนี้ — คุกกี้นี้ให้ middleware เช็คว่าเช็คอินวันนี้แล้วหรือยัง ไม่ต้อง query DB ทุก request
  const H7 = 7 * 60 * 60 * 1000
  const todayStr = new Date(Date.now() + H7).toISOString().split('T')[0]

  const res = NextResponse.json({ success: true })
  res.cookies.set('kuma_checkin_date', todayStr, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 1 วัน
  })
  return res
}
