import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeLog } from '@/lib/log'

const BRANCH_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    bikeId, customerName, customerPhone, customerHotel,
    startDatetime, endDatetime, dailyRate, totalDays,
    totalAmount, depositAmount, paymentMethod, notes,
  } = body

  if (!bikeId || !customerName || !customerPhone || !startDatetime || !endDatetime) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Find or create customer
  let customerId: string
  const { data: existing } = await admin
    .from('customers')
    .select('id')
    .eq('phone', customerPhone)
    .eq('branch_id', BRANCH_ID)
    .maybeSingle()

  if (existing) {
    customerId = existing.id
    await admin.from('customers').update({ name: customerName, workplace: customerHotel || null }).eq('id', customerId)
  } else {
    const { data: newCust, error: custErr } = await admin
      .from('customers')
      .insert({ branch_id: BRANCH_ID, name: customerName, phone: customerPhone, workplace: customerHotel || null })
      .select('id')
      .single()
    if (custErr || !newCust) return NextResponse.json({ error: 'สร้างข้อมูลลูกค้าไม่สำเร็จ' }, { status: 500 })
    customerId = newCust.id
  }

  // Create rental
  const { data: rental, error: rentalErr } = await admin
    .from('rentals')
    .insert({
      branch_id: BRANCH_ID,
      bike_id: bikeId,
      customer_id: customerId,
      start_datetime: new Date(startDatetime).toISOString(),
      expected_end_datetime: new Date(endDatetime).toISOString(),
      daily_rate: dailyRate,
      total_days: totalDays,
      total_amount: totalAmount,
      deposit_amount: depositAmount || 0,
      payment_method: paymentMethod || 'cash',
      paid_amount: totalAmount,
      status: 'active',
      notes: notes || null,
      send_photos: [],
    })
    .select('id')
    .single()

  if (rentalErr || !rental) {
    console.error('[owner/rental/create]', rentalErr?.message)
    return NextResponse.json({ error: 'บันทึกการเช่าไม่สำเร็จ' }, { status: 500 })
  }

  // Update bike status
  const { error: bikeErr } = await admin
    .from('bikes')
    .update({ status: 'rented' })
    .eq('id', bikeId)

  if (bikeErr) console.error('[owner/rental/create] bike update error:', bikeErr.message)

  // Log
  await writeLog({
    actorType: 'owner',
    actorId: user.id,
    actorName: user.email ?? 'Owner',
    action: 'rental_created',
    description: `Owner ส่งรถให้ลูกค้า ${customerName} (${customerPhone}) — ฿${totalAmount?.toLocaleString() ?? 0} / ${totalDays} วัน`,
    metadata: { rentalId: rental.id, bikeId, customerId, totalAmount, totalDays },
  })

  return NextResponse.json({ success: true, rentalId: rental.id })
}
