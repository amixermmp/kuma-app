import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { logStaffAction } from '@/lib/log'

// เปลี่ยนรุ่นที่จองไว้ (ไม่ผูกคันเจาะจง) — ใช้ตอนแก้ "คิวมีปัญหา" ที่รุ่นเดิมไม่มีรถว่างพอ
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bookingId, requestedBrand, requestedModel } = await request.json()
  if (!bookingId || !requestedBrand || !requestedModel) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booking_ref, status, requested_brand, requested_model')
    .eq('id', bookingId)
    .single()

  if (!booking || booking.status !== 'confirmed') {
    return NextResponse.json({ error: 'ไม่พบการจอง' }, { status: 404 })
  }

  const { error } = await supabase
    .from('bookings')
    .update({ bike_id: null, requested_brand: requestedBrand, requested_model: requestedModel })
    .eq('id', bookingId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logStaffAction(staffId, 'booking_reassigned_model',
    `เปลี่ยนรุ่นจอง ${booking.booking_ref} — ${booking.requested_brand ?? ''} ${booking.requested_model ?? ''} → ${requestedBrand} ${requestedModel}`,
    { bookingId, from: { brand: booking.requested_brand, model: booking.requested_model }, to: { brand: requestedBrand, model: requestedModel } })

  return NextResponse.json({ success: true })
}
