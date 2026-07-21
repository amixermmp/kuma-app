import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { recalcNeverDoneRoutines } from '@/lib/routines'
import { logStaffAction } from '@/lib/log'
import { hasOpenContract } from '@/lib/availability'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { monthlyRentalId, returnPhotos, returnNote, returnOdometer, earlyReturnRefund } = await request.json()
  if (!monthlyRentalId) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const supabase = createAdminClient()

  // Fetch rental to get bike_id
  const { data: rental, error: rentalErr } = await supabase
    .from('monthly_rentals')
    .select('id, bike_id, status, bikes(license_plate), customers(name)')
    .eq('id', monthlyRentalId)
    .eq('status', 'active')
    .single()

  if (rentalErr || !rental) {
    return NextResponse.json({ error: 'ไม่พบสัญญา หรือสัญญาสิ้นสุดแล้ว' }, { status: 404 })
  }

  const now = new Date().toISOString()

  // คืนเงินค่าเช่างวดที่ยังไม่ได้ใช้ (คืนรถก่อนครบงวด) — ลงเป็นรายรับติดลบ ตามวันที่คืนจริง
  if (Number(earlyReturnRefund) > 0) {
    await supabase.from('monthly_payments').insert({
      monthly_rental_id: monthlyRentalId,
      due_date: now.split('T')[0],
      paid_date: now.split('T')[0],
      amount: -Number(earlyReturnRefund),
      status: 'paid',
      payment_note: 'คืนเงินค่าเช่าส่วนที่ไม่ได้ใช้ (คืนรถก่อนครบงวด)',
    })
  }

  // End rental
  const { error: updateRentalErr } = await supabase
    .from('monthly_rentals')
    .update({
      status: 'ended',
      end_date: now.split('T')[0],
      return_photos: returnPhotos ?? [],
      notes: returnNote ?? null,
    })
    .eq('id', monthlyRentalId)

  // Only free the bike if no other open contract exists for it (รายเดือนอื่น หรือรายวันที่ยังไม่คืน —
  // กันเคสปิดสัญญานี้ช้าหลังจากมีสัญญาใหม่บนคันเดียวกันเปิดไปแล้ว)
  const stillOpen = await hasOpenContract(supabase, rental.bike_id)

  let updateBikeErr = null
  if (!stillOpen) {
    const { error } = await supabase
      .from('bikes')
      .update({
        status: 'available',
        ...(returnOdometer ? { odometer: returnOdometer } : {}),
      })
      .eq('id', rental.bike_id)
    updateBikeErr = error
    if (returnOdometer) {
      await recalcNeverDoneRoutines(supabase, rental.bike_id, Number(returnOdometer))
    }
  }

  if (updateRentalErr) {
    console.error('End monthly rental error:', updateRentalErr.message)
    return NextResponse.json({ error: 'อัปเดตสัญญาไม่สำเร็จ' }, { status: 500 })
  }
  if (updateBikeErr) {
    console.error('Update bike status error:', updateBikeErr.message)
    return NextResponse.json({ error: 'อัปเดตสถานะรถไม่สำเร็จ' }, { status: 500 })
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const plate = (Array.isArray((rental as any).bikes) ? (rental as any).bikes[0] : (rental as any).bikes)?.license_plate ?? ''
  const custName = (Array.isArray((rental as any).customers) ? (rental as any).customers[0] : (rental as any).customers)?.name ?? ''
  /* eslint-enable @typescript-eslint/no-explicit-any */
  await logStaffAction(staffId, 'monthly_ended',
    `จบสัญญารายเดือน ${plate} — ลูกค้า ${custName}`,
    { monthlyRentalId, bikeId: rental.bike_id, returnOdometer: returnOdometer ?? null })

  return NextResponse.json({ ok: true })
}
