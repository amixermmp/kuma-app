import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// บันทึกชื่อร้าน/ที่อยู่/เบอร์โทร ที่จะขึ้นในใบเสร็จ รายสาขา (branch_settings) — ว่าง = ใช้ค่าจากร้านกลางแทน
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { branch_id, receipt_shop_name, receipt_address, receipt_phone } = await request.json()
  if (!branch_id) return NextResponse.json({ error: 'Missing branch' }, { status: 400 })

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('branch_settings')
    .select('branch_id')
    .eq('branch_id', branch_id)
    .maybeSingle()

  const fields = {
    receipt_shop_name: receipt_shop_name?.trim() || null,
    receipt_address: receipt_address?.trim() || null,
    receipt_phone: receipt_phone?.trim() || null,
  }

  const { error } = existing
    ? await admin.from('branch_settings').update(fields).eq('branch_id', branch_id)
    : await admin.from('branch_settings').insert({ branch_id, ...fields })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
