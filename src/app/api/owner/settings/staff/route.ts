import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, pin, allowed_branch_ids } = await request.json()
  if (!name || !pin || pin.length !== 6) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const admin = createAdminClient()

  // Check PIN uniqueness
  const { data: existing } = await admin.from('staff').select('id').eq('pin', pin).maybeSingle()
  if (existing) return NextResponse.json({ error: 'PIN นี้มีพนักงานใช้อยู่แล้ว' }, { status: 400 })

  const { data, error } = await admin.from('staff').insert({ name, pin, allowed_branch_ids: allowed_branch_ids ?? null, is_active: true }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, id: data.id })
}
