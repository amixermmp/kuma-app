import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeLog } from '@/lib/log'
import { hasOpenContract } from '@/lib/availability'
import { findBookingConflictsForBike } from '@/lib/bookingConflicts'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rentalType, rentalId, newBikeId, swapType, reason, reassignBookingIds } =
    await request.json()

  if (!rentalType || !rentalId || !newBikeId || !swapType) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }
  if (rentalType !== 'daily' && rentalType !== 'monthly') {
    return NextResponse.json({ error: 'rentalType ไม่ถูกต้อง' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // ── 1. Fetch rental ──────────────────────────────────────────────────────────
  let oldBikeId: string
  let branchId: string
  let customerName: string
  let oldPlate: string
  let existingSwapLog: unknown[] = []

  if (rentalType === 'monthly') {
    const { data: rental, error } = await supabase
      .from('monthly_rentals')
      .select('id, bike_id, branch_id, swap_log, bikes(license_plate, branch_id), customers(name)')
      .eq('id', rentalId)
      .eq('status', 'active')
      .single()

    if (error || !rental) return NextResponse.json({ error: 'ไม่พบสัญญาที่ active' }, { status: 404 })

    oldBikeId = rental.bike_id
    // สาขาของรถคันปัจจุบัน (ที่รถอยู่จริง) ไม่ใช่ branch สัญญาที่อาจเพี้ยน
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    branchId = (rental.bikes as any)?.branch_id ?? rental.branch_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    customerName = (rental.customers as any)?.name ?? '—'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    oldPlate = (rental.bikes as any)?.license_plate ?? oldBikeId
    existingSwapLog = Array.isArray(rental.swap_log) ? rental.swap_log : []
  } else {
    const { data: rental, error } = await supabase
      .from('rentals')
      .select('id, bike_id, branch_id, bikes(license_plate, branch_id), customers(name)')
      .eq('id', rentalId)
      .in('status', ['active', 'extended'])
      .single()

    if (error || !rental) return NextResponse.json({ error: 'ไม่พบการเช่าที่ active' }, { status: 404 })

    oldBikeId = rental.bike_id
    // สาขาของรถคันปัจจุบัน (ที่รถอยู่จริง) ไม่ใช่ branch สัญญาที่อาจเพี้ยน
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    branchId = (rental.bikes as any)?.branch_id ?? rental.branch_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    customerName = (rental.customers as any)?.name ?? '—'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    oldPlate = (rental.bikes as any)?.license_plate ?? oldBikeId
  }

  if (oldBikeId === newBikeId) {
    return NextResponse.json({ error: 'รถคันใหม่ต้องไม่ใช่คันเดิม' }, { status: 400 })
  }

  // ── 2. Verify new bike ───────────────────────────────────────────────────────
  const { data: newBike } = await supabase
    .from('bikes')
    .select('id, license_plate, brand, model, status, branch_id, monthly_rate, daily_rate')
    .eq('id', newBikeId)
    .single()

  if (!newBike) return NextResponse.json({ error: 'ไม่พบรถคันใหม่' }, { status: 404 })
  if (newBike.status !== 'available') {
    return NextResponse.json({ error: 'รถคันนี้ไม่ว่าง' }, { status: 400 })
  }
  if (newBike.branch_id !== branchId) {
    return NextResponse.json({ error: 'รถต้องอยู่สาขาเดียวกัน' }, { status: 400 })
  }
  // Guard: สถานะรถอาจค้าง — เช็คสัญญาจริงด้วย กันสลับไปคันที่มีสัญญาค้าง
  if (await hasOpenContract(supabase, newBikeId)) {
    return NextResponse.json({ error: 'รถคันนี้ยังมีสัญญาค้างอยู่ สลับไปไม่ได้' }, { status: 409 })
  }

  const newPlate = newBike.license_plate

  // ── 3. Update rental ─────────────────────────────────────────────────────────
  if (rentalType === 'monthly') {
    const logEntry = {
      date: new Date().toISOString().split('T')[0],
      from_bike_id: oldBikeId,
      from_plate: oldPlate,
      to_bike_id: newBikeId,
      to_plate: newPlate,
      type: swapType,
      reason: reason ?? null,
      staff_id: staffId,
    }

    const { error } = await supabase
      .from('monthly_rentals')
      .update({ bike_id: newBikeId, branch_id: newBike.branch_id, monthly_rate: newBike.monthly_rate, swap_log: [...existingSwapLog, logEntry] })
      .eq('id', rentalId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase
      .from('rentals')
      .update({ bike_id: newBikeId, branch_id: newBike.branch_id })
      .eq('id', rentalId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── 4. Update bike statuses ───────────────────────────────────────────────────
  // คันเก่า permanent → available เว้นแต่มีสัญญาอื่นเปิดค้างอยู่แล้ว (edge case: มีสัญญาอื่นผูกคันนี้ควบคู่)
  const oldBikeNewStatus = swapType === 'temp' ? 'repair' : (await hasOpenContract(supabase, oldBikeId)) ? null : 'available'
  await Promise.all([
    ...(oldBikeNewStatus ? [supabase.from('bikes').update({ status: oldBikeNewStatus }).eq('id', oldBikeId)] : []),
    supabase.from('bikes').update({ status: 'rented' }).eq('id', newBikeId),
  ])

  // ── 5. Reassign bookings (queue) ─────────────────────────────────────────────
  const bookingIds: string[] = Array.isArray(reassignBookingIds) ? reassignBookingIds : []
  if (bookingIds.length > 0) {
    await supabase
      .from('bookings')
      .update({ bike_id: newBikeId })
      .in('id', bookingIds)
  }

  // ── 6. Log ───────────────────────────────────────────────────────────────────
  const { data: staffRow } = await supabase.from('staff').select('name').eq('id', staffId).single()
  const typeLabel = rentalType === 'monthly' ? 'รายเดือน' : 'รายวัน'
  const swapLabel = swapType === 'temp' ? 'ชั่วคราว' : 'ถาวร'
  await writeLog({
    actorType: 'staff',
    actorId: staffId,
    actorName: staffRow?.name ?? staffId,
    action: 'rental_swap',
    description: `สลับรถ${typeLabel} — ลูกค้า ${customerName} — ${oldPlate} → ${newPlate} (${swapLabel})${bookingIds.length > 0 ? ` • สลับคิว ${bookingIds.length} รายการ` : ''}`,
    metadata: { rentalType, rentalId, oldBikeId, newBikeId, swapType, reason, reassignBookingIds: bookingIds },
  })

  // เช็คคิวจองที่ยังผูกกับรถคันเก่า (ที่ไม่ได้ถูกเลือกให้โยกย้าย) และคันใหม่ — ถ้ามีปัญหาให้ frontend เด้งเตือน
  const [oldConflicts, newConflicts] = await Promise.all([
    findBookingConflictsForBike(supabase, oldBikeId),
    findBookingConflictsForBike(supabase, newBikeId),
  ])
  const conflicts = [...oldConflicts, ...newConflicts.filter(c => !oldConflicts.some(o => o.id === c.id))]

  return NextResponse.json({ success: true, conflicts })
}
