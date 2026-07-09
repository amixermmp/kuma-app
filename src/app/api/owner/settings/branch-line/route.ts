import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// บันทึกตั้งค่า LINE แจ้งเตือนลูกค้า รายสาขา (branch_settings)
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { branch_id, line_token, line_liff_id, promptpay_id, line_notify_customer } = await request.json()
  if (!branch_id) return NextResponse.json({ error: 'Missing branch' }, { status: 400 })

  const fields = {
    line_token: line_token || null,
    line_liff_id: line_liff_id || null,
    promptpay_id: promptpay_id || null,
    line_notify_customer: line_notify_customer !== false,
  }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('branch_settings')
    .select('id')
    .eq('branch_id', branch_id)
    .maybeSingle()

  const { error } = existing
    ? await admin.from('branch_settings').update(fields).eq('branch_id', branch_id)
    : await admin.from('branch_settings').insert({ branch_id, ...fields })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
