import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { logStaffAction } from '@/lib/log'

// ย้ายตำแหน่งรถของงานซ่อมที่เปิดอยู่ (อยู่ร้าน <-> นอกร้าน) — แก้ใบเดิม ไม่สร้างงานซ่อมใหม่ซ้ำ
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { repairId, locationType, locationAddress, photoUrl } = await request.json()
  if (!repairId || (locationType !== 'shop' && locationType !== 'offsite')) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }
  if (locationType === 'offsite' && !locationAddress) {
    return NextResponse.json({ error: 'กรุณาระบุว่ารถอยู่ที่ไหน' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: repair } = await supabase
    .from('repairs')
    .select('id, bike_id, status, location_type, location_address, location_log')
    .eq('id', repairId)
    .single()

  if (!repair) return NextResponse.json({ error: 'ไม่พบงานซ่อม' }, { status: 404 })
  if (repair.status !== 'in_progress') return NextResponse.json({ error: 'งานซ่อมนี้ปิดไปแล้ว' }, { status: 400 })

  const logEntry = {
    date: new Date().toISOString(),
    from_location: repair.location_type,
    from_address: repair.location_address,
    to_location: locationType,
    to_address: locationType === 'offsite' ? locationAddress : null,
    photo_url: photoUrl || null,
    staff_id: staffId,
  }
  const existingLog = Array.isArray(repair.location_log) ? repair.location_log : []

  const { error } = await supabase
    .from('repairs')
    .update({
      location_type: locationType,
      location_address: locationType === 'offsite' ? locationAddress : null,
      location_log: [...existingLog, logEntry],
    })
    .eq('id', repairId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: bike } = await supabase.from('bikes').select('license_plate').eq('id', repair.bike_id).single()
  await logStaffAction(staffId, 'repair_location_updated',
    `ย้ายรถซ่อม ${bike?.license_plate ?? ''} → ${locationType === 'offsite' ? `นอกร้าน (${locationAddress})` : 'อยู่ที่ร้าน'}`,
    { repairId, locationType, locationAddress })

  return NextResponse.json({ success: true })
}
