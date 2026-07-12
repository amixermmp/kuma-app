import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds } from '@/lib/staffBranch'
import WalkinSelectBike from './WalkinSelectBike'
import { bangkokToUTC } from '@/lib/time'

export const dynamic = 'force-dynamic'

function daysBetween(from: string, to: string) {
  return Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000))
}

export default async function WalkinModelPage({
  searchParams,
}: {
  searchParams: { brand?: string; model?: string; rate?: string; from?: string; to?: string }
}) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const { brand, model, from, to } = searchParams
  if (!brand || !model || !from || !to) redirect('/staff/search')

  const startUtc = bangkokToUTC(from)
  const endUtc = bangkokToUTC(to)
  const bufferStart = new Date(new Date(startUtc).getTime() - 3 * 3_600_000).toISOString()
  const totalDays = daysBetween(from, to)

  const supabase = createAdminClient()
  const allowedBranchIds = await getStaffBranchIds(staffId)

  let bikesQuery = supabase
    .from('bikes')
    .select('id, license_plate, brand, model, color, year, daily_rate, odometer, status')
    .eq('brand', brand)
    .eq('model', model)
    .neq('status', 'repair')

  if (allowedBranchIds) bikesQuery = bikesQuery.in('branch_id', allowedBranchIds)

  const { data: candidateBikes } = await bikesQuery

  // Check conflicts for the date range
  const [{ data: rentalConflicts }, { data: bookingConflicts }, { data: monthlyConflicts }] = await Promise.all([
    supabase.from('rentals')
      .select('bike_id')
      .in('status', ['active', 'extended'])
      .lt('start_datetime', endUtc)
      .gt('expected_end_datetime', bufferStart),
    supabase.from('bookings')
      .select('bike_id')
      .eq('status', 'confirmed')
      .not('bike_id', 'is', null)
      .lt('start_datetime', endUtc)
      .gt('end_datetime', bufferStart),
    supabase.from('monthly_rentals')
      .select('bike_id')
      .eq('status', 'active'),
  ])

  const busyIds = new Set([
    ...(rentalConflicts ?? []).map((r: { bike_id: string }) => r.bike_id),
    ...(bookingConflicts ?? []).map((b: { bike_id: string }) => b.bike_id),
    ...(monthlyConflicts ?? []).map((m: { bike_id: string }) => m.bike_id),
  ])

  const bikes = (candidateBikes ?? []).map(b => ({
    ...b,
    available: !busyIds.has(b.id),
  }))

  return (
    <WalkinSelectBike
      brand={brand}
      model={model}
      from={from}
      to={to}
      totalDays={totalDays}
      bikes={bikes}
    />
  )
}
