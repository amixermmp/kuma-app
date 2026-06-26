import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type DocType = 'tax' | 'pob' | 'registration'

const PREFIX_MAP: Record<string, DocType> = {
  tax: 'tax',
  pob: 'pob',
  book: 'registration',
}

function normalizePlate(plate: string): string {
  return plate.replace(/[\s\-]/g, '')
}

function parseFilename(filename: string): { docType: DocType; platePart: string } | null {
  const base = filename.replace(/\.[^.]+$/, '') // remove extension
  for (const [prefix, docType] of Object.entries(PREFIX_MAP)) {
    if (base.toLowerCase().startsWith(prefix + '_')) {
      const platePart = base.slice(prefix.length + 1) // after "tax_"
      return { docType, platePart }
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const files = formData.getAll('files') as File[]

  if (!files.length) {
    return NextResponse.json({ error: 'ไม่มีไฟล์' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Load all bikes once (id + license_plate)
  const { data: bikes } = await supabase
    .from('bikes')
    .select('id, license_plate')
    .neq('status', 'retired')

  // Build normalized plate → bike_id map
  const plateMap = new Map<string, string>()
  for (const bike of bikes ?? []) {
    plateMap.set(normalizePlate(bike.license_plate), bike.id)
  }

  const results: { filename: string; status: 'ok' | 'skip'; reason?: string }[] = []

  for (const file of files) {
    const parsed = parseFilename(file.name)

    if (!parsed) {
      results.push({ filename: file.name, status: 'skip', reason: 'ชื่อไฟล์ไม่ตรง format (ต้องขึ้นต้นด้วย tax_ / pob_ / book_)' })
      continue
    }

    const bikeId = plateMap.get(normalizePlate(parsed.platePart))
    if (!bikeId) {
      results.push({ filename: file.name, status: 'skip', reason: `ไม่พบรถทะเบียน "${parsed.platePart}"` })
      continue
    }

    // Upload to storage
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const storagePath = `bike-docs/${parsed.docType}_${bikeId}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { data: uploaded, error: uploadErr } = await supabase.storage
      .from('rental-photo')
      .upload(storagePath, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      })

    if (uploadErr || !uploaded) {
      results.push({ filename: file.name, status: 'skip', reason: 'upload ไม่สำเร็จ' })
      continue
    }

    // Signed URL (5 years)
    const { data: signed } = await supabase.storage
      .from('rental-photo')
      .createSignedUrl(uploaded.path, 60 * 60 * 24 * 365 * 5)

    const photoUrl = signed?.signedUrl ?? ''

    // Manual upsert: update if exists, insert if not
    const { data: existing } = await supabase
      .from('bike_documents')
      .select('id')
      .eq('bike_id', bikeId)
      .eq('doc_type', parsed.docType)
      .single()

    if (existing) {
      await supabase
        .from('bike_documents')
        .update({ doc_photo_url: photoUrl })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('bike_documents')
        .insert({ bike_id: bikeId, doc_type: parsed.docType, doc_photo_url: photoUrl })
    }

    results.push({ filename: file.name, status: 'ok' })
  }

  const okCount = results.filter(r => r.status === 'ok').length
  const skipped = results.filter(r => r.status === 'skip')

  return NextResponse.json({ imported: okCount, skipped, total: files.length })
}
