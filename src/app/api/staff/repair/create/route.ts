import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffOwnBranchId } from '@/lib/staffBranch'
import { logStaffAction } from '@/lib/log'
import { findBookingConflictsForBike } from '@/lib/bookingConflicts'
import { recalcNeverDoneRoutines } from '@/lib/routines'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const BRANCH_ID = await getStaffOwnBranchId(staffId)

  const { bikeId, description, photoUrl, locationType, locationAddress, instantDone, repairShop, repairCost, odometer } = await request.json()
  if (!bikeId || !description) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const supabase = createAdminClient()

  // ซ่อมเล็กน้อย รถไม่ต้องจอด — ซ่อมเสร็จแล้วจริง แค่บันทึกประวัติไว้ ไม่ต้องเปลี่ยนสถานะรถ/เช็คคิวจองเลย
  if (instantDone) {
    if (!odometer) return NextResponse.json({ error: 'กรุณากรอกเลขไมล์ปัจจุบัน' }, { status: 400 })

    const { data: repair, error: repairErr } = await supabase
      .from('repairs')
      .insert({
        bike_id: bikeId,
        branch_id: BRANCH_ID,
        title: description.substring(0, 100),
        description,
        status: 'done',
        location_type: 'shop',
        location_address: null,
        repair_photos: photoUrl ? [{ url: photoUrl, label: 'รูปตอนแจ้งซ่อม' }] : [],
        repair_shop: repairShop || null,
        repair_cost: repairCost ?? null,
        odometer,
        resolved_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (repairErr || !repair) {
      console.error('Repair create (instant) error:', repairErr?.message)
      return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
    }

    await supabase.from('bikes').update({ odometer }).eq('id', bikeId)
    await recalcNeverDoneRoutines(supabase, bikeId, Number(odometer) || 0)

    const { data: bike } = await supabase.from('bikes').select('license_plate').eq('id', bikeId).single()
    await logStaffAction(staffId, 'repair_created',
      `บันทึกซ่อมเล็กน้อย ${bike?.license_plate ?? ''} — ${description.substring(0, 80)}`,
      { repairId: repair.id, bikeId })

    return NextResponse.json({ success: true, repairId: repair.id, conflicts: [] })
  }

  if (!locationType || (locationType !== 'shop' && locationType !== 'offsite')) {
    return NextResponse.json({ error: 'กรุณาเลือกตำแหน่งรถ' }, { status: 400 })
  }
  if (locationType === 'offsite' && !locationAddress) {
    return NextResponse.json({ error: 'กรุณาระบุว่ารถอยู่ที่ไหน' }, { status: 400 })
  }

  // กันแจ้งซ้ำ — รถคันนี้ต้องไม่มีงานซ่อมเปิดค้างอยู่แล้ว (เผื่อข้าม picker เข้ามาตรงๆ หรือกดส่งซ้ำ)
  const { data: existingOpen } = await supabase
    .from('repairs')
    .select('id')
    .eq('bike_id', bikeId)
    .eq('status', 'in_progress')
    .maybeSingle()
  if (existingOpen) {
    return NextResponse.json({ error: 'รถคันนี้มีงานซ่อมเปิดค้างอยู่แล้ว', repairId: existingOpen.id }, { status: 409 })
  }

  const { data: repair, error: repairErr } = await supabase
    .from('repairs')
    .insert({
      bike_id: bikeId,
      branch_id: BRANCH_ID,
      title: description.substring(0, 100),
      description,
      status: 'in_progress',
      location_type: locationType,
      location_address: locationType === 'offsite' ? locationAddress : null,
      repair_photos: photoUrl ? [{ url: photoUrl, label: 'รูปตอนแจ้งซ่อม' }] : [],
    })
    .select('id')
    .single()

  if (repairErr || !repair) {
    console.error('Repair create error:', repairErr?.message)
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
  }

  const { error: statusErr } = await supabase.from('bikes').update({ status: 'repair' }).eq('id', bikeId)
  if (statusErr) console.error('[repair/create] bike status update failed:', bikeId, JSON.stringify(statusErr))

  const { data: bike } = await supabase.from('bikes').select('license_plate').eq('id', bikeId).single()
  await logStaffAction(staffId, 'repair_created',
    `แจ้งซ่อม ${bike?.license_plate ?? ''} — ${description.substring(0, 80)}`,
    { repairId: repair.id, bikeId })

  // เช็คว่ารถคันนี้มีคิวจองผูกอยู่ไหม — ถ้ามี ให้ frontend เด้งเตือนพนักงาน (ไม่บล็อกการแจ้งซ่อม)
  const conflicts = await findBookingConflictsForBike(supabase, bikeId)

  return NextResponse.json({ success: true, repairId: repair.id, conflicts })
}
