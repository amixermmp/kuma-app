import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeLog } from '@/lib/log'
import { hasOpenContract } from '@/lib/availability'

// Helper: extract storage path from signed URL or public URL
function extractStoragePath(url: string): string | null {
  try {
    const match = url.match(/\/rental-photo\/(.+?)(?:\?|$)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

async function deletePhotosFromStorage(
  admin: ReturnType<typeof createAdminClient>,
  photos: unknown
): Promise<number> {
  if (!photos || !Array.isArray(photos)) return 0
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
  return paths.length
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rentalId, type } = await request.json() as { rentalId: string; type: 'daily' | 'monthly' }
  if (!rentalId || !type) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const admin = createAdminClient()
  const ownerName = user.email ?? 'owner'

  if (type === 'daily') {
    const { data: rental } = await admin
      .from('rentals')
      .select('id, bike_id, send_photos, return_photos, status, customers(name, phone), bikes(license_plate)')
      .eq('id', rentalId)
      .single()

    if (!rental) return NextResponse.json({ error: 'ไม่พบข้อมูลการเช่า' }, { status: 404 })
    if (rental.status === 'returned') return NextResponse.json({ error: 'คืนรถแล้ว' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customerName = (rental.customers as any)?.name ?? 'ลูกค้า'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plate = (rental.bikes as any)?.license_plate ?? ''

    // Delete photos from storage
    const deleted = await deletePhotosFromStorage(admin, rental.send_photos)
    await deletePhotosFromStorage(admin, rental.return_photos)

    await admin.from('rentals').update({
      status: 'returned',
      actual_end_datetime: new Date().toISOString(),
      send_photos: [],
      return_photos: [],
    }).eq('id', rentalId)

    // เว้นแต่รถมีสัญญาอื่นเปิดค้างอยู่แล้ว (ปิดสัญญานี้ช้าหลังสัญญาใหม่บนคันเดียวกันเปิดไปแล้ว)
    if (!(await hasOpenContract(admin, rental.bike_id))) {
      await admin.from('bikes').update({ status: 'available' }).eq('id', rental.bike_id)
    }

    // Log: owner action
    await writeLog({
      actorType: 'owner',
      actorId: user.id,
      actorName: ownerName,
      action: 'bike_returned',
      description: `คืนรถ ${plate} — ลูกค้า ${customerName}`,
      metadata: { rentalId, bikeId: rental.bike_id, type: 'daily' },
    })

    // Log: system deleted photos
    if (deleted > 0) {
      await writeLog({
        actorType: 'system',
        actorName: 'System',
        action: 'photos_deleted',
        description: `ลบรูปส่งรถ ${deleted} ภาพ — rental ${plate} (${customerName})`,
        metadata: { rentalId, bikeId: rental.bike_id, count: deleted },
      })
    }

  } else {
    const { data: rental } = await admin
      .from('monthly_rentals')
      .select('id, bike_id, send_photos, return_photos, status, customers(name, phone), bikes(license_plate)')
      .eq('id', rentalId)
      .single()

    if (!rental) return NextResponse.json({ error: 'ไม่พบข้อมูลการเช่า' }, { status: 404 })
    if (rental.status === 'ended') return NextResponse.json({ error: 'สิ้นสุดแล้ว' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customerName = (rental.customers as any)?.name ?? 'ลูกค้า'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plate = (rental.bikes as any)?.license_plate ?? ''

    const deleted = await deletePhotosFromStorage(admin, rental.send_photos)
    await deletePhotosFromStorage(admin, rental.return_photos)

    await admin.from('monthly_rentals').update({
      status: 'ended',
      end_date: new Date().toISOString().split('T')[0],
      send_photos: [],
      return_photos: [],
    }).eq('id', rentalId)

    // เว้นแต่รถมีสัญญาอื่นเปิดค้างอยู่แล้ว (ปิดสัญญานี้ช้าหลังสัญญาใหม่บนคันเดียวกันเปิดไปแล้ว)
    if (!(await hasOpenContract(admin, rental.bike_id))) {
      await admin.from('bikes').update({ status: 'available' }).eq('id', rental.bike_id)
    }

    await writeLog({
      actorType: 'owner',
      actorId: user.id,
      actorName: ownerName,
      action: 'bike_returned',
      description: `คืนรถรายเดือน ${plate} — ลูกค้า ${customerName}`,
      metadata: { rentalId, bikeId: rental.bike_id, type: 'monthly' },
    })

    if (deleted > 0) {
      await writeLog({
        actorType: 'system',
        actorName: 'System',
        action: 'photos_deleted',
        description: `ลบรูปส่งรถ ${deleted} ภาพ — rental รายเดือน ${plate} (${customerName})`,
        metadata: { rentalId, bikeId: rental.bike_id, count: deleted },
      })
    }
  }

  return NextResponse.json({ success: true })
}
