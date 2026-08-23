import { SupabaseClient } from '@supabase/supabase-js'
import { calcRoutineUrgency } from '@/lib/routines'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>

export type AtShopBike = {
  id: string
  licensePlate: string
  brand: string
  model: string
  color: string | null
  odometer: number
  dailyRate: number
  branchName: string
  dueTasks: string[]
  docTasks: string[]
}

export type DailyRental = {
  id: string
  bikeId: string
  licensePlate: string
  brand: string
  model: string
  color: string | null
  branchName: string
  customerName: string
  customerPhone: string
  startDatetime: string
  expectedEndDatetime: string
  returnType: string | null
  returnAddress: string | null
  dueTasks: string[]
  docTasks: string[]
}

export type MonthlyRental = {
  id: string
  bikeId: string
  licensePlate: string
  brand: string
  model: string
  color: string | null
  branchName: string
  customerName: string
  customerPhone: string
  startDate: string
  paymentDay: number
  monthlyRate: number
  dueTasks: string[]
  docTasks: string[]
}

export type RepairJob = {
  id: string
  bikeId: string
  licensePlate: string
  brand: string
  model: string
  color: string | null
  branchName: string
  title: string
  description: string
  status: string
  locationType: string | null
  locationAddress: string | null
  createdAt: string
}

export type ShopOverviewGroups = {
  atShop: AtShopBike[]
  dailyRentals: DailyRental[]
  monthlyRentals: MonthlyRental[]
  repairs: RepairJob[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bikeJoin(b: any) {
  return {
    licensePlate: b?.license_plate ?? '',
    brand: b?.brand ?? '',
    model: b?.model ?? '',
    color: b?.color ?? null,
    branchName: b?.branches?.name ?? '',
  }
}

export async function getShopOverviewGroups(admin: Admin, branchIds: string[] | null): Promise<ShopOverviewGroups> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyBranch = (q: any) => branchIds ? q.in('branch_id', branchIds) : q

  const [
    { data: bikesRaw },
    { data: dailyRaw },
    { data: monthlyRaw },
    { data: repairsRaw },
  ] = await Promise.all([
    applyBranch(admin.from('bikes')
      .select('id, license_plate, brand, model, color, odometer, daily_rate, branches(name)')
      .eq('status', 'available')
      .order('license_plate')),

    applyBranch(admin.from('rentals')
      .select('id, bike_id, start_datetime, expected_end_datetime, return_type, return_address, bikes(license_plate, brand, model, color, odometer, branches(name)), customers(name, phone)')
      .in('status', ['active', 'extended'])
      .order('expected_end_datetime', { ascending: true })),

    applyBranch(admin.from('monthly_rentals')
      .select('id, bike_id, start_date, payment_day, monthly_rate, bikes(license_plate, brand, model, color, odometer, branches(name)), customers(name, phone)')
      .eq('status', 'active')
      .order('payment_day', { ascending: true })),

    applyBranch(admin.from('repairs')
      .select('id, bike_id, title, description, status, location_type, location_address, created_at, bikes(license_plate, brand, model, color, branches(name))')
      .in('status', ['pending', 'in_progress'])
      .order('created_at', { ascending: false })),
  ])

  const dailyList = dailyRaw ?? []
  const monthlyList = monthlyRaw ?? []
  const repairsList = repairsRaw ?? []

  // เผื่อ bikes.status ค้างผิด (ไม่ตรงกับ rental/monthly active จริง) — กันรถซ้ำหมวด
  const busyBikeIds = new Set<string>([
    ...dailyList.map((r: { bike_id: string }) => r.bike_id),
    ...monthlyList.map((r: { bike_id: string }) => r.bike_id),
  ])

  const atShopRaw = (bikesRaw ?? []).filter((b: { id: string }) => !busyBikeIds.has(b.id))

  // รูทีนที่ถึงกำหนดแล้ว — เช็คทุกคันที่โชว์ในหน้านี้ (อยู่ร้าน + เช่ารายวัน + เช่ารายเดือน)
  // ใช้เกณฑ์เดียวกับหน้ารูทีน/แบนเนอร์ตอนคืนรถ
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const odometerByBike = new Map<string, number>(atShopRaw.map((b: any) => [b.id, b.odometer ?? 0]))
  for (const r of dailyList) odometerByBike.set(r.bike_id, r.bikes?.odometer ?? 0)
  for (const r of monthlyList) odometerByBike.set(r.bike_id, r.bikes?.odometer ?? 0)

  const routineCheckIds = Array.from(odometerByBike.keys())
  const dueTasksByBike = new Map<string, string[]>()
  if (routineCheckIds.length > 0) {
    const { data: routines } = await admin
      .from('bike_routines')
      .select('bike_id, task_name, next_due_km, next_due_date')
      .in('bike_id', routineCheckIds)
    for (const r of routines ?? []) {
      const odometer = odometerByBike.get(r.bike_id) ?? 0
      const { urgency } = calcRoutineUrgency({ next_due_km: r.next_due_km, next_due_date: r.next_due_date }, odometer)
      if (urgency === 'overdue') {
        // บอกจำนวนวัน/กม.ที่เกินมา ให้เห็นความเร่งด่วนชัดกว่าแค่ชื่องาน
        let extra = ''
        if (r.next_due_date) {
          const days = Math.floor((Date.now() - new Date(r.next_due_date).getTime()) / 86_400_000)
          if (days > 0) extra = ` (เกิน ${days} วัน)`
        } else if (r.next_due_km != null && odometer - r.next_due_km > 0) {
          extra = ` (เกิน ${(odometer - r.next_due_km).toLocaleString()} กม.)`
        }
        const list = dueTasksByBike.get(r.bike_id) ?? []
        list.push(`${r.task_name}${extra}`)
        dueTasksByBike.set(r.bike_id, list)
      }
    }
  }

  // เอกสารรถ (ภาษี/พ.ร.บ./ประกัน) ที่ใกล้หมดอายุ — เกณฑ์เดียวกับหน้า Job Tasks
  const DOC_LABEL: Record<string, string> = { tax: 'ภาษีรถ', pob: 'พ.ร.บ.', insurance: 'ประกันภัย' }
  const today = new Date().toISOString().split('T')[0]
  const in30days = new Date(Date.now() + 30 * 86_400_000).toISOString().split('T')[0]
  const docTasksByBike = new Map<string, string[]>()
  if (routineCheckIds.length > 0) {
    const { data: docs } = await admin
      .from('bike_documents')
      .select('bike_id, doc_type, expiry_date')
      .in('bike_id', routineCheckIds)
      .lte('expiry_date', in30days)
      .gte('expiry_date', today)
    for (const d of docs ?? []) {
      const daysLeft = Math.ceil((new Date(d.expiry_date).getTime() - Date.now()) / 86_400_000)
      const label = DOC_LABEL[d.doc_type] ?? d.doc_type
      const list = docTasksByBike.get(d.bike_id) ?? []
      list.push(`${label} (อีก ${daysLeft} วัน)`)
      docTasksByBike.set(d.bike_id, list)
    }
  }

  const atShop: AtShopBike[] = atShopRaw.map((b: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    id: b.id,
    licensePlate: b.license_plate,
    brand: b.brand,
    model: b.model,
    color: b.color,
    odometer: b.odometer ?? 0,
    dailyRate: b.daily_rate ?? 0,
    branchName: b.branches?.name ?? '',
    dueTasks: dueTasksByBike.get(b.id) ?? [],
    docTasks: docTasksByBike.get(b.id) ?? [],
  }))

  const dailyRentals: DailyRental[] = dailyList.map((r: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    id: r.id,
    bikeId: r.bike_id,
    ...bikeJoin(r.bikes),
    customerName: r.customers?.name ?? '',
    customerPhone: r.customers?.phone ?? '',
    startDatetime: r.start_datetime,
    expectedEndDatetime: r.expected_end_datetime,
    returnType: r.return_type,
    returnAddress: r.return_address,
    dueTasks: dueTasksByBike.get(r.bike_id) ?? [],
    docTasks: docTasksByBike.get(r.bike_id) ?? [],
  }))

  const monthlyRentals: MonthlyRental[] = monthlyList.map((r: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    id: r.id,
    bikeId: r.bike_id,
    ...bikeJoin(r.bikes),
    customerName: r.customers?.name ?? '',
    customerPhone: r.customers?.phone ?? '',
    startDate: r.start_date,
    paymentDay: r.payment_day,
    monthlyRate: r.monthly_rate,
    dueTasks: dueTasksByBike.get(r.bike_id) ?? [],
    docTasks: docTasksByBike.get(r.bike_id) ?? [],
  }))

  const repairs: RepairJob[] = repairsList.map((r: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    id: r.id,
    bikeId: r.bike_id,
    ...bikeJoin(r.bikes),
    title: r.title,
    description: r.description,
    status: r.status,
    locationType: r.location_type,
    locationAddress: r.location_address,
    createdAt: r.created_at,
  }))

  return { atShop, dailyRentals, monthlyRentals, repairs }
}
