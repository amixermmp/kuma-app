import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_FIELDS = ['poster_template_url', 'poster_x_mark_url'] as const

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { branchId, imageUrl, field } = await request.json()
  const column = field ?? 'poster_template_url'
  if (!branchId || !imageUrl || !ALLOWED_FIELDS.includes(column)) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: existing } = await admin.from('branch_settings').select('branch_id').eq('branch_id', branchId).maybeSingle()
  const { error } = existing
    ? await admin.from('branch_settings').update({ [column]: imageUrl }).eq('branch_id', branchId)
    : await admin.from('branch_settings').insert({ branch_id: branchId, [column]: imageUrl })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
