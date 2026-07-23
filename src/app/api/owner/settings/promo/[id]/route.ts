import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const admin = createAdminClient()

  // มีได้แค่โปรเดียวที่เป็น "ราคานักศึกษา" — ถ้าตั้งอันนี้เป็นตัวใหม่ ต้องปลดตัวเก่าออกก่อน
  if (body.is_student_promo) {
    await admin.from('promotions').update({ is_student_promo: false }).eq('is_student_promo', true).neq('id', id)
  }

  const { error } = await admin.from('promotions').update(body).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
