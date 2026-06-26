import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeLog } from '@/lib/log'

const BRANCH_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    bikeId, customer, startDatetime, endDatetime,
    dailyRate, totalDays, totalAmount, depositAmount,
    discount, paymentMethod, fuelLevel, odometer, photos, signature,
  } = body

  if (!bikeId || !customer?.name || !customer?.phone || !startDatetime || !endDatetime) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Find or create customer
  let customerId: string
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('phone', customer.phone)
    .eq('branch_id', BRANCH_ID)
    .maybeSingle()

  if (existing) {
    customerId = existing.id
    await supabase
      .from('customers')
      .update({ name: customer.name, workplace: customer.hotel || null })
      .eq('id', customerId)
  } else {
    const { data: newCust, error: custErr } = await supabase
      .from('customers')
      .insert({ branch_id: BRANCH_ID, name: customer.name, phone: customer.phone, workplace: customer.hotel || null })
      .select('id')
      .single()
    if (custErr || !newCust) return NextResponse.json({ error: 'สร้างข้อมูลลูกค้าไม่สำเร็จ' }, { status: 500 })
    customerId = newCust.id
  }

  // Create rental
  const { data: rental, error: rentalErr } = await supabase
    .from('rentals')
    .insert({
      branch_id: BRANCH_ID,
      bike_id: bikeId,
      customer_id: customerId,
      staff_id: staffId,
      start_datetime: new Date(startDatetime).toISOString(),
      expected_end_datetime: new Date(endDatetime).toISOString(),
      daily_rate: dailyRate,
      total_days: totalDays,
      total_amount: totalAmount,
      deposit_amount: depositAmount || 0,
      discount: discount || 0,
      payment_method: paymentMethod,
      paid_amount: totalAmount,
      status: 'active',
      notes: `น้ำมัน ${fuelLevel}/8 แถบ • ไมล์ ${odometer}`,
      send_photos: photos ?? {},
      customer_signature: signature ?? null,
    })
    .select('id')
    .single()

  if (rentalErr || !rental) {
    return NextResponse.json({ error: 'บันทึกการเช่าไม่สำเร็จ' }, { status: 500 })
  }

  // Update bike status
  const { error: bikeErr } = await supabase
    .from('bikes')
    .update({ status: 'rented', odometer: parseInt(odometer) || 0 })
    .eq('id', bikeId)

  if (bikeErr) {
    console.error('[rental/create] bike update error:', JSON.stringify(bikeErr))
  }

  // Lookup staff name for log
  const { data: staffRow } = await supabase.from('staff').select('name').eq('id', staffId).single()
  const staffName = staffRow?.name ?? staffId

  await writeLog({
    actorType: 'staff',
    actorId: staffId,
    actorName: staffName,
    action: 'rental_created',
    description: `ส่งรถให้ลูกค้า ${customer.name} (${customer.phone}) — ฿${totalAmount?.toLocaleString() ?? 0} / ${totalDays} วัน`,
    metadata: { rentalId: rental.id, bikeId, customerId, totalAmount, totalDays },
  })

  return NextResponse.json({ success: true, rentalId: rental.id })
}
