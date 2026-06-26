import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const folder = (formData.get('folder') as string | null) ?? 'owner-misc'

  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const filename = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const admin = createAdminClient()
  const buffer = Buffer.from(await file.arrayBuffer())

  const { data, error } = await admin.storage
    .from('rental-photo')
    .upload(filename, buffer, { contentType: file.type || 'image/jpeg', upsert: false })

  if (error || !data) {
    return NextResponse.json({ error: 'อัพโหลดไม่สำเร็จ', detail: error?.message }, { status: 500 })
  }

  const { data: signed } = await admin.storage
    .from('rental-photo')
    .createSignedUrl(data.path, 60 * 60 * 24 * 365 * 5) // 5 years

  return NextResponse.json({ path: data.path, url: signed?.signedUrl ?? '' })
}
