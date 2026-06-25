import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BRANCH_ID = '00000000-0000-0000-0000-000000000001'
const ALLOWED_FIELDS = ['terms_photo_url', 'manual_photo_url', 'contract_photo_url']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { field, url } = await request.json()
  if (!field || !ALLOWED_FIELDS.includes(field)) {
    return NextResponse.json({ error: 'Invalid field' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Upsert branch_settings row
  const { data: existing } = await admin
    .from('branch_settings')
    .select('id')
    .eq('branch_id', BRANCH_ID)
    .maybeSingle()

  if (existing) {
    await admin.from('branch_settings').update({ [field]: url || null }).eq('branch_id', BRANCH_ID)
  } else {
    await admin.from('branch_settings').insert({ branch_id: BRANCH_ID, [field]: url || null })
  }

  return NextResponse.json({ success: true })
}
