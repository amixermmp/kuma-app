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

  const supabase = createAdminClient()

  // เวลาไทยวันนี้ — คุกกี้นี้ให้ middleware เช็คว่าเช็คอินวันนี้แล้วหรือยัง ไม่ต้อง query DB ทุก request
  const H7 = 7 * 60 * 60 * 1000
  const bkkNow = new Date(Date.now() + H7)
  const todayStr = bkkNow.toISOString().split('T')[0]
  const todayStartIso = new Date(Date.UTC(bkkNow.getUTCFullYear(), bkkNow.getUTCMonth(), bkkNow.getUTCDate()) - H7).toISOString()

  // กันเช็คอินซ้ำ — คุกกี้ฝั่ง browser เชื่อไม่ได้ 100% (คนละอุปกรณ์/เบราว์เซอร์ในแอปไลน์คุกกี้ไม่ค้าง)
  // ต้องเช็คที่ฐานข้อมูลจริงเป็นหลัก ไม่ให้ถ่ายซ้ำได้เรื่อยๆ ในวันเดียวกัน
  const { data: already } = await supabase
    .from('staff_checkins')
    .select('checked_in_at')
    .eq('staff_id', staffId)
    .gte('checked_in_at', todayStartIso)
    .order('checked_in_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!already) {
    if (!photoUrl) return NextResponse.json({ error: 'ไม่มีรูปถ่าย' }, { status: 400 })
    const branchId = await getStaffOwnBranchId(staffId)
    const { error } = await supabase.from('staff_checkins').insert({
      staff_id: staffId,
      branch_id: branchId,
      photo_url: photoUrl,
    })
    if (error) return NextResponse.json({ error: 'บันทึกไม่สำเร็จ: ' + error.message }, { status: 500 })

    await logStaffAction(staffId, 'staff_checkin', 'ลงทะเบียนเข้างาน')
  }

  const res = NextResponse.json({ success: true, alreadyCheckedIn: !!already, checkedInAt: already?.checked_in_at ?? null })
  // ผูกคุกกี้เข้ากับ staffId ด้วย — กันเครื่อง/แท็บเล็ตที่แชร์กันหลายคน คนถัดไปที่ล็อคอินต่อ
  // ไม่ได้แปลว่า "เช็คอินแล้ว" ไปด้วย (คุกกี้เดิมเช็คแค่วันที่ ไม่ผูกคน เลยหลุดเช็คอินได้)
  res.cookies.set('kuma_checkin_date', `${staffId}:${todayStr}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 1 วัน
  })
  return res
}
