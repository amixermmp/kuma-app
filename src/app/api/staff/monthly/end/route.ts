import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { monthlyRentalId, returnPhotos, returnNote, returnOdometer } = await request.json()
  if (!monthlyRentalId) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const supabase = createAdminClient()

  // Fetch rental to get bike_id
  const { data: rental, error: rentalErr } = await supabase
    .from('monthly_rentals')
    .select('id, bike_id, status')
    .eq('id', monthlyRentalId)
    .eq('status', 'active')
    .single()

  if (rentalErr || !rental) {
    return NextResponse.json({ error: 'ไม่พบสัญญา หรือสัญญาสิ้นสุดแล้ว' }, { status: 404 })
  }

  const now = new Date().toISOString()

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

  // Only free the bike if no other active monthly rental exists for it
  const { count } = await supabase
    .from('monthly_rentals')
    .select('id', { count: 'exact', head: true })
    .eq('bike_id', rental.bike_id)
    .eq('status', 'active')

  let updateBikeErr = null
  if ((count ?? 0) === 0) {
    const { error } = await supabase
      .from('bikes')
      .update({
        status: 'available',
        ...(returnOdometer ? { odometer: returnOdometer } : {}),
      })
      .eq('id', rental.bike_id)
    updateBikeErr = error
  }

  if (updateRentalErr) {
    console.error('End monthly rental error:', updateRentalErr.message)
    return NextResponse.json({ error: 'อัปเดตสัญญาไม่สำเร็จ' }, { status: 500 })
  }
  if (updateBikeErr) {
    console.error('Update bike status error:', updateBikeErr.message)
    return NextResponse.json({ error: 'อัปเดตสถานะรถไม่สำเร็จ' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
