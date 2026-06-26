import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Helper: extract storage path from signed URL or public URL
function extractStoragePath(url: string): string | null {
  try {
    // Signed URL pattern: /storage/v1/object/sign/rental-photo/PATH?token=...
    // Public URL pattern: /storage/v1/object/public/rental-photo/PATH
    const match = url.match(/\/rental-photo\/(.+?)(?:\?|$)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

async function deletePhotosFromStorage(
  admin: ReturnType<typeof createAdminClient>,
  photos: unknown
): Promise<void> {
  if (!photos || !Array.isArray(photos)) return
  const paths: string[] = []
  for (const p of photos) {
    if (p && typeof p === 'object' && 'url' in p && typeof p.url === 'string') {
      const path = extractStoragePath(p.url)
      if (path) paths.push(path)
    }
  }
  if (paths.length > 0) {
    await admin.storage.from('rental-photo').remove(paths)
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rentalId, type } = await request.json() as { rentalId: string; type: 'daily' | 'monthly' }
  if (!rentalId || !type) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const admin = createAdminClient()

  if (type === 'daily') {
    // Get rental photos
    const { data: rental } = await admin
      .from('rentals')
      .select('id, bike_id, send_photos, return_photos, status')
      .eq('id', rentalId)
      .single()

    if (!rental) return NextResponse.json({ error: 'ไม่พบข้อมูลการเช่า' }, { status: 404 })
    if (rental.status === 'returned') return NextResponse.json({ error: 'คืนรถแล้ว' }, { status: 400 })

    // Delete photos from storage
    await deletePhotosFromStorage(admin, rental.send_photos)
    await deletePhotosFromStorage(admin, rental.return_photos)

    // Update rental: clear photos + mark returned
    await admin.from('rentals').update({
      status: 'returned',
      actual_end_datetime: new Date().toISOString(),
      send_photos: [],
      return_photos: [],
    }).eq('id', rentalId)

    // Update bike status
    await admin.from('bikes').update({ status: 'available' }).eq('id', rental.bike_id)

  } else {
    // Monthly rental
    const { data: rental } = await admin
      .from('monthly_rentals')
      .select('id, bike_id, send_photos, return_photos, status')
      .eq('id', rentalId)
      .single()

    if (!rental) return NextResponse.json({ error: 'ไม่พบข้อมูลการเช่า' }, { status: 404 })
    if (rental.status === 'ended') return NextResponse.json({ error: 'สิ้นสุดแล้ว' }, { status: 400 })

    // Delete photos from storage
    await deletePhotosFromStorage(admin, rental.send_photos)
    await deletePhotosFromStorage(admin, rental.return_photos)

    // Update rental: clear photos + mark ended
    await admin.from('monthly_rentals').update({
      status: 'ended',
      end_date: new Date().toISOString().split('T')[0],
      send_photos: [],
      return_photos: [],
    }).eq('id', rentalId)

    // Update bike status
    await admin.from('bikes').update({ status: 'available' }).eq('id', rental.bike_id)
  }

  return NextResponse.json({ success: true })
}
