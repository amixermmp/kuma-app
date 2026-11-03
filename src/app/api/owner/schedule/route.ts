import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addOwnerExtraShift, deleteSchedulePattern, removeExtraShift, saveSchedulePattern, saveScheduleSettings, setScheduleDayType } from '@/lib/schedule'
import { ownerCancelLeave, ownerDecideLeave, ownerRecordLeave } from '@/lib/scheduleLeave'

// ตั้งค่าตารางงานของเจ้าของ: สวิตช์/จำนวนคนต่อวัน, แบบแผนรายสัปดาห์ต่อคน, ประเภทวันพิเศษ
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const branchId = typeof body.branchId === 'string' ? body.branchId : ''
  if (!branchId) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  const admin = createAdminClient()

  let error: string | null = null
  let extra: Record<string, unknown> = {}
  if (body.action === 'settings') {
    error = await saveScheduleSettings(admin, branchId, { enabled: body.enabled, counts: body.counts ?? {} })
  } else if (body.action === 'savePattern') {
    const r = await saveSchedulePattern(admin, {
      id: body.id, staffId: body.staffId, branchId, weekdays: body.weekdays, startDate: body.startDate, endDate: body.endDate,
    })
    if ('error' in r) error = r.error
    else extra = { id: r.id }
  } else if (body.action === 'deletePattern') {
    error = await deleteSchedulePattern(admin, branchId, body.id)
  } else if (body.action === 'dayType') {
    error = await setScheduleDayType(admin, branchId, body.day, body.type ?? null)
  } else if (body.action === 'addExtra') {
    error = await addOwnerExtraShift(admin, branchId, body.staffId, body.day)
  } else if (body.action === 'removeExtra') {
    error = await removeExtraShift(admin, branchId, body.staffId, body.day)
  } else if (body.action === 'decideLeave') {
    error = await ownerDecideLeave(admin, branchId, { id: body.id, groupId: body.groupId }, body.approve === true)
  } else if (body.action === 'recordLeave') {
    const r = await ownerRecordLeave(admin, branchId, body.staffId, body.from, body.to ?? body.from, body.reason)
    if ('error' in r) error = r.error
    else extra = { count: r.count }
  } else if (body.action === 'cancelLeave') {
    error = await ownerCancelLeave(admin, branchId, body.id)
  } else {
    return NextResponse.json({ error: 'คำสั่งไม่ถูกต้อง' }, { status: 400 })
  }

  if (error) return NextResponse.json({ error }, { status: 400 })
  return NextResponse.json({ success: true, ...extra })
}
