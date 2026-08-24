import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// บันทึกรูป QR ไลน์ร้าน + LINE ID รายสาขา (branch_settings) — โชว์ท้ายฟอร์มส่งรถให้ลูกค้าแอด
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { branch_id, line_qr_url, line_id } = await request.json()
  if (!branch_id) return NextResponse.json({ error: 'Missing branch' }, { status: 400 })

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('branch_settings')
    .select('branch_id')
    .eq('branch_id', branch_id)
    .maybeSingle()

  const fields = {
    line_qr_url: line_qr_url || null,
    line_id: line_id?.trim() || null,
  }

  const { error } = existing
    ? await admin.from('branch_settings').update(fields).eq('branch_id', branch_id)
    : await admin.from('branch_settings').insert({ branch_id, ...fields })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
