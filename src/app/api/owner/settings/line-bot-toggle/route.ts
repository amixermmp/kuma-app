import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { branch_id, enabled } = await request.json()
  if (!branch_id || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('branch_settings')
    .select('branch_id')
    .eq('branch_id', branch_id)
    .maybeSingle()

  const { error } = existing
    ? await admin.from('branch_settings').update({ line_bot_enabled: enabled }).eq('branch_id', branch_id)
    : await admin.from('branch_settings').insert({ branch_id, line_bot_enabled: enabled })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
