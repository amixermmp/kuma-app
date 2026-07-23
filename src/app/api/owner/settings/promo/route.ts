import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body.name || !body.discount_type) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  if (!Array.isArray(body.branch_ids) || body.branch_ids.length === 0) {
    return NextResponse.json({ error: 'กรุณาเลือกอย่างน้อย 1 สาขา' }, { status: 400 })
  }

  const admin = createAdminClient()
  const eligibleModels = Array.isArray(body.eligible_models) && body.eligible_models.length > 0
    ? body.eligible_models
    : null

  // มีได้แค่โปรเดียวที่เป็น "ราคานักศึกษา" — ถ้าตั้งอันนี้เป็นตัวใหม่ ต้องปลดตัวเก่าออกก่อน
  if (body.is_student_promo) {
    await admin.from('promotions').update({ is_student_promo: false }).eq('is_student_promo', true)
  }

  const { error } = await admin.from('promotions').insert({
    name: body.name,
    description: body.description ?? null,
    discount_type: body.discount_type,
    discount_value: body.discount_value ?? 0,
    min_days: body.min_days ?? null,
    bonus_days: body.bonus_days ?? null,
    code: body.code ?? null,
    is_active: body.is_active ?? true,
    branch_ids: body.branch_ids,
    eligible_models: eligibleModels,
    is_student_promo: !!body.is_student_promo,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
