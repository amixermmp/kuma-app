import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds } from '@/lib/staffBranch'
import WalkinSelectBike from './WalkinSelectBike'
import { bangkokToUTC } from '@/lib/time'
import { getBusyBikeIds, UNRENTABLE_STATUSES, BUFFER_MS } from '@/lib/availability'

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
  const bufferStart = new Date(new Date(startUtc).getTime() - BUFFER_MS).toISOString()
  const bufferEnd = new Date(new Date(endUtc).getTime() + BUFFER_MS).toISOString()
  const totalDays = daysBetween(from, to)

  const supabase = createAdminClient()
  const allowedBranchIds = await getStaffBranchIds(staffId)

  // กันรถซ่อม/ล็อค/เลิกใช้ ออกตั้งแต่ต้น
  let bikesQuery = supabase
    .from('bikes')
    .select('id, license_plate, brand, model, color, year, daily_rate, odometer, status')
    .eq('brand', brand)
    .eq('model', model)
    .not('status', 'in', `("${UNRENTABLE_STATUSES.join('","')}")`)

  if (allowedBranchIds) bikesQuery = bikesQuery.in('branch_id', allowedBranchIds)

  const { data: candidateBikes } = await bikesQuery

  // รถไม่ว่างจากสัญญาเช่า (ตัวกลาง — รวมเคสเกินกำหนดยังไม่คืน) + จองเจาะคัน
  const [rentalBusy, { data: bookingConflicts }] = await Promise.all([
    getBusyBikeIds(supabase, startUtc, endUtc),
    supabase.from('bookings')
      .select('bike_id')
      .eq('status', 'confirmed')
      .not('bike_id', 'is', null)
      .lt('start_datetime', bufferEnd)
      .gt('end_datetime', bufferStart),
  ])

  const bookingBusyIds = new Set((bookingConflicts ?? []).map((b: { bike_id: string }) => b.bike_id))

  // แยก "มีสัญญาเปิดอยู่ตอนนี้จริง" (rentalBusy — รถอยู่ในมือคนอื่นตอนนี้ Fast lane ช่วยไม่ได้ ส่งไม่ได้จริงๆ)
  // ออกจาก "แค่ติดคิวจองในอนาคต" (rentalBusy ไม่ติด แต่ bookingBusy ติด — รถว่างตอนนี้ Fast lane ใช้ได้)
  const bikes = (candidateBikes ?? []).map(b => ({
    ...b,
    available: !rentalBusy.has(b.id) && !bookingBusyIds.has(b.id),
    hardBusy: rentalBusy.has(b.id),
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
