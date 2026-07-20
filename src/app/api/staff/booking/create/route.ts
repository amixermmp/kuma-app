import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffOwnBranchId } from '@/lib/staffBranch'
import { logStaffAction } from '@/lib/log'
import { getBusyBikeIds, BUFFER_MS } from '@/lib/availability'

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
    // specific bike booking (old flow / BookingForm)
    bikeId,
    // model-based booking (new flow / BookingModelForm)
    requestedBrand,
    requestedModel,
    requestedDailyRate,
    // common fields
    staffId,
    customerName, customerPhone, customerHotel,
    startDatetime, endDatetime,
    totalDays, dailyRate, totalAmount, discount,
    source, promoId, notes,
    deliveryType, deliveryAddress,
  } = body

  if (!staffId || !customerName || !customerPhone || !startDatetime || !endDatetime) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  // Must have either a specific bikeId OR a requested model
  if (!bikeId && (!requestedBrand || !requestedModel)) {
    return NextResponse.json({ error: 'ต้องระบุรถหรือรุ่นที่ต้องการ' }, { status: 400 })
  }

  const BRANCH_ID = await getStaffOwnBranchId(staffId)
  const supabase = createAdminClient()

  const bufferStart = new Date(new Date(startDatetime).getTime() - BUFFER_MS).toISOString()
  const bufferEnd = new Date(new Date(endDatetime).getTime() + BUFFER_MS).toISOString()

  // รถไม่ว่างจากสัญญาเช่า — ตัวกลาง เดียวกับทุกจุดในระบบ (กันเกินกำหนดยังไม่คืนหลุดคิว)
  const busyIds = await getBusyBikeIds(supabase, startDatetime, endDatetime)

  // If specific bike: check for conflicts
  if (bikeId) {
    if (busyIds.has(bikeId)) {
      return NextResponse.json({ error: 'รถถูกเช่าหรือจองในช่วงเวลานี้แล้ว' }, { status: 409 })
    }
    const { data: bookingConflict } = await supabase.from('bookings')
      .select('id')
      .eq('bike_id', bikeId)
      .eq('status', 'confirmed')
      .lt('start_datetime', bufferEnd)
      .gt('end_datetime', bufferStart)
      .maybeSingle()
    if (bookingConflict) {
      return NextResponse.json({ error: 'รถถูกเช่าหรือจองในช่วงเวลานี้แล้ว' }, { status: 409 })
    }
  }

  // If model-based: verify there is at least one available bike of that model
  if (!bikeId && requestedBrand && requestedModel) {
    const [{ data: candidateBikes }, { data: bookingConflicts }] = await Promise.all([
      supabase.from('bikes')
        .select('id, brand, model')
        .eq('branch_id', BRANCH_ID)
        .eq('brand', requestedBrand)
        .eq('model', requestedModel)
        .not('status', 'in', '("repair","maintenance","locked","retired","inactive")'),
      supabase.from('bookings')
        .select('bike_id, requested_brand, requested_model')
        .eq('branch_id', BRANCH_ID)
        .eq('status', 'confirmed')
        .lt('start_datetime', bufferEnd)
        .gt('end_datetime', bufferStart),
    ])

    // Count model-based bookings that consume available slots
    const modelBookingCount = (bookingConflicts ?? [])
      .filter(b => !b.bike_id && b.requested_brand === requestedBrand && b.requested_model === requestedModel)
      .length

    const freeBikes = (candidateBikes ?? []).filter(b => !busyIds.has(b.id) && !(bookingConflicts ?? []).some(bc => bc.bike_id === b.id))
    const actualAvailable = freeBikes.length - modelBookingCount

    if (actualAvailable <= 0) {
      return NextResponse.json({ error: `ไม่มี ${requestedBrand} ${requestedModel} ว่างในช่วงเวลานี้ กรุณาเลือกรถรุ่นอื่น` }, { status: 409 })
    }
  }

  const bookingRef = genRef()

  const { data: booking, error } = await supabase
    .from('bookings')
    .insert({
      branch_id: BRANCH_ID,
      bike_id: bikeId ?? null,
      requested_brand: bikeId ? null : (requestedBrand ?? null),
      requested_model: bikeId ? null : (requestedModel ?? null),
      requested_daily_rate: bikeId ? null : (requestedDailyRate ?? dailyRate ?? null),
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
      delivery_type: deliveryType === 'offsite' ? 'offsite' : 'shop',
      delivery_address: deliveryType === 'offsite' ? (deliveryAddress || null) : null,
    })
    .select('id, booking_ref')
    .single()

  if (error || !booking) {
    return NextResponse.json({ error: error?.message ?? 'บันทึกการจองไม่สำเร็จ' }, { status: 500 })
  }

  let bikeText = `${requestedBrand ?? ''} ${requestedModel ?? ''}`.trim()
  if (bikeId) {
    const { data: bike } = await supabase.from('bikes').select('license_plate').eq('id', bikeId).single()
    bikeText = bike?.license_plate ?? bikeId
  }
  await logStaffAction(staffId, 'booking_created',
    `จองคิว ${booking.booking_ref} — ${bikeText} — ลูกค้า ${customerName} (${customerPhone}) — ฿${Number(totalAmount ?? 0).toLocaleString()} / ${totalDays} วัน`,
    { bookingId: booking.id, bikeId: bikeId ?? null, requestedBrand, requestedModel, totalAmount })

  return NextResponse.json({ success: true, bookingId: booking.id, bookingRef: booking.booking_ref })
}
