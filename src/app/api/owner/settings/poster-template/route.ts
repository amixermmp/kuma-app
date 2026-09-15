import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { branchId, imageUrl } = await request.json()
  if (!branchId || !imageUrl) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existing } = await admin.from('branch_settings').select('branch_id').eq('branch_id', branchId).maybeSingle()
  const { error } = existing
    ? await admin.from('branch_settings').update({ poster_template_url: imageUrl }).eq('branch_id', branchId)
    : await admin.from('branch_settings').insert({ branch_id: branchId, poster_template_url: imageUrl })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
