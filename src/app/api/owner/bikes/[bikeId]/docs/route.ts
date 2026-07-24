import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest, { params }: { params: Promise<{ bikeId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bikeId } = await params
  const { pob_expiry, tax_expiry, registration_photo } = await request.json()

  const admin = createAdminClient()

  const updates: { doc_type: string; expiry_date: string | null }[] = [
    { doc_type: 'pob', expiry_date: pob_expiry ?? null },
    { doc_type: 'tax', expiry_date: tax_expiry ?? null },
  ]

  for (const { doc_type, expiry_date } of updates) {
    const { data: existing } = await admin
      .from('bike_documents')
      .select('id')
      .eq('bike_id', bikeId)
      .eq('doc_type', doc_type)
      .maybeSingle()

    if (existing) {
      const { error } = await admin
        .from('bike_documents')
        .update({ expiry_date, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await admin
        .from('bike_documents')
        .insert({ bike_id: bikeId, doc_type, expiry_date })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // หน้าเล่มทะเบียน — เอกสารถาวร อัพเดทเฉพาะเมื่อส่งรูปใหม่มา
  if (registration_photo) {
    const { error } = await admin
      .from('bike_documents')
      .upsert({
        bike_id: bikeId,
        doc_type: 'registration',
        expiry_date: null,
        doc_photo_url: registration_photo,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'bike_id,doc_type' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
