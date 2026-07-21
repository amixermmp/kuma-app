import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds } from '@/lib/staffBranch'
import { getBusyBikeIds, UNRENTABLE_STATUSES, BUFFER_MS } from '@/lib/availability'
import AssignBikeClient from './AssignBikeClient'

export const dynamic = 'force-dynamic'

export default async function AssignBikePage({ params, searchParams }: { params: { bookingId: string }; searchParams: { mode?: string } }) {
  const modelOnlyMode = searchParams?.mode === 'model'
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
  const bufferStart = new Date(new Date(booking.start_datetime).getTime() - BUFFER_MS).toISOString()
  const bufferEnd = new Date(new Date(booking.end_datetime).getTime() + BUFFER_MS).toISOString()

  let bikesQuery = supabase
    .from('bikes')
    .select('id, license_plate, brand, model, color, year, daily_rate, monthly_rate, deposit_amount, odometer, status')
    .not('status', 'in', `("${UNRENTABLE_STATUSES.join('","')}")`)

  if (allowedBranchIds) bikesQuery = bikesQuery.in('branch_id', allowedBranchIds)

  const { data: candidateBikes } = await bikesQuery

  // รถไม่ว่างจากสัญญา (ตัวกลาง — รวมเกินกำหนดยังไม่คืน) + คิวจองอื่น
  const [rentalBusy, { data: bookingConflicts }] = await Promise.all([
    getBusyBikeIds(supabase, booking.start_datetime, booking.end_datetime),
    supabase.from('bookings')
      .select('bike_id')
      .eq('status', 'confirmed')
      .neq('id', params.bookingId) // exclude this booking itself
      .not('bike_id', 'is', null)
      .lt('start_datetime', bufferEnd)
      .gt('end_datetime', bufferStart),
  ])

  const busyIds = new Set([
    ...Array.from(rentalBusy),
    ...(bookingConflicts ?? []).map(b => b.bike_id),
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
      modelOnlyMode={modelOnlyMode}
    />
  )
}
