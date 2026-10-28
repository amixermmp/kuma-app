import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds } from '@/lib/staffBranch'
import { bangkokDate, FOLLOWUP_OUTCOMES } from '@/lib/questItems'

const KEY_PREFIX: Record<string, string> = { return: 'ret:', pay: 'pay:', routine: 'rtn:' }

// บันทึกการติดตามงานค้าง (ทักลูกค้า) — ข้อความ 1 ครั้งครอบหลายรายการของคันเดียวกันได้ เก็บแนบทุกรายการ
// ข้อความ/ผลการทักบังคับ สาขาของรถต้องอยู่ในสาขาที่พนักงานเข้าถึงได้ (ตรวจฝั่งเซิร์ฟเวอร์)
export async function POST(request: NextRequest) {
  const staffId = (await cookies()).get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { items, outcome, appointmentDate, note } = await request.json()
  if (!Array.isArray(items) || items.length === 0 || items.length > 20) return NextResponse.json({ error: 'กรุณาเลือกรายการที่ทักแล้ว' }, { status: 400 })
  if (!Object.keys(FOLLOWUP_OUTCOMES).includes(outcome)) return NextResponse.json({ error: 'กรุณาเลือกผลการทัก' }, { status: 400 })
  const cleanNote = typeof note === 'string' ? note.trim().slice(0, 1000) : ''
  if (!cleanNote) return NextResponse.json({ error: 'กรุณาเขียนข้อความ (ทักแล้วเป็นยังไง)' }, { status: 400 })

  const today = bangkokDate()
  let appt: string | null = null
  if (appointmentDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) || appointmentDate < today) return NextResponse.json({ error: 'วันนัดไม่ถูกต้อง' }, { status: 400 })
    appt = appointmentDate
  }

  const supabase = createAdminClient()
  const allowed = await getStaffBranchIds(staffId)
  const bikeIds = Array.from(new Set(items.map((i: { bikeId?: string }) => i.bikeId).filter(Boolean))) as string[]
  if (bikeIds.length !== 1) return NextResponse.json({ error: 'บันทึกได้ทีละคัน' }, { status: 400 })
  const { data: bike } = await supabase.from('bikes').select('id, branch_id').eq('id', bikeIds[0]).maybeSingle()
  if (!bike || (allowed && !allowed.includes(bike.branch_id))) return NextResponse.json({ error: 'ไม่พบรถคันนี้' }, { status: 404 })
  for (const i of items as { key?: string; type?: string }[]) {
    const prefix = KEY_PREFIX[i.type ?? '']
    if (!prefix || typeof i.key !== 'string' || !i.key.startsWith(prefix) || i.key.length > 120) return NextResponse.json({ error: 'รายการไม่ถูกต้อง' }, { status: 400 })
  }

  const { data: staff } = await supabase.from('staff').select('name').eq('id', staffId).maybeSingle()
  const rows = (items as { key: string; type: string }[]).map(i => ({
    item_key: i.key, item_type: i.type, bike_id: bike.id, branch_id: bike.branch_id, quest_date: today,
    staff_id: staffId, staff_name: staff?.name ?? null, outcome, appointment_date: appt, note: cleanNote,
  }))
  const { error } = await supabase.from('quest_followups').insert(rows)
  if (error) return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
  return NextResponse.json({ success: true })
}
