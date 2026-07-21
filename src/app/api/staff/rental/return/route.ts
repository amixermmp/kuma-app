import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeLog } from '@/lib/log'
import { recalcNeverDoneRoutines } from '@/lib/routines'
import { hasOpenContract } from '@/lib/availability'

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
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    rentalId, bikeId,
    returnOdometer, returnFuel,
    damageFee, damageNotes,
    returnPhotoUrl, refundAmount,
    finalRentAmount, overtimeCharge, earlyReturnRefund,
  } = body

  if (!rentalId || !bikeId) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Get existing send_photos before clearing
  const { data: existing } = await supabase
    .from('rentals')
    .select('branch_id, send_photos, customers(name, phone), bikes(license_plate)')
    .eq('id', rentalId)
    .single()

  // Delete send_photos from storage
  const deleted = await deletePhotosFromStorage(supabase, existing?.send_photos)

  // Close the rental + clear photos
  const { error: rentalErr } = await supabase
    .from('rentals')
    .update({
      status: 'returned',
      actual_end_datetime: new Date().toISOString(),
      return_odometer: returnOdometer ?? null,
      return_fuel: returnFuel,
      damage_fee: damageFee ?? 0,
      damage_notes: damageNotes ?? null,
      return_photos: returnPhotoUrl ? [{ url: returnPhotoUrl, label: 'รูปรับคืน' }] : [],
      refund_amount: refundAmount,
      total_amount: finalRentAmount,
      send_photos: [],
    })
    .eq('id', rentalId)
    .in('status', ['active', 'extended'])

  if (rentalErr) {
    console.error('Return rental error:', rentalErr.message)
    return NextResponse.json({ error: 'บันทึกการคืนรถไม่สำเร็จ' }, { status: 500 })
  }

  // ลงสมุดรายรับ — ค่าล่วงเวลาเก็บตอนคืนรถ (หักจากมัดจำที่คืนลูกค้า)
  if (Number(overtimeCharge) > 0) {
    await supabase.from('rental_payments').insert({
      rental_id: rentalId,
      branch_id: existing?.branch_id ?? null,
      staff_id: staffId,
      kind: 'overtime',
      amount: Number(overtimeCharge),
    })
  }

  // คืนเงินค่าเช่าส่วนที่ไม่ได้ใช้ (คืนรถก่อนกำหนด) — ลงเป็นรายรับติดลบ ตามวันที่คืนจริง
  // เพื่อให้ยอดรายได้ (sum ของ rental_payments) หักลบถูกต้องตามเงินสดที่จ่ายคืนจริง
  if (Number(earlyReturnRefund) > 0) {
    await supabase.from('rental_payments').insert({
      rental_id: rentalId,
      branch_id: existing?.branch_id ?? null,
      staff_id: staffId,
      kind: 'early_return_refund',
      amount: -Number(earlyReturnRefund),
    })
  }

  // Set bike back to available — เว้นแต่รถมีสัญญาอื่นเปิดค้างอยู่แล้ว (เช่น ปิดสัญญานี้ช้า
  // หลังจากสัญญาใหม่บนคันเดียวกันเปิดไปแล้ว) กันสถานะ available ทับสัญญาที่ยังเปิดอยู่จริง
  const stillOpen = await hasOpenContract(supabase, bikeId)
  await supabase
    .from('bikes')
    .update({
      ...(stillOpen ? {} : { status: 'available' }),
      ...(returnOdometer ? { odometer: returnOdometer } : {}),
    })
    .eq('id', bikeId)

  if (returnOdometer) {
    await recalcNeverDoneRoutines(supabase, bikeId, Number(returnOdometer))
  }

  // Lookup staff name
  const { data: staffRow } = await supabase.from('staff').select('name').eq('id', staffId).single()
  const staffName = staffRow?.name ?? staffId
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customerName = (existing?.customers as any)?.name ?? 'ลูกค้า'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plate = (existing?.bikes as any)?.license_plate ?? ''

  // Log staff return
  await writeLog({
    actorType: 'staff',
    actorId: staffId,
    actorName: staffName,
    action: 'bike_returned',
    description: `รับรถคืน ${plate} — ลูกค้า ${customerName}${damageFee > 0 ? ` • ค่าเสียหาย ฿${damageFee}` : ''}`,
    metadata: { rentalId, bikeId, damageFee, refundAmount },
  })

  // Log system photo deletion
  if (deleted > 0) {
    await writeLog({
      actorType: 'system',
      actorName: 'System',
      action: 'photos_deleted',
      description: `ลบรูปส่งรถ ${deleted} ภาพ — rental ${plate} (${customerName})`,
      metadata: { rentalId, bikeId, count: deleted },
    })
  }

  return NextResponse.json({ success: true })
}
