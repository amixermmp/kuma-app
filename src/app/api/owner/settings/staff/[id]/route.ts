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

  // If updating PIN, check uniqueness
  if (body.pin) {
    const { data: existing } = await admin.from('staff').select('id').eq('pin', body.pin).neq('id', id).maybeSingle()
    if (existing) return NextResponse.json({ error: 'PIN นี้มีพนักงานใช้อยู่แล้ว' }, { status: 400 })
  }

  const { error } = await admin.from('staff').update(body).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
