import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { logStaffAction } from '@/lib/log'

// ปลดล็อครถที่ค้างสถานะ locked โดยไม่มีสัญญา (เช่น ล็อคไว้รอสลับแล้วไม่ได้สลับ)
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bikeId } = await request.json()
  if (!bikeId) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const supabase = createAdminClient()

  const [{ data: bike }, { data: activeRental }, { data: activeMonthly }] = await Promise.all([
    supabase.from('bikes').select('id, license_plate, status').eq('id', bikeId).single(),
    supabase.from('rentals').select('id').eq('bike_id', bikeId).in('status', ['active', 'extended']).maybeSingle(),
    supabase.from('monthly_rentals').select('id').eq('bike_id', bikeId).eq('status', 'active').maybeSingle(),
  ])

  if (!bike) return NextResponse.json({ error: 'ไม่พบรถ' }, { status: 404 })
  if (bike.status !== 'locked') return NextResponse.json({ error: 'รถไม่ได้อยู่ในสถานะล็อค' }, { status: 400 })
  if (activeRental || activeMonthly) {
    return NextResponse.json({ error: 'รถมีสัญญาเช่าค้างอยู่ — ใช้ปุ่มรับรถคืน/สิ้นสุดสัญญาแทน' }, { status: 400 })
  }

  const { error } = await supabase.from('bikes').update({ status: 'available' }).eq('id', bikeId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logStaffAction(staffId, 'bike_unlocked',
    `ปลดล็อครถ ${bike.license_plate} — กลับเป็นสถานะว่าง`,
    { bikeId })

  return NextResponse.json({ success: true })
}
