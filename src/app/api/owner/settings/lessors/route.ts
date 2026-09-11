import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, id, name, idCardNumber, signatureData } = await request.json()
  const admin = createAdminClient()

  if (action === 'add') {
    if (!name?.trim() || !idCardNumber?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อและเลขบัตรประชาชน' }, { status: 400 })
    }
    const { error } = await admin.from('lessor_profiles').insert({
      name: name.trim(), id_card_number: idCardNumber.trim(),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'sign') {
    if (!id || !signatureData) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
    const { error } = await admin.from('lessor_profiles').update({ signature_data: signatureData }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'ไม่รู้จักคำสั่งนี้' }, { status: 400 })
}
