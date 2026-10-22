import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMarketingAccess, canTouchPhoto } from '@/lib/marketingAuth'

function extractStoragePath(url: string): string | null {
  const match = url.match(/\/rental-photo\/(.+?)(?:\?|$)/)
  return match ? match[1] : null
}

export async function POST(request: Request) {
  const access = await getMarketingAccess()
  if (!access.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { photoId } = await request.json()
  if (!photoId) return NextResponse.json({ error: 'Missing photoId' }, { status: 400 })

  const admin = createAdminClient()

  const { data: photo } = await admin.from('marketing_photos').select('branch_id, original_photo_url, processed_photo_url').eq('id', photoId).single()
  if (!photo || !canTouchPhoto(access, photo.branch_id)) return NextResponse.json({ error: 'ไม่พบรูป' }, { status: 404 })

  const paths = [photo?.original_photo_url, photo?.processed_photo_url]
    .filter((u): u is string => !!u)
    .map(extractStoragePath)
    .filter((p): p is string => !!p)
  if (paths.length > 0) {
    await admin.storage.from('rental-photo').remove(paths)
  }

  const { error } = await admin.from('marketing_photos').delete().eq('id', photoId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
