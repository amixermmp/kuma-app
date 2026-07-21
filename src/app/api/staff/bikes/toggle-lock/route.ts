import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasOpenContract } from '@/lib/availability'
import { logStaffAction } from '@/lib/log'

// สลับล็อค/ปลดล็อครถที่ "กำลังเช่าอยู่" (มีสัญญาเปิดค้าง) — ใช้ตอนลูกค้าต่อสัญญาเรื่อยๆ
// จนรู้ว่าจะอยู่ยาว แล้วอยากซ่อนจากการค้นหาทีหลัง (ตอนส่งรถเลือกไม่ล็อคไว้ตั้งแต่แรก)
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bikeId } = await request.json()
  if (!bikeId) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const supabase = createAdminClient()

  const { data: bike } = await supabase.from('bikes').select('id, license_plate, status').eq('id', bikeId).single()
  if (!bike) return NextResponse.json({ error: 'ไม่พบรถ' }, { status: 404 })
  if (bike.status !== 'rented' && bike.status !== 'locked') {
    return NextResponse.json({ error: 'ใช้ปุ่มนี้ได้เฉพาะรถที่กำลังเช่าอยู่' }, { status: 400 })
  }
  if (!(await hasOpenContract(supabase, bikeId))) {
    return NextResponse.json({ error: 'รถคันนี้ไม่มีสัญญาเปิดอยู่ — ใช้ปุ่มปลดล็อคในหน้าเมนูรถแทน' }, { status: 400 })
  }

  const newStatus = bike.status === 'locked' ? 'rented' : 'locked'
  const { error } = await supabase.from('bikes').update({ status: newStatus }).eq('id', bikeId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logStaffAction(staffId, newStatus === 'locked' ? 'bike_locked' : 'bike_unlocked',
    `${newStatus === 'locked' ? 'ล็อค' : 'ปลดล็อค'}รถ ${bike.license_plate} — ${newStatus === 'locked' ? 'ซ่อนจากการค้นหาจนกว่าจะรับคืน' : 'กลับมาแสดงในการค้นหาตามปกติ'}`,
    { bikeId, newStatus })

  return NextResponse.json({ success: true, status: newStatus })
}
