import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, bikeId, docType, expiryDate, photoUrl } = await request.json()
  if (!bikeId || !docType || !expiryDate) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('bike_documents')
    .upsert({
      id: id ?? undefined,
      bike_id: bikeId,
      doc_type: docType,
      expiry_date: expiryDate,
      doc_photo_url: photoUrl ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'bike_id,doc_type' })

  if (error) {
    console.error('Doc update error:', error.message)
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
