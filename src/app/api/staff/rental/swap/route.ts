import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeLog, logStaffAction } from '@/lib/log'
import { hasOpenContract } from '@/lib/availability'
import { findBookingConflictsForBike } from '@/lib/bookingConflicts'
import { resolveSingleBikeRate } from '@/lib/bikeCatalog'
import { recalcNeverDoneRoutines } from '@/lib/routines'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    rentalType, rentalId, newBikeId, reason, reassignBookingIds, returnedBikeOdometer,
    oldBikeBroken, brokenDescription, brokenLocationType, brokenLocationAddress,
  } = await request.json()

  if (!rentalType || !rentalId || !newBikeId) {
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
  let oldMonthlyRate = 0
  let oldBikeOdometer = 0

  if (rentalType === 'monthly') {
    const { data: rental, error } = await supabase
      .from('monthly_rentals')
      .select('id, bike_id, branch_id, monthly_rate, swap_log, bikes(license_plate, branch_id, odometer), customers(name)')
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    oldBikeOdometer = Number((rental.bikes as any)?.odometer) || 0
    existingSwapLog = Array.isArray(rental.swap_log) ? rental.swap_log : []
    oldMonthlyRate = rental.monthly_rate
  } else {
    const { data: rental, error } = await supabase
      .from('rentals')
      .select('id, bike_id, branch_id, swap_log, bikes(license_plate, branch_id, odometer), customers(name)')
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    oldBikeOdometer = Number((rental.bikes as any)?.odometer) || 0
    existingSwapLog = Array.isArray(rental.swap_log) ? rental.swap_log : []
  }

  if (oldBikeId === newBikeId) {
    return NextResponse.json({ error: 'รถคันใหม่ต้องไม่ใช่คันเดิม' }, { status: 400 })
  }

  // รถคันเดิมเสีย/ไม่ได้รถคืน (เสียไกล, หน้าปัดอ่านไมล์ไม่ได้) — ไม่ต้องกรอกไมล์ แต่ต้องสร้างใบงานซ่อมให้ในขั้นตอนนี้เลย
  // ไมล์จะถูกบังคับตอนกด "ซ่อมเสร็จ" แทน (กันรถติดสถานะซ่อมลอยๆ โดยไม่มีใบงาน จนหาไม่เจอ)
  const isBroken = oldBikeBroken === true
  const brokenDesc = typeof brokenDescription === 'string' ? brokenDescription.trim() : ''
  if (isBroken) {
    if (!brokenDesc) return NextResponse.json({ error: 'กรุณาระบุอาการเสีย' }, { status: 400 })
    if (brokenLocationType !== 'shop' && brokenLocationType !== 'offsite') {
      return NextResponse.json({ error: 'กรุณาเลือกตำแหน่งรถที่เสีย' }, { status: 400 })
    }
    if (brokenLocationType === 'offsite' && !(typeof brokenLocationAddress === 'string' && brokenLocationAddress.trim())) {
      return NextResponse.json({ error: 'กรุณาระบุว่ารถอยู่ที่ไหน' }, { status: 400 })
    }
  }

  // ไมล์คันที่ได้คืนมา — บังคับกรอก (เช็คก่อนแก้ข้อมูลอะไรทั้งหมด) ไม่งั้นไมล์ในระบบค้างค่าเก่า รูทีนเพี้ยน
  const returnedOdo = Number(returnedBikeOdometer)
  if (!isBroken) {
    if (returnedBikeOdometer === null || returnedBikeOdometer === undefined || returnedBikeOdometer === ''
      || !Number.isInteger(returnedOdo) || returnedOdo < 0) {
      return NextResponse.json({ error: `กรุณากรอกไมล์คันที่ได้คืนมา (${oldPlate})` }, { status: 400 })
    }
    if (returnedOdo < oldBikeOdometer) {
      return NextResponse.json({ error: `ไมล์ที่กรอก (${returnedOdo.toLocaleString()}) ต่ำกว่าไมล์ในระบบ (${oldBikeOdometer.toLocaleString()} กม.) — เช็คตัวเลขอีกครั้ง` }, { status: 400 })
    }
  }

  // ── 2. Verify new bike ───────────────────────────────────────────────────────
  const { data: newBikeRaw } = await supabase
    .from('bikes')
    .select('id, license_plate, brand, model, status, branch_id, monthly_rate, daily_rate')
    .eq('id', newBikeId)
    .single()

  if (!newBikeRaw) return NextResponse.json({ error: 'ไม่พบรถคันใหม่' }, { status: 404 })
  // เช่ารายเดือนที่สลับคันใหม่จะใช้ราคาคันใหม่ต่อไป — resolve เผื่อคันใหม่ไม่ได้ override ราคาไว้
  const newBike = await resolveSingleBikeRate(supabase, newBikeRaw)
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

  // ── 2.5 รถคันเดิมเสีย → สร้างใบงานซ่อมก่อนสลับ (ล้มเหลว = ยังไม่สลับอะไรเลย) ──────────
  // ถ้ามีใบงานซ่อมค้างของรถคันนี้อยู่แล้วก็ใช้ใบเดิม ไม่สร้างซ้ำ ไม่บล็อกการสลับหน้างาน
  let createdRepairId: string | null = null
  let repairTicketId: string | null = null
  if (isBroken) {
    const { data: existingOpen } = await supabase
      .from('repairs').select('id').eq('bike_id', oldBikeId).eq('status', 'in_progress').maybeSingle()
    if (existingOpen) {
      repairTicketId = existingOpen.id
    } else {
      const { data: repair, error: repairErr } = await supabase
        .from('repairs')
        .insert({
          bike_id: oldBikeId,
          branch_id: branchId,
          title: brokenDesc.substring(0, 100),
          description: brokenDesc,
          status: 'in_progress',
          location_type: brokenLocationType,
          location_address: brokenLocationType === 'offsite' ? String(brokenLocationAddress).trim() : null,
          repair_photos: [],
        })
        .select('id')
        .single()
      if (repairErr || !repair) {
        console.error('[rental/swap] repair create failed:', repairErr?.message)
        return NextResponse.json({ error: 'สร้างใบงานซ่อมไม่สำเร็จ — ยังไม่ได้สลับรถ ลองอีกครั้ง' }, { status: 500 })
      }
      createdRepairId = repair.id
      repairTicketId = repair.id
    }
  }
  const rollbackRepair = async () => {
    if (createdRepairId) await supabase.from('repairs').delete().eq('id', createdRepairId)
  }
  const swapReason = reason ?? (isBroken ? `รถเสีย: ${brokenDesc}` : null)

  // ── 3. Update rental ─────────────────────────────────────────────────────────
  if (rentalType === 'monthly') {
    const logEntry = {
      date: new Date().toISOString().split('T')[0],
      from_bike_id: oldBikeId,
      from_plate: oldPlate,
      to_bike_id: newBikeId,
      to_plate: newPlate,
      reason: swapReason,
      staff_id: staffId,
      // เก็บราคาก่อน/หลังสลับไว้ — ให้รอบบิลที่กำหนดชำระก่อนวันสลับยังอ้างอิงราคาเดิมได้ถูกต้อง
      // (ราคาใหม่มีผลแค่รอบถัดไป ไม่ย้อนหลังไปเก็บเพิ่มจากรอบที่ตกลงราคาไว้แล้ว)
      old_rate: oldMonthlyRate,
      new_rate: newBike.monthly_rate,
    }

    const { error } = await supabase
      .from('monthly_rentals')
      .update({ bike_id: newBikeId, branch_id: newBike.branch_id, monthly_rate: newBike.monthly_rate, swap_log: [...existingSwapLog, logEntry] })
      .eq('id', rentalId)

    if (error) { await rollbackRepair(); return NextResponse.json({ error: error.message }, { status: 500 }) }
  } else {
    const logEntry = {
      date: new Date().toISOString().split('T')[0],
      from_bike_id: oldBikeId,
      from_plate: oldPlate,
      to_bike_id: newBikeId,
      to_plate: newPlate,
      reason: swapReason,
      staff_id: staffId,
    }

    const { error } = await supabase
      .from('rentals')
      .update({ bike_id: newBikeId, branch_id: newBike.branch_id, swap_log: [...existingSwapLog, logEntry] })
      .eq('id', rentalId)

    if (error) { await rollbackRepair(); return NextResponse.json({ error: error.message }, { status: 500 }) }
  }

  // ── 4. Update bike statuses ───────────────────────────────────────────────────
  // คันเก่า → available เสมอ เว้นแต่มีสัญญาอื่นเปิดค้างอยู่แล้ว (edge case: มีสัญญาอื่นผูกคันนี้ควบคู่)
  // สลับรถไม่ใช่การแจ้งซ่อม — ถ้าคันเก่ามีปัญหาจริง พนักงานต้องกดแจ้งซ่อมแยกต่างหากที่หน้างาน
  // รถเสีย → ไปสถานะ "ซ่อม" ทันทีโดยไม่ผ่าน "ว่าง" (ค้นหารถว่างจะได้ไม่เห็นคันเสียเลย) — มีใบงานซ่อมสร้างไว้ให้แล้วด้านบน
  const oldBikeNewStatus = isBroken ? 'repair' : ((await hasOpenContract(supabase, oldBikeId)) ? null : 'available')
  const bikeUpdateResults = await Promise.all([
    ...(oldBikeNewStatus ? [supabase.from('bikes').update({ status: oldBikeNewStatus }).eq('id', oldBikeId)] : []),
    supabase.from('bikes').update({ status: 'rented' }).eq('id', newBikeId),
  ])
  // เคยเงียบไม่เช็ค error ตรงนี้ — ถ้า update ล้มเหลวรถจะค้างสถานะผิดแบบไม่มีร่องรอย
  for (const r of bikeUpdateResults) {
    if (r.error) console.error('[rental/swap] bike update failed:', JSON.stringify(r.error))
  }

  // ไมล์คันที่ได้คืนมา → อัปเดต + เลื่อนเป้ารูทีนที่ไม่เคยทำ (ทุกจุดที่เขียน bikes.odometer ต้องเรียกตัวนี้)
  // (รถเสียที่อ่านไมล์ไม่ได้ข้ามส่วนนี้ — ไมล์จะถูกบังคับกรอกตอนซ่อมเสร็จ)
  if (!isBroken) {
    const { error: odoErr } = await supabase.from('bikes').update({ odometer: returnedOdo }).eq('id', oldBikeId)
    if (odoErr) console.error('[rental/swap] odometer update failed:', oldBikeId, JSON.stringify(odoErr))
    else await recalcNeverDoneRoutines(supabase, oldBikeId, returnedOdo)
  }

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
  await writeLog({
    actorType: 'staff',
    actorId: staffId,
    actorName: staffRow?.name ?? staffId,
    action: 'rental_swap',
    description: `สลับรถ${typeLabel} — ลูกค้า ${customerName} — ${oldPlate} → ${newPlate}${bookingIds.length > 0 ? ` • สลับคิว ${bookingIds.length} รายการ` : ''}`,
    metadata: {
      rentalType, rentalId, oldBikeId, newBikeId, reason: swapReason, reassignBookingIds: bookingIds,
      ...(isBroken ? { oldBikeBroken: true, repairId: repairTicketId } : { returnedOdometer: returnedOdo }),
    },
  })
  if (createdRepairId) {
    await logStaffAction(staffId, 'repair_created',
      `แจ้งซ่อม ${oldPlate} (จากการสลับรถ) — ${brokenDesc.substring(0, 80)}`,
      { repairId: createdRepairId, bikeId: oldBikeId })
  }

  // เช็คคิวจองที่ยังผูกกับรถคันเก่า (ที่ไม่ได้ถูกเลือกให้โยกย้าย) และคันใหม่ — ถ้ามีปัญหาให้ frontend เด้งเตือน
  const [oldConflicts, newConflicts] = await Promise.all([
    findBookingConflictsForBike(supabase, oldBikeId),
    findBookingConflictsForBike(supabase, newBikeId),
  ])
  const conflicts = [...oldConflicts, ...newConflicts.filter(c => !oldConflicts.some(o => o.id === c.id))]

  return NextResponse.json({ success: true, conflicts })
}
