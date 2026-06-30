import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds, getAllowedBikeIds } from '@/lib/staffBranch'
import RoutineClient from './RoutineClient'

export const dynamic = 'force-dynamic'

export type RoutineItem = {
  id: string
  bike_id: string
  task_name: string
  interval_km: number | null
  interval_days: number | null
  last_done_km: number | null
  last_done_date: string | null
  next_due_km: number | null
  next_due_date: string | null
  last_cost: number | null
  receipt_url: string | null
  bikes: { license_plate: string; brand: string; model: string; odometer: number }
  urgency: 'overdue' | 'warning' | 'ok'
  due_reason: string
}

function calcRoutineUrgency(r: Omit<RoutineItem, 'urgency' | 'due_reason'>, odometer: number): { urgency: RoutineItem['urgency']; due_reason: string } {
  const today = Date.now()

  // km-based check
  if (r.next_due_km != null) {
    const diff = odometer - r.next_due_km
    if (diff >= 0) return { urgency: 'overdue', due_reason: `ถึงกำหนดแล้ว! (${odometer.toLocaleString()} กม. / กำหนด ${r.next_due_km.toLocaleString()} กม.)` }
    if (diff >= -500) return { urgency: 'warning', due_reason: `อีก ${Math.abs(diff)} กม. จะถึงกำหนด` }
  }

  // date-based check
  if (r.next_due_date) {
    const days = Math.ceil((new Date(r.next_due_date).getTime() - today) / 86_400_000)
    if (days <= 0) return { urgency: 'overdue', due_reason: `ถึงกำหนดตามวันที่ (${new Date(r.next_due_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})` }
    if (days <= 14) return { urgency: 'warning', due_reason: `อีก ${days} วันจะถึงกำหนด` }
  }

  if (r.next_due_km == null && !r.next_due_date) {
    return { urgency: 'ok', due_reason: 'ยังไม่ตั้งค่ากำหนด' }
  }
  return { urgency: 'ok', due_reason: 'ปกติ' }
}

export default async function RoutinePage({ searchParams }: { searchParams: Promise<{ id?: string; bikeId?: string }> }) {
  const { id: filterRoutineId, bikeId: filterBikeId } = await searchParams
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()

  const allowedBranchIds = await getStaffBranchIds(staffId)
  const allowedBikeIds = await getAllowedBikeIds(allowedBranchIds)

  let query = supabase
    .from('bike_routines')
    .select('*, bikes(license_plate, brand, model, odometer)')
    .order('next_due_date', { ascending: true, nullsFirst: true })

  if (allowedBikeIds) {
    query = query.in('bike_id', allowedBikeIds)
  }
  if (filterBikeId) {
    query = query.eq('bike_id', filterBikeId)
  }

  const { data: raw } = await query

  const routines: RoutineItem[] = (raw ?? []).map(r => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bike = (r as any).bikes
    const { urgency, due_reason } = calcRoutineUrgency(r as any, bike?.odometer ?? 0)
    return { ...r, bikes: bike, urgency, due_reason }
  })

  const filtered = filterRoutineId
    ? routines.filter(r => r.id === filterRoutineId)
    : routines

  return <RoutineClient routines={filtered} />
}
