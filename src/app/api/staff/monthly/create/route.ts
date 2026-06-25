import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BRANCH_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const {
    bikeId, staffId,
    customer,
    startDate,
    paymentDay,
    monthlyRate,
    depositAmount,
    odometer,
    fuelLevel,
    paymentMethod,
    photos,
    signature,
  } = body

  if (!bikeId || !staffId || !customer?.name || !customer?.phone || !startDate || !monthlyRate) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Upsert customer
  let customerId: string
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('phone', customer.phone)
    .eq('branch_id', BRANCH_ID)
    .maybeSingle()

  if (existing) {
    customerId = existing.id
    await supabase.from('customers').update({
      name: customer.name,
      workplace: customer.address || null,
    }).eq('id', customerId)
  } else {
    const { data: newCustomer, error: cErr } = await supabase
      .from('customers')
      .insert({
        branch_id: BRANCH_ID,
        name: customer.name,
        phone: customer.phone,
        workplace: customer.address || null,
      })
      .select('id')
      .single()
    if (cErr || !newCustomer) {
      return NextResponse.json({ error: 'สร้างลูกค้าไม่สำเร็จ' }, { status: 500 })
    }
    customerId = newCustomer.id
  }

  // Create monthly rental
  const sendPhotos = Object.entries(photos as Record<string, string>)
    .filter(([, url]) => url)
    .map(([label, url]) => ({ label, url }))

  const { data: rental, error: rErr } = await supabase
    .from('monthly_rentals')
    .insert({
      branch_id: BRANCH_ID,
      bike_id: bikeId,
      customer_id: customerId,
      staff_id: staffId,
      start_date: startDate,
      payment_day: paymentDay,
      monthly_rate: monthlyRate,
      deposit_amount: depositAmount || 0,
      status: 'active',
      send_photos: sendPhotos,
      customer_signature: signature ?? null,
    })
    .select('id')
    .single()

  if (rErr || !rental) {
    return NextResponse.json({ error: rErr?.message ?? 'บันทึกสัญญาไม่สำเร็จ' }, { status: 500 })
  }

  // Update bike status + odometer + fuel
  await supabase.from('bikes').update({
    status: 'rented',
    odometer: parseInt(odometer) || 0,
    fuel_level: fuelLevel,
    updated_at: new Date().toISOString(),
  }).eq('id', bikeId)

  // Record first payment
  if (paymentMethod) {
    // first month payment note — stored as JSON in notes
    await supabase.from('monthly_payments').insert({
      monthly_rental_id: rental.id,
      due_date: startDate,
      paid_date: startDate,
      amount: monthlyRate,
      payment_method: paymentMethod,
      status: 'paid',
    })
  }

  return NextResponse.json({ success: true, rentalId: rental.id })
}
