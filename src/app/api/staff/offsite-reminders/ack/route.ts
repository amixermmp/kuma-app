import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, id } = await request.json()
  if (!type || !id || !['send', 'return'].includes(type)) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('offsite_reminder_acks').upsert(
    { source_type: type, source_id: id, staff_id: staffId },
    { onConflict: 'source_type,source_id,staff_id', ignoreDuplicates: true }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
