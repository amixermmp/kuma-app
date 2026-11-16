import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds } from '@/lib/staffBranch'
import { isUuid } from '@/lib/webApiAuth'

const STATUSES = ['clicked', 'chatted', 'confirmed', 'unavailable', 'moved_branch', 'silent', 'cancelled']

// พนักงานตั้งผลของคำขอจากเว็บ (ทักมาจริง/ยืนยัน/ไม่ว่าง/โยกสาขา/เงียบ) + โน้ต — เฉพาะสาขาที่ตัวเองดูแล
export async function POST(request: NextRequest) {
  const staffId = (await cookies()).get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || !isUuid(body.id)) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 })
    patch.status = body.status
    patch.handled_at = new Date().toISOString()
  }
  if (body.staff_note !== undefined) {
    patch.staff_note = typeof body.staff_note === 'string' && body.staff_note.trim() ? body.staff_note.trim().slice(0, 500) : null
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'ไม่มีอะไรให้บันทึก' }, { status: 400 })

  const admin = createAdminClient()
  const { data: row } = await admin.from('web_inquiries').select('id, branch_id').eq('id', body.id).maybeSingle()
  if (!row) return NextResponse.json({ error: 'ไม่พบคำขอนี้' }, { status: 404 })

  const allowed = await getStaffBranchIds(staffId)
  if (allowed && !allowed.includes(row.branch_id)) return NextResponse.json({ error: 'ไม่มีสิทธิ์ในสาขานี้' }, { status: 403 })

  const { error } = await admin.from('web_inquiries').update(patch).eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
