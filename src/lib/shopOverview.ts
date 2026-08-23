import { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>

export type AtShopBike = {
  id: string
  licensePlate: string
  brand: string
  model: string
  color: string | null
  photoUrl: string | null
  odometer: number
  dailyRate: number
  branchName: string
}

export type DailyRental = {
  id: string
  bikeId: string
  licensePlate: string
  brand: string
  model: string
  color: string | null
  photoUrl: string | null
  branchName: string
  customerName: string
  customerPhone: string
  startDatetime: string
  expectedEndDatetime: string
  returnType: string | null
  returnAddress: string | null
}

export type MonthlyRental = {
  id: string
  bikeId: string
  licensePlate: string
  brand: string
  model: string
  color: string | null
  photoUrl: string | null
  branchName: string
  customerName: string
  customerPhone: string
  startDate: string
  paymentDay: number
  monthlyRate: number
}

export type RepairJob = {
  id: string
  bikeId: string
  licensePlate: string
  brand: string
  model: string
  color: string | null
  photoUrl: string | null
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
    photoUrl: b?.photo_url ?? null,
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
      .select('id, license_plate, brand, model, color, photo_url, odometer, daily_rate, branches(name)')
      .eq('status', 'available')
      .order('license_plate')),

    applyBranch(admin.from('rentals')
      .select('id, bike_id, start_datetime, expected_end_datetime, return_type, return_address, bikes(license_plate, brand, model, color, photo_url, branches(name)), customers(name, phone)')
      .in('status', ['active', 'extended'])
      .order('expected_end_datetime', { ascending: true })),

    applyBranch(admin.from('monthly_rentals')
      .select('id, bike_id, start_date, payment_day, monthly_rate, bikes(license_plate, brand, model, color, photo_url, branches(name)), customers(name, phone)')
      .eq('status', 'active')
      .order('payment_day', { ascending: true })),

    applyBranch(admin.from('repairs')
      .select('id, bike_id, title, description, status, location_type, location_address, created_at, bikes(license_plate, brand, model, color, photo_url, branches(name))')
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

  const atShop: AtShopBike[] = (bikesRaw ?? [])
    .filter((b: { id: string }) => !busyBikeIds.has(b.id))
    .map((b: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
      id: b.id,
      licensePlate: b.license_plate,
      brand: b.brand,
      model: b.model,
      color: b.color,
      photoUrl: b.photo_url,
      odometer: b.odometer ?? 0,
      dailyRate: b.daily_rate ?? 0,
      branchName: b.branches?.name ?? '',
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
