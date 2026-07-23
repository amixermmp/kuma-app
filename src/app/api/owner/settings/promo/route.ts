import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body.name || !body.discount_type) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const admin = createAdminClient()
  const eligibleBikeIds = Array.isArray(body.eligible_bike_ids) && body.eligible_bike_ids.length > 0
    ? body.eligible_bike_ids
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
    eligible_bike_ids: eligibleBikeIds,
    is_student_promo: !!body.is_student_promo,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
