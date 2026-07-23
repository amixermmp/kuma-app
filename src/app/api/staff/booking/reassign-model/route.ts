import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { logStaffAction } from '@/lib/log'

// เปลี่ยนรุ่นที่จองไว้ (ไม่ผูกคันเจาะจง) — ใช้ตอนแก้ "คิวมีปัญหา" ที่รุ่นเดิมไม่มีรถว่างพอ
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bookingId, requestedBrand, requestedModel, reason } = await request.json()
  if (!bookingId || !requestedBrand || !requestedModel) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booking_ref, status, requested_brand, requested_model, original_requested_brand, original_requested_model')
    .eq('id', bookingId)
    .single()

  if (!booking || booking.status !== 'confirmed') {
    return NextResponse.json({ error: 'ไม่พบการจอง' }, { status: 404 })
  }

  // เก็บรุ่นที่ลูกค้าจองไว้ตั้งแต่แรกไว้ครั้งเดียว (ถ้าเคยเปลี่ยนมาแล้วรอบก่อน ไม่ทับด้วยรุ่นที่เพิ่งเปลี่ยนล่าสุด)
  // เอาไว้โชว์เตือนพนักงานหน้าส่งรถ ว่าลูกค้าอาจถือใบจองเดิม (รุ่นแรกสุด) มา
  const originalBrand = booking.original_requested_brand ?? booking.requested_brand
  const originalModel = booking.original_requested_model ?? booking.requested_model

  const { error } = await supabase
    .from('bookings')
    .update({
      bike_id: null, requested_brand: requestedBrand, requested_model: requestedModel,
      original_requested_brand: originalBrand, original_requested_model: originalModel,
      reassign_reason: reason || null,
    })
    .eq('id', bookingId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logStaffAction(staffId, 'booking_reassigned_model',
    `เปลี่ยนรุ่นจอง ${booking.booking_ref} — ${booking.requested_brand ?? ''} ${booking.requested_model ?? ''} → ${requestedBrand} ${requestedModel}`,
    { bookingId, from: { brand: booking.requested_brand, model: booking.requested_model }, to: { brand: requestedBrand, model: requestedModel } })

  return NextResponse.json({ success: true })
}
