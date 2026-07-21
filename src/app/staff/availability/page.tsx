import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds } from '@/lib/staffBranch'
import { getBusyBikeIds, UNRENTABLE_STATUSES, BUFFER_MS } from '@/lib/availability'
import AvailabilityClient from './AvailabilityClient'

export const dynamic = 'force-dynamic'

function bkkTodayStr(): string {
  return new Date(Date.now() + 7 * 3_600_000).toISOString().split('T')[0]
}

export default async function AvailabilityPage({ searchParams }: { searchParams: { date?: string } }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()
  const allowedBranchIds = await getStaffBranchIds(staffId)

  const dateStr = searchParams?.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) ? searchParams.date : bkkTodayStr()
  const dayStart = new Date(`${dateStr}T00:00:00+07:00`).toISOString()
  const dayEnd = new Date(`${dateStr}T23:59:59+07:00`).toISOString()
  const bufferStart = new Date(new Date(dayStart).getTime() - BUFFER_MS).toISOString()
  const bufferEnd = new Date(new Date(dayEnd).getTime() + BUFFER_MS).toISOString()

  let bikesQuery = supabase
    .from('bikes')
    .select('id, branch_id, brand, model, status, branches(name)')
    .neq('status', 'retired')
  if (allowedBranchIds) bikesQuery = bikesQuery.in('branch_id', allowedBranchIds)

  let bookingsQuery = supabase
    .from('bookings')
    .select('id, branch_id, bike_id, requested_brand, requested_model, start_datetime, end_datetime')
    .eq('status', 'confirmed')
    .lt('start_datetime', bufferEnd)
    .gt('end_datetime', bufferStart)
  if (allowedBranchIds) bookingsQuery = bookingsQuery.in('branch_id', allowedBranchIds)

  const [{ data: bikes }, { data: bookings }, busySet] = await Promise.all([
    bikesQuery,
    bookingsQuery,
    getBusyBikeIds(supabase, dayStart, dayEnd),
  ])

  // รถที่ถูกจองไว้แล้ว (bike_id เจาะจง) — นับเป็น "ไม่ว่าง" เหมือนรถติดสัญญา
  const bookedBikeIds = new Set((bookings ?? []).filter(b => b.bike_id).map(b => b.bike_id as string))

  type Group = {
    branchId: string; branchName: string; brand: string; model: string
    total: number; rawAvailable: number; modelDemand: number
  }
  const groups = new Map<string, Group>()
  for (const b of bikes ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const branchName = (Array.isArray((b as any).branches) ? (b as any).branches[0] : (b as any).branches)?.name ?? '—'
    const key = `${b.branch_id}__${b.brand}__${b.model}`
    const g = groups.get(key) ?? { branchId: b.branch_id, branchName, brand: b.brand, model: b.model, total: 0, rawAvailable: 0, modelDemand: 0 }
    g.total += 1
    const unrentable = UNRENTABLE_STATUSES.includes(b.status)
    if (!unrentable && !busySet.has(b.id) && !bookedBikeIds.has(b.id)) g.rawAvailable += 1
    groups.set(key, g)
  }

  // คิวจองแบบไม่เจาะจงคัน (จองตามรุ่น) — เพิ่มดีมานด์ให้กลุ่มรุ่นนั้น
  for (const bk of bookings ?? []) {
    if (bk.bike_id || !bk.requested_brand || !bk.requested_model) continue
    const key = `${bk.branch_id}__${bk.requested_brand}__${bk.requested_model}`
    const g = groups.get(key)
    if (g) g.modelDemand += 1
  }

  const result = Array.from(groups.values())
    .map(g => ({ ...g, netAvailable: g.rawAvailable - g.modelDemand }))
    .sort((a, b) => a.netAvailable - b.netAvailable || a.brand.localeCompare(b.brand))

  return <AvailabilityClient date={dateStr} groups={result} multiBranch={allowedBranchIds === null || allowedBranchIds.length > 1} />
}
