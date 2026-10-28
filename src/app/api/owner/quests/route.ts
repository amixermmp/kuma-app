import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ตั้งค่าเควสของเจ้าของ: เพิ่ม/แก้/ลบเควส และตั้งค่ารวม (รอรถกลับกี่วัน + สาขาที่ปิดเควส)
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const admin = createAdminClient()

  if (body.action === 'settings') {
    const waitDays = Math.min(60, Math.max(0, Math.round(Number(body.waitDays))))
    const disabled = Array.isArray(body.disabledBranchIds) ? body.disabledBranchIds.filter((x: unknown) => typeof x === 'string') : []
    if (!Number.isFinite(waitDays)) return NextResponse.json({ error: 'จำนวนวันไม่ถูกต้อง' }, { status: 400 })
    const { error } = await admin.from('quest_settings').upsert({ id: 1, wait_days: waitDays, disabled_branch_ids: disabled })
    if (error) return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (body.action === 'delete') {
    if (!body.id) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
    // ลบเควสพร้อมประวัติการติ๊กของเควสนั้น (ON DELETE CASCADE) — ถ้าแค่ไม่อยากให้ขึ้นให้ปิดแทนการลบ
    const { error } = await admin.from('daily_quest_templates').delete().eq('id', body.id)
    if (error) return NextResponse.json({ error: 'ลบไม่สำเร็จ' }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (body.action === 'save') {
    const t = body.template ?? {}
    const title = typeof t.title === 'string' ? t.title.trim().slice(0, 200) : ''
    if (!title) return NextResponse.json({ error: 'กรุณาใส่ชื่อเควส' }, { status: 400 })
    const slot = ['open', 'day', 'close'].includes(t.slot) ? t.slot : 'day'
    const kind = ['simple', 'checklist', 'auto'].includes(t.kind) ? t.kind : 'simple'
    const subItems = kind === 'checklist'
      ? (Array.isArray(t.subItems) ? t.subItems : []).map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 12)
      : []
    if (kind === 'checklist' && subItems.length === 0) return NextResponse.json({ error: 'เควสแบบมีรายการย่อยต้องมีอย่างน้อย 1 รายการ' }, { status: 400 })
    const autoSource = kind === 'auto' ? (['fuel', 'closeshop'].includes(t.autoSource) ? t.autoSource : null) : null
    if (kind === 'auto' && !autoSource) return NextResponse.json({ error: 'กรุณาเลือกแหล่งข้อมูลของเควสแบบดึงข้อมูล' }, { status: 400 })
    const days = Array.isArray(t.daysOfWeek) ? t.daysOfWeek.map(Number).filter((n: number) => n >= 0 && n <= 6) : []
    const branches = Array.isArray(t.branchIds) ? t.branchIds.filter((x: unknown) => typeof x === 'string') : []
    const row = {
      title, slot, kind, sub_items: subItems, auto_source: autoSource,
      link_url: typeof t.linkUrl === 'string' && t.linkUrl.startsWith('/') ? t.linkUrl.trim() : null,
      link_label: typeof t.linkLabel === 'string' && t.linkLabel.trim() ? t.linkLabel.trim().slice(0, 60) : null,
      require_photo: !!t.requirePhoto, require_note: !!t.requireNote,
      days_of_week: days.length ? days : null, branch_ids: branches.length ? branches : null,
      sort_order: Number.isFinite(Number(t.sortOrder)) ? Math.round(Number(t.sortOrder)) : 100,
      active: t.active !== false,
    }
    const { data, error } = t.id
      ? await admin.from('daily_quest_templates').update(row).eq('id', t.id).select('id').maybeSingle()
      : await admin.from('daily_quest_templates').insert(row).select('id').maybeSingle()
    if (error || !data) return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
    return NextResponse.json({ success: true, id: data.id })
  }

  return NextResponse.json({ error: 'คำสั่งไม่ถูกต้อง' }, { status: 400 })
}
