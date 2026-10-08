import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds, getAllowedBikeIds } from '@/lib/staffBranch'
import { calcRoutineUrgency, type RoutineUrgency } from '@/lib/routines'
import RoutineClient from './RoutineClient'
import BikeSelectClient from '@/components/staff/BikeSelectClient'

export const dynamic = 'force-dynamic'

export type RoutineItem = {
  id: string
  bike_id: string
  task_name: string
  interval_km: number | null
  interval_days: number | null
  interval_rented_days: number | null
  rented_days_accumulated: number | null
  last_done_km: number | null
  last_done_date: string | null
  next_due_km: number | null
  next_due_date: string | null
  last_cost: number | null
  receipt_url: string | null
  bikes: { license_plate: string; brand: string; model: string; odometer: number }
  oil_type: 'engine' | 'gear' | null
  // น้ำมันร้านคงเหลือของสาขาที่รถผูกอยู่ (null = ไม่ใช่งานน้ำมัน) — 0 = หมด ใช้น้ำมันร้านไม่ได้
  shop_oil_qty: number | null
  urgency: RoutineUrgency
  due_reason: string
}

const OIL_TASK_TYPE: Record<string, 'engine' | 'gear'> = {
  'เปลี่ยนน้ำมันเครื่อง': 'engine',
  'เปลี่ยนน้ำมันเฟืองท้าย': 'gear',
}

export default async function RoutinePage({ searchParams }: { searchParams: Promise<{ id?: string; bikeId?: string }> }) {
  const { id: filterRoutineId, bikeId: filterBikeId } = await searchParams
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()

  // ถ้าไม่มี bikeId และไม่มี routineId → แสดงหน้าเลือกรถ
  if (!filterBikeId && !filterRoutineId) {
    const allowedBranchIds = await getStaffBranchIds(staffId)
    const allowedBikeIds = await getAllowedBikeIds(allowedBranchIds)

    let bikeQuery = supabase
      .from('bikes')
      .select('id, license_plate, brand, model, status')
      .order('license_plate')
    if (allowedBikeIds) {
      bikeQuery = bikeQuery.in('id', allowedBikeIds)
    }
    const { data: bikes } = await bikeQuery

    return (
      <div className="app-wrap">
        <div className="app-header" style={{ background: '#92400e' }}>
          <Link href="/staff/home" className="app-header-back">←</Link>
          <div>
            <h1>งานรูทีน</h1>
            <div className="sub">เลือกรถที่ต้องการจัดการ</div>
          </div>
        </div>
        <BikeSelectClient
          bikes={bikes ?? []}
          hrefTemplate="/staff/routine?bikeId={id}"
        />
      </div>
    )
  }

  const allowedBranchIds = await getStaffBranchIds(staffId)
  const allowedBikeIds = await getAllowedBikeIds(allowedBranchIds)

  let query = supabase
    .from('bike_routines')
    .select('*, bikes(license_plate, brand, model, odometer, branch_id)')
    .order('next_due_date', { ascending: true, nullsFirst: true })

  if (allowedBikeIds) {
    query = query.in('bike_id', allowedBikeIds)
  }
  if (filterBikeId) {
    query = query.eq('bike_id', filterBikeId)
  }

  const { data: raw } = await query

  // สต๊อกน้ำมันร้านของสาขาที่รถผูกอยู่ — ไม่มีแถว = 0 (ตรงกับที่ API บันทึกใช้ตัดสิน)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const branchIds = Array.from(new Set((raw ?? []).map(r => (r as any).bikes?.branch_id).filter(Boolean))) as string[]
  const { data: stockRows } = branchIds.length
    ? await supabase.from('branch_oil_stock').select('branch_id, oil_type, quantity').in('branch_id', branchIds)
    : { data: [] as { branch_id: string; oil_type: string; quantity: number }[] }
  const stockQty = new Map((stockRows ?? []).map(s => [`${s.branch_id}__${s.oil_type}`, s.quantity]))

  const routines: RoutineItem[] = (raw ?? []).map(r => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bike = (r as any).bikes
    const { urgency, due_reason } = calcRoutineUrgency(r as any, bike?.odometer ?? 0)
    const oil_type = OIL_TASK_TYPE[r.task_name] ?? null
    const shop_oil_qty = oil_type ? (stockQty.get(`${bike?.branch_id}__${oil_type}`) ?? 0) : null
    return { ...r, bikes: bike, oil_type, shop_oil_qty, urgency, due_reason }
  })

  const filtered = filterRoutineId
    ? routines.filter(r => r.id === filterRoutineId)
    : routines

  return <RoutineClient routines={filtered} backHref={filterBikeId ? '/staff/routine' : '/staff/home'} />
}
