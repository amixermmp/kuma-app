import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/webApiAuth'

// เพิ่ม/แก้/ลบ โซนค่าส่งของเว็บหน้าร้าน (เจ้าของเท่านั้น)
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : null)
// ค่าว่าง = null (ไม่ให้บริการแบบสั้น / ยังไม่ตั้งแบบรายเดือน) ส่วน 0 = ฟรี
const fee = (v: unknown): number | null | 'invalid' => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? n : 'invalid'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || !isUuid(body.branch_id)) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  const admin = createAdminClient()

  if (body.delete_id) {
    if (!isUuid(body.delete_id)) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
    const { error } = await admin.from('delivery_zones').delete().eq('id', body.delete_id).eq('branch_id', body.branch_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  const z = body.zone ?? {}
  const nameTh = text(z.name_th)
  const nameEn = text(z.name_en)
  if (!nameTh || !nameEn) return NextResponse.json({ error: 'ต้องกรอกชื่อโซนภาษาไทยและอังกฤษ' }, { status: 400 })
  const shortFee = fee(z.short_fee)
  const longFee = fee(z.long_fee)
  if (shortFee === 'invalid' || longFee === 'invalid') return NextResponse.json({ error: 'ค่าส่งไม่ถูกต้อง' }, { status: 400 })

  const fields = {
    name_th: nameTh,
    name_en: nameEn,
    name_ja: text(z.name_ja),
    name_zh: text(z.name_zh),
    short_fee: shortFee,
    long_fee: longFee,
    sort_order: Number.isInteger(z.sort_order) ? z.sort_order : 0,
    active: z.active !== false,
  }

  if (z.id) {
    if (!isUuid(z.id)) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
    const { data, error } = await admin.from('delivery_zones').update(fields).eq('id', z.id).eq('branch_id', body.branch_id).select('id').maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'ไม่พบโซนนี้' }, { status: 404 })
    return NextResponse.json({ success: true, id: data.id })
  }

  const { data, error } = await admin.from('delivery_zones').insert({ branch_id: body.branch_id, ...fields }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, id: data.id })
}
