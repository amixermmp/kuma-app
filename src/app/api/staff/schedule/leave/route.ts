import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffOwnBranchId } from '@/lib/staffBranch'
import { cancelOwnLeave, requestLeave, respondCover } from '@/lib/scheduleLeave'
import { logStaffAction } from '@/lib/log'

// พนักงาน: ขอลา (วันเดียว/เป็นช่วง) / ยกเลิกคำขอของตัวเอง / คนแทนกดรับ-ไม่รับ
// ใช้ได้แม้ยังไม่เช็คอิน (โหมด "ดูตารางอย่างเดียว") — /api ไม่ผ่านด่านเช็คอิน
export async function POST(request: NextRequest) {
  const staffId = (await cookies()).get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  let branchId: string
  try {
    branchId = await getStaffOwnBranchId(staffId)
  } catch {
    return NextResponse.json({ error: 'ไม่พบสาขาของพนักงาน' }, { status: 400 })
  }
  const admin = createAdminClient()

  if (body.action === 'request') {
    const r = await requestLeave(admin, staffId, branchId, { from: body.from, to: body.to ?? body.from, coverStaffId: body.coverStaffId, reason: body.reason })
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 })
    await logStaffAction(staffId, 'schedule_leave_request',
      `ขอลา ${body.from}${body.to && body.to !== body.from ? ` ถึง ${body.to}` : ''} (${r.count} วัน) — ${r.route === 'auto' ? (r.surplus ? 'อนุมัติทันที (วันนั้นคนเกินเป้า)' : 'อนุมัติทันที') : r.route === 'cover' ? 'รอคนแทนรับ' : 'รอเจ้าของพิจารณา'}`,
      { from: body.from, to: body.to ?? body.from, route: r.route, surplus: r.surplus, coverStaffId: body.coverStaffId ?? null, reason: body.reason ?? null })
    return NextResponse.json({ success: true, route: r.route, count: r.count, surplus: r.surplus })
  }

  if (body.action === 'cancel') {
    const err = await cancelOwnLeave(admin, staffId, body.id)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
    await logStaffAction(staffId, 'schedule_leave_cancel', 'ยกเลิกคำขอลา', { id: body.id })
    return NextResponse.json({ success: true })
  }

  if (body.action === 'respond') {
    const accept = body.accept === true
    const err = await respondCover(admin, staffId, branchId, body.id, accept)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
    await logStaffAction(staffId, accept ? 'schedule_cover_accept' : 'schedule_cover_decline', accept ? 'รับทำงานแทน' : 'ไม่รับทำงานแทน', { id: body.id })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'คำสั่งไม่ถูกต้อง' }, { status: 400 })
}
