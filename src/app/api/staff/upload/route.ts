import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const folder = (formData.get('folder') as string | null) ?? 'misc'

  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const filename = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const supabase = createAdminClient()
  const buffer = Buffer.from(await file.arrayBuffer())

  const { data, error } = await supabase.storage
    .from('rental-photos')
    .upload(filename, buffer, {
      contentType: 'image/jpeg',
      upsert: false,
    })

  if (error || !data) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'อัพโหลดไม่สำเร็จ' }, { status: 500 })
  }

  // Signed URL valid 1 year
  const { data: signed } = await supabase.storage
    .from('rental-photos')
    .createSignedUrl(data.path, 60 * 60 * 24 * 365)

  return NextResponse.json({ path: data.path, url: signed?.signedUrl ?? '' })
}
