import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds } from '@/lib/staffBranch'
import { bangkokDate, FOLLOWUP_OUTCOMES, UNLOCK_MAX_DAYS } from '@/lib/questItems'

const KEY_PREFIX: Record<string, string> = { return: 'ret:', pay: 'pay:', routine: 'rtn:', doc: 'doc:' }

// บันทึกการติดตามงานค้าง (ทักลูกค้า) — ข้อความ 1 ครั้งครอบหลายรายการของคันเดียวกันได้ เก็บแนบทุกรายการ
// ข้อความ/ผลการทักบังคับ สาขาของรถต้องอยู่ในสาขาที่พนักงานเข้าถึงได้ (ตรวจฝั่งเซิร์ฟเวอร์)
export async function POST(request: NextRequest) {
  const staffId = (await cookies()).get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { items, outcome, appointmentDate, note, ownerApproved, approvalReason } = await request.json()
  if (!Array.isArray(items) || items.length === 0 || items.length > 20) return NextResponse.json({ error: 'กรุณาเลือกรายการที่ทักแล้ว' }, { status: 400 })
  if (!Object.keys(FOLLOWUP_OUTCOMES).includes(outcome)) return NextResponse.json({ error: 'กรุณาเลือกผลการทัก' }, { status: 400 })
  const cleanNote = typeof note === 'string' ? note.trim().slice(0, 1000) : ''
  if (!cleanNote) return NextResponse.json({ error: 'กรุณาเขียนข้อความ (ทักแล้วเป็นยังไง)' }, { status: 400 })

  const today = bangkokDate()
  let appt: string | null = null
  // "ทักแล้ว รอคำตอบ" ยังไม่มีวันนัด — ไม่รับวันนัดมาซ่อนรายการ
  if (appointmentDate && outcome !== 'waiting') {
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

  // ลิมิตการซ่อนรายการด้วยนัดวันที่: นัดไกลสุดกี่วัน + ทักมาแล้วถึงกี่ครั้งแล้วนัดซ่อนไม่ได้ (กันเลื่อนไปเรื่อยๆ)
  // ปลดล็อกได้เมื่อพนักงานยืนยันว่าโทรถามพี่เจ้าของร้านแล้ว + เขียนเหตุผล → นัดไกลสุด UNLOCK_MAX_DAYS และไม่ติดเพดานทักซ้ำ
  // (ระบบพิสูจน์ไม่ได้ว่าโทรจริง จึงเก็บชื่อ/เวลา/เหตุผลไว้ให้เจ้าของตรวจย้อน)
  const reason = typeof approvalReason === 'string' ? approvalReason.trim().slice(0, 300) : ''
  const wantsUnlock = ownerApproved === true
  if (wantsUnlock && !reason) return NextResponse.json({ error: 'ปลดล็อกต้องเขียนเหตุผล (เช่น ลูกค้าไปต่างประเทศ กลับวันที่ ...)' }, { status: 400 })
  let usedUnlock = false
  if (appt) {
    const { data: settings } = await supabase.from('quest_settings').select('*').eq('id', 1).maybeSingle()
    const maxDays = Number(settings?.max_appointment_days ?? 7)
    const snoozeLimit = Number(settings?.max_snooze_followups ?? 2)
    const maxDate = bangkokDate(Date.now() + maxDays * 86_400_000)
    const unlockMaxDate = bangkokDate(Date.now() + UNLOCK_MAX_DAYS * 86_400_000)
    if (wantsUnlock && appt > unlockMaxDate) return NextResponse.json({ error: `ปลดล็อกแล้วนัดไกลสุดได้ ${UNLOCK_MAX_DAYS} วันนับจากวันนี้` }, { status: 400 })
    const keys = (items as { key: string }[]).map(i => i.key)
    // นับ "วันที่เคยทัก" ก่อนวันนี้ — วันนี้ทัก (รอคำตอบ) แล้วบันทึกผลต่อ ถือเป็นการทักครั้งเดียวกัน ไม่นับซ้ำ
    const { data: prev } = await supabase.from('quest_followups').select('item_key, quest_date').in('item_key', keys).lt('quest_date', today)
    const daysByKey = new Map<string, Set<string>>()
    for (const p of prev ?? []) (daysByKey.get(p.item_key) ?? daysByKey.set(p.item_key, new Set()).get(p.item_key)!).add(p.quest_date)
    const snoozeBlocked = keys.some(k => (daysByKey.get(k)?.size ?? 0) >= snoozeLimit)
    const tooFar = appt > maxDate
    // บันทึกว่าปลดล็อกเฉพาะตอนที่ต้องใช้จริง (ติ๊กมาแต่นัดอยู่ในลิมิตปกติ = ไม่นับเป็นข้อยกเว้น)
    usedUnlock = wantsUnlock && (tooFar || snoozeBlocked)
    if (!wantsUnlock && tooFar) return NextResponse.json({ error: `นัดไกลสุดได้ ${maxDays} วันนับจากวันนี้ — ถ้าต้องนัดไกลกว่านี้ ให้โทรถามพี่เจ้าของร้านแล้วกด "ปลดล็อก"` }, { status: 400 })
    if (!wantsUnlock && snoozeBlocked) {
      return NextResponse.json({ error: `รายการนี้ทักมาแล้วครบ ${snoozeLimit} ครั้ง นัดวันที่ซ่อนไม่ได้แล้ว — ให้ทักหาพี่เจ้าของร้าน (ไม่ต้องใส่วันนัด)` }, { status: 400 })
    }
  }

  const { data: staff } = await supabase.from('staff').select('name').eq('id', staffId).maybeSingle()
  const rows = (items as { key: string; type: string }[]).map(i => ({
    item_key: i.key, item_type: i.type, bike_id: bike.id, branch_id: bike.branch_id, quest_date: today,
    staff_id: staffId, staff_name: staff?.name ?? null, outcome, appointment_date: appt, note: cleanNote,
    ...(usedUnlock ? { owner_approved: true, approval_reason: reason } : {}),
  }))
  const { error } = await supabase.from('quest_followups').insert(rows)
  if (error) return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
  return NextResponse.json({ success: true })
}
