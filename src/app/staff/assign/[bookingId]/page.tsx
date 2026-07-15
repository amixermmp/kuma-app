import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds } from '@/lib/staffBranch'
import AssignBikeClient from './AssignBikeClient'

export const dynamic = 'force-dynamic'

export default async function AssignBikePage({ params }: { params: { bookingId: string } }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, bikes(id, license_plate, brand, model, color, year, daily_rate, monthly_rate, deposit_amount, odometer)')
    .eq('id', params.bookingId)
    .single()

  if (!booking || booking.status !== 'confirmed') redirect('/staff/jobs')

  // Determine which model to look for
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignedBike = (booking as any).bikes
  const targetBrand = booking.requested_brand ?? assignedBike?.brand ?? null
  const targetModel = booking.requested_model ?? assignedBike?.model ?? null

  // ดึงรถทุกรุ่นในสาขาที่ staff ดูแล — รุ่นตรงโชว์ก่อน รุ่นอื่นเป็นตัวเลือกอัพเกรด (คงราคาเดิม)
  const allowedBranchIds = await getStaffBranchIds(staffId)
  const bufferStart = new Date(new Date(booking.start_datetime).getTime() - 3 * 3_600_000).toISOString()

  let bikesQuery = supabase
    .from('bikes')
    .select('id, license_plate, brand, model, color, year, daily_rate, monthly_rate, deposit_amount, odometer, status')
    .neq('status', 'repair')

  if (allowedBranchIds) bikesQuery = bikesQuery.in('branch_id', allowedBranchIds)

  const { data: candidateBikes } = await bikesQuery

  // Check conflicts for each candidate
  const [{ data: rentalConflicts }, { data: bookingConflicts }, { data: monthlyConflicts }] = await Promise.all([
    supabase.from('rentals')
      .select('bike_id')
      .in('status', ['active', 'extended'])
      .lt('start_datetime', booking.end_datetime)
      .gt('expected_end_datetime', bufferStart),
    supabase.from('bookings')
      .select('bike_id')
      .eq('status', 'confirmed')
      .neq('id', params.bookingId) // exclude this booking itself
      .lt('start_datetime', booking.end_datetime)
      .gt('end_datetime', bufferStart),
    supabase.from('monthly_rentals')
      .select('bike_id')
      .eq('status', 'active'),
  ])

  const busyIds = new Set([
    ...(rentalConflicts ?? []).map(r => r.bike_id),
    ...(bookingConflicts ?? []).map(b => b.bike_id),
    ...(monthlyConflicts ?? []).map(m => m.bike_id),
  ])

  const availableBikes = (candidateBikes ?? []).map(b => ({
    ...b,
    available: !busyIds.has(b.id),
  }))

  return (
    <AssignBikeClient
      booking={booking}
      assignedBike={assignedBike}
      availableBikes={availableBikes}
      staffId={staffId}
    />
  )
}
