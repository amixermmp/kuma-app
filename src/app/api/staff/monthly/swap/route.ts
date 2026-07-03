import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeLog } from '@/lib/log'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rentalId, newBikeId, swapType, reason } = await request.json()
  if (!rentalId || !newBikeId || !swapType) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Fetch current rental
  const { data: rental, error: rentalErr } = await supabase
    .from('monthly_rentals')
    .select('id, bike_id, branch_id, monthly_rate, swap_log, bikes(license_plate), customers(name)')
    .eq('id', rentalId)
    .eq('status', 'active')
    .single()

  if (rentalErr || !rental) {
    return NextResponse.json({ error: 'ไม่พบสัญญาที่ active' }, { status: 404 })
  }

  const oldBikeId = rental.bike_id
  if (oldBikeId === newBikeId) {
    return NextResponse.json({ error: 'รถคันใหม่ต้องไม่ใช่คันเดิม' }, { status: 400 })
  }

  // Verify new bike is available and in same branch
  const { data: newBike } = await supabase
    .from('bikes')
    .select('id, license_plate, brand, model, status, branch_id')
    .eq('id', newBikeId)
    .single()

  if (!newBike) return NextResponse.json({ error: 'ไม่พบรถคันใหม่' }, { status: 404 })
  if (newBike.status !== 'available') {
    return NextResponse.json({ error: 'รถคันนี้ไม่ว่าง' }, { status: 400 })
  }
  if (newBike.branch_id !== rental.branch_id) {
    return NextResponse.json({ error: 'รถต้องอยู่สาขาเดียวกัน' }, { status: 400 })
  }

  // Build swap log entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oldPlate = (rental.bikes as any)?.license_plate ?? oldBikeId
  const newPlate = newBike.license_plate
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customerName = (rental.customers as any)?.name ?? '—'

  const logEntry = {
    date: new Date().toISOString().split('T')[0],
    from_bike_id: oldBikeId,
    from_plate: oldPlate,
    to_bike_id: newBikeId,
    to_plate: newPlate,
    type: swapType,        // 'temp' | 'permanent'
    reason: reason ?? null,
    staff_id: staffId,
  }

  const existingLog = Array.isArray(rental.swap_log) ? rental.swap_log : []

  // Update monthly rental — new bike + append log
  const { error: updateRentalErr } = await supabase
    .from('monthly_rentals')
    .update({
      bike_id: newBikeId,
      swap_log: [...existingLog, logEntry],
    })
    .eq('id', rentalId)

  if (updateRentalErr) {
    return NextResponse.json({ error: updateRentalErr.message }, { status: 500 })
  }

  // Old bike: 'repair' if temp, 'available' if permanent
  const oldBikeNewStatus = swapType === 'temp' ? 'repair' : 'available'
  await supabase.from('bikes').update({ status: oldBikeNewStatus }).eq('id', oldBikeId)

  // New bike → rented
  await supabase.from('bikes').update({ status: 'rented' }).eq('id', newBikeId)

  // Log
  const { data: staffRow } = await supabase.from('staff').select('name').eq('id', staffId).single()
  await writeLog({
    actorType: 'staff',
    actorId: staffId,
    actorName: staffRow?.name ?? staffId,
    action: 'monthly_swap',
    description: `สลับรถรายเดือน — ลูกค้า ${customerName} — ${oldPlate} → ${newPlate} (${swapType === 'temp' ? 'ชั่วคราว' : 'ถาวร'})`,
    metadata: { rentalId, oldBikeId, newBikeId, swapType, reason },
  })

  return NextResponse.json({ success: true })
}
