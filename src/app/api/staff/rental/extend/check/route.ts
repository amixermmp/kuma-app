import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findModelBookingConflict } from '@/lib/bookingConflicts'

// เช็คว่าถ้าต่อเวลาถึง newEndDatetime จะชนคิวจองไหม — ไม่บันทึกอะไรเลย (ไม่เก็บเงิน ไม่แก้สัญญา)
// ใช้ตอนพนักงานอยากตอบลูกค้าก่อนว่า "ต่อได้ไหม" โดยยังไม่ตัดสินใจจ่ายเงินจริง (เช่นช่วงเทศกาลที่คิวแน่น)
export async function POST(request: NextRequest) {
  const { rentalId, newEndDatetime } = await request.json()
  if (!rentalId || !newEndDatetime) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: current, error: fetchErr } = await supabase
    .from('rentals')
    .select('branch_id, bike_id, bikes(brand, model)')
    .eq('id', rentalId)
    .in('status', ['active', 'extended'])
    .single()

  if (fetchErr || !current) {
    return NextResponse.json({ error: 'ไม่พบรายการเช่า' }, { status: 404 })
  }

  const bufferMs = 3 * 3_600_000
  const { data: conflictBookings } = await supabase
    .from('bookings')
    .select('id, booking_ref, customer_name, start_datetime')
    .eq('bike_id', current.bike_id)
    .eq('status', 'confirmed')
    .lt('start_datetime', new Date(new Date(newEndDatetime).getTime() + bufferMs).toISOString())
    .gt('end_datetime', new Date().toISOString())
  let conflict = (conflictBookings ?? [])[0]

  if (!conflict) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bikeInfo = Array.isArray((current as any).bikes) ? (current as any).bikes[0] : (current as any).bikes
    if (bikeInfo?.brand && bikeInfo?.model) {
      const modelConflict = await findModelBookingConflict(
        supabase, current.branch_id, bikeInfo.brand, bikeInfo.model, current.bike_id, new Date().toISOString(), newEndDatetime,
      )
      if (modelConflict) conflict = modelConflict
    }
  }

  return NextResponse.json({
    ok: !conflict,
    conflict: conflict ? {
      bookingRef: conflict.booking_ref,
      customerName: conflict.customer_name,
      startDatetime: conflict.start_datetime,
    } : null,
  })
}
