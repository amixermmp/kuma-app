import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// บันทึกรูปกรอบ/สติ๊กเกอร์ปิดหน้า สำหรับรูปคู่รถ รายสาขา (branch_settings)
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { branch_id, frame_url, sticker_url } = await request.json()
  if (!branch_id) return NextResponse.json({ error: 'Missing branch' }, { status: 400 })

  const fields = {
    frame_url: frame_url || null,
    sticker_url: sticker_url || null,
  }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('branch_settings')
    .select('branch_id')
    .eq('branch_id', branch_id)
    .maybeSingle()

  const { error } = existing
    ? await admin.from('branch_settings').update(fields).eq('branch_id', branch_id)
    : await admin.from('branch_settings').insert({ branch_id, ...fields })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
