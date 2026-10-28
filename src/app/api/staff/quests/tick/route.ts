import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffOwnBranchId } from '@/lib/staffBranch'
import { bangkokDate } from '@/lib/questItems'

// ติ๊ก/ยกเลิกเควสประจำ (ข้อเดียว หรือรายการย่อยของเควสแบบ checklist) — บันทึกต่อวัน/สาขา/ข้อ
// สาขาอ่านจาก cookie พนักงานเสมอ ไม่เชื่อค่าจากหน้าเว็บ
export async function POST(request: NextRequest) {
  const staffId = (await cookies()).get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { templateId, subItem, note, photoUrl, undo } = await request.json()
  if (!templateId) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  let branchId: string
  try { branchId = await getStaffOwnBranchId(staffId) } catch { return NextResponse.json({ error: 'ไม่พบสาขาของพนักงาน' }, { status: 400 }) }

  const supabase = createAdminClient()
  const today = bangkokDate()
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay()

  const [{ data: template }, { data: settings }, { data: staff }] = await Promise.all([
    supabase.from('daily_quest_templates').select('*').eq('id', templateId).eq('active', true).maybeSingle(),
    supabase.from('quest_settings').select('disabled_branch_ids').eq('id', 1).maybeSingle(),
    supabase.from('staff').select('name').eq('id', staffId).maybeSingle(),
  ])
  if (!template) return NextResponse.json({ error: 'ไม่พบเควสนี้' }, { status: 404 })
  if ((settings?.disabled_branch_ids ?? []).includes(branchId)) return NextResponse.json({ error: 'เควสยังไม่เปิดใช้สำหรับสาขานี้' }, { status: 403 })
  if (template.branch_ids?.length && !template.branch_ids.includes(branchId)) return NextResponse.json({ error: 'เควสนี้ไม่ใช้กับสาขานี้' }, { status: 403 })
  if (template.days_of_week?.length && !template.days_of_week.includes(dow)) return NextResponse.json({ error: 'เควสนี้ไม่ใช้ในวันนี้' }, { status: 403 })
  if (template.kind === 'auto') return NextResponse.json({ error: 'เควสนี้ระบบติ๊กให้เองจากข้อมูล' }, { status: 400 })

  const sub: string = template.kind === 'checklist' ? String(subItem ?? '') : ''
  if (template.kind === 'checklist' && !(Array.isArray(template.sub_items) && template.sub_items.includes(sub))) {
    return NextResponse.json({ error: 'ไม่พบรายการย่อยนี้' }, { status: 400 })
  }

  if (undo) {
    await supabase.from('daily_quest_logs').delete()
      .eq('quest_date', today).eq('branch_id', branchId).eq('template_id', templateId).eq('sub_item', sub)
    return NextResponse.json({ success: true })
  }

  const cleanNote = typeof note === 'string' ? note.trim().slice(0, 500) : ''
  if (template.require_note && !cleanNote) return NextResponse.json({ error: 'กรุณาเขียนข้อความ' }, { status: 400 })
  if (template.require_photo && template.kind === 'simple' && !photoUrl) return NextResponse.json({ error: 'กรุณาแนบรูปก่อนติ๊ก' }, { status: 400 })

  const { error } = await supabase.from('daily_quest_logs').upsert({
    quest_date: today, branch_id: branchId, template_id: templateId, sub_item: sub,
    staff_id: staffId, staff_name: staff?.name ?? null, note: cleanNote || null, photo_url: photoUrl || null,
    done_at: new Date().toISOString(),
  }, { onConflict: 'quest_date,branch_id,template_id,sub_item' })
  if (error) return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
  return NextResponse.json({ success: true })
}
