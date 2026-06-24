import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BRANCH_ID = '00000000-0000-0000-0000-000000000001'

function genRef() {
  const d = new Date()
  const yy = String(d.getFullYear()).slice(-2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const rnd = Math.floor(Math.random() * 9000) + 1000
  return `KM${yy}${mm}${dd}-${rnd}`
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const {
    bikeId, staffId,
    customerName, customerPhone, customerHotel,
    startDatetime, endDatetime,
    totalDays, dailyRate, totalAmount, discount,
    source, promoId, notes,
  } = body

  if (!bikeId || !staffId || !customerName || !customerPhone || !startDatetime || !endDatetime) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Check for conflicts before saving
  const bufferStart = new Date(new Date(startDatetime).getTime() - 3 * 3_600_000).toISOString()

  const [{ data: rentalConflict }, { data: bookingConflict }] = await Promise.all([
    supabase.from('rentals')
      .select('id')
      .eq('bike_id', bikeId)
      .in('status', ['active', 'extended'])
      .lt('start_datetime', endDatetime)
      .gt('expected_end_datetime', bufferStart)
      .maybeSingle(),
    supabase.from('bookings')
      .select('id')
      .eq('bike_id', bikeId)
      .eq('status', 'confirmed')
      .lt('start_datetime', endDatetime)
      .gt('end_datetime', bufferStart)
      .maybeSingle(),
  ])

  if (rentalConflict || bookingConflict) {
    return NextResponse.json({ error: 'รถถูกเช่าหรือจองในช่วงเวลานี้แล้ว' }, { status: 409 })
  }

  const bookingRef = genRef()

  const { data: booking, error } = await supabase
    .from('bookings')
    .insert({
      branch_id: BRANCH_ID,
      bike_id: bikeId,
      staff_id: staffId,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_hotel: customerHotel || null,
      start_datetime: startDatetime,
      end_datetime: endDatetime,
      total_days: totalDays,
      daily_rate: dailyRate,
      total_amount: totalAmount,
      discount: discount || 0,
      source: source || 'line',
      promo_id: promoId || null,
      notes: notes || null,
      status: 'confirmed',
      booking_ref: bookingRef,
    })
    .select('id, booking_ref')
    .single()

  if (error || !booking) {
    return NextResponse.json({ error: error?.message ?? 'บันทึกการจองไม่สำเร็จ' }, { status: 500 })
  }

  return NextResponse.json({ success: true, bookingId: booking.id, bookingRef: booking.booking_ref })
}
