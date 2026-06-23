import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    rentalId, bikeId,
    returnOdometer, returnFuel,
    damageFee, damageNotes,
    returnPhotoUrl, refundAmount,
    finalRentAmount,
  } = body

  if (!rentalId || !bikeId) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Close the rental
  const { error: rentalErr } = await supabase
    .from('rentals')
    .update({
      status: 'returned',
      actual_end_datetime: new Date().toISOString(),
      return_odometer: returnOdometer ?? null,
      return_fuel: returnFuel,
      damage_fee: damageFee ?? 0,
      damage_notes: damageNotes ?? null,
      return_photos: returnPhotoUrl ? { return: returnPhotoUrl } : {},
      refund_amount: refundAmount,
      total_amount: finalRentAmount,
    })
    .eq('id', rentalId)
    .in('status', ['active', 'extended'])

  if (rentalErr) {
    console.error('Return rental error:', rentalErr.message)
    return NextResponse.json({ error: 'บันทึกการคืนรถไม่สำเร็จ' }, { status: 500 })
  }

  // Set bike back to available
  await supabase
    .from('bikes')
    .update({
      status: 'available',
      ...(returnOdometer ? { odometer: returnOdometer } : {}),
    })
    .eq('id', bikeId)

  return NextResponse.json({ success: true })
}
