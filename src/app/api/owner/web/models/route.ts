import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/webApiAuth'

// ตั้งค่ารุ่นที่โชว์บนเว็บหน้าร้าน: โชว์/ซ่อน, รูปประจำรุ่น, ลำดับ (เจ้าของเท่านั้น)
// ฟิลด์ที่ไม่ส่งมา = ไม่แตะค่าเดิม (กันหน้าที่แก้แค่รูปเผลอรีเซ็ตสถานะโชว์)
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || !isUuid(body.branch_id) || typeof body.brand !== 'string' || typeof body.model !== 'string') {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (typeof body.visible === 'boolean') patch.visible = body.visible
  if (body.photo_url !== undefined) patch.photo_url = typeof body.photo_url === 'string' && body.photo_url ? body.photo_url : null
  if (body.sort_order !== undefined) {
    if (!Number.isInteger(body.sort_order)) return NextResponse.json({ error: 'ลำดับต้องเป็นตัวเลข' }, { status: 400 })
    patch.sort_order = body.sort_order
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'ไม่มีอะไรให้บันทึก' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('web_model_settings').select('branch_id')
    .eq('branch_id', body.branch_id).eq('brand', body.brand).eq('model', body.model)
    .maybeSingle()

  const { error } = existing
    ? await admin.from('web_model_settings').update(patch).eq('branch_id', body.branch_id).eq('brand', body.brand).eq('model', body.model)
    : await admin.from('web_model_settings').insert({ branch_id: body.branch_id, brand: body.brand, model: body.model, ...patch })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
