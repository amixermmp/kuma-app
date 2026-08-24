import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds } from '@/lib/staffBranch'
import { getBusyBikeIds, BUFFER_MS } from '@/lib/availability'
import { getModelBikeAvailability } from '@/lib/bookingConflicts'
import { getBikeCatalog } from '@/lib/bikeCatalog'

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const supabase = createAdminClient()

  // Get staff's allowed branches
  const allowedBranchIds = await getStaffBranchIds(staffId)

  // Get bikes filtered to staff's branches
  let bikesQuery = supabase
    .from('bikes')
    .select('id, branch_id, license_plate, brand, model, color, year, daily_rate, monthly_rate, odometer, status')
    .order('daily_rate', { ascending: true })

  if (allowedBranchIds) {
    bikesQuery = bikesQuery.in('branch_id', allowedBranchIds)
  }

  const { data: bikes } = await bikesQuery

  if (!bikes) return NextResponse.json({ bikes: [] })

  const nowIso = new Date().toISOString()
  const bufferStart = new Date(new Date(from).getTime() - BUFFER_MS).toISOString()
  const bufferEnd = new Date(new Date(to).getTime() + BUFFER_MS).toISOString()

  // รถไม่ว่างจากสัญญาเช่า — ตัวกลาง เดียวกับทุกจุดในระบบ (กันเกินกำหนดยังไม่คืนหลุดคิว)
  const [busySet, { data: rentalConflicts }, { data: specificBookings }] = await Promise.all([
    getBusyBikeIds(supabase, from, to),
    // รายละเอียดสัญญา — ใช้โชว์เหตุผลเท่านั้น ไม่ใช่ตัวตัดสินว่าว่างไหม (busySet ตัดสินแล้ว)
    supabase
      .from('rentals')
      .select('bike_id, start_datetime, expected_end_datetime')
      .in('status', ['active', 'extended']),
    // คิวจองที่เจาะจงคันไปแล้ว (bike_id ระบุแล้ว) — ใช้โชว์เหตุผลรายคัน
    supabase
      .from('bookings')
      .select('bike_id, start_datetime, end_datetime')
      .in('status', ['confirmed'])
      .not('bike_id', 'is', null)
      .lt('start_datetime', bufferEnd)
      .gt('end_datetime', bufferStart),
  ])

  const rentalDetail = new Map<string, { start: string; end: string; overdue: boolean }>()
  for (const r of rentalConflicts ?? []) {
    rentalDetail.set(r.bike_id, {
      start: r.start_datetime,
      end: r.expected_end_datetime,
      overdue: r.expected_end_datetime <= nowIso,
    })
  }

  const bookingMap = new Map<string, { start: string; end: string }>()
  for (const b of specificBookings ?? []) {
    if (!busySet.has(b.bike_id)) bookingMap.set(b.bike_id, { start: b.start_datetime, end: b.end_datetime })
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' })

  // โปร "จ่ายกี่วัน จาก 7 วัน" ตั้งได้ต่อรุ่นผ่าน bike_models.promo_pay_days (ค่า global) — ไม่ตั้งไว้ = ค่ากลาง 5
  // และตั้งเจาะจงต่อสาขาผ่าน branch_model_pricing ได้ (มีผลก่อน global เสมอ)
  const { models: catalogModels } = await getBikeCatalog()
  const promoDaysByModel = new Map(catalogModels.map(m => [`${m.brand}__${m.name}`, m.promoPayDays ?? 5]))

  const { data: branchPricingRows } = await supabase
    .from('branch_model_pricing')
    .select('branch_id, brand, model, promo_pay_days')
    .not('promo_pay_days', 'is', null)
  const promoDaysByBranchModel = new Map((branchPricingRows ?? []).map(p => [`${p.branch_id}__${p.brand}__${p.model}`, p.promo_pay_days as number]))

  const getPromoDays = (branchId: string | null, brand: string, model: string) =>
    promoDaysByBranchModel.get(`${branchId ?? ''}__${brand}__${model}`)
    ?? promoDaysByModel.get(`${brand}__${model}`)
    ?? 5

  // รถที่ว่างทางกายภาพ (ผ่าน repair/locked/rented/ติดจองเจาะจงคันแล้ว) — เอาไปเช็คต่อว่าคิวจองแบบ
  // "ระบุแค่รุ่น" ของรุ่นนั้นกินโควต้าไปกี่คันจริง แบบคิดรวมการต่อคิวในคันเดียวกันได้ (bin packing)
  const physicallyFreeBikes = bikes.filter(bike =>
    bike.status !== 'repair' && bike.status !== 'locked' &&
    !busySet.has(bike.id) && !bookingMap.has(bike.id)
  )
  const modelGroups = new Map<string, { branchId: string; brand: string; model: string }>()
  for (const bike of physicallyFreeBikes) {
    const key = `${bike.branch_id ?? ''}__${bike.brand}__${bike.model}`
    if (!modelGroups.has(key)) modelGroups.set(key, { branchId: bike.branch_id ?? '', brand: bike.brand, model: bike.model })
  }
  const modelFreeIds = new Map<string, Set<string>>()
  await Promise.all(Array.from(modelGroups.entries()).map(async ([key, g]) => {
    const avail = await getModelBikeAvailability(supabase, g.branchId, g.brand, g.model, from, to)
    modelFreeIds.set(key, new Set(avail.freeBikeIds))
  }))

  const bikesWithPromo = bikes.map(b => ({ ...b, promo_pay_days: getPromoDays(b.branch_id, b.brand, b.model) }))

  const result = bikesWithPromo.map(bike => {
    if (bike.status === 'repair') {
      return { ...bike, available: false, conflict_type: 'repair', conflict_reason: 'อยู่ระหว่างซ่อม' }
    }
    if (bike.status === 'locked') {
      return { ...bike, available: false, conflict_type: 'locked', conflict_reason: 'ล็อคไว้' }
    }
    if (busySet.has(bike.id)) {
      const rental = rentalDetail.get(bike.id)
      return {
        ...bike, available: false, conflict_type: 'rented',
        conflict_reason: !rental
          ? 'เช่ารายเดือน'
          : rental.overdue
            ? `⚠️ เกินกำหนด ยังไม่คืน (กำหนดเดิม ${fmt(rental.end)})`
            : `มีการเช่า ${fmt(rental.start)}–${fmt(rental.end)}`,
      }
    }
    const booking = bookingMap.get(bike.id)
    if (booking) {
      return {
        ...bike, available: false, conflict_type: 'booked',
        conflict_reason: `ติดจอง ${fmt(booking.start)}–${fmt(booking.end)}`,
      }
    }
    const modelKey = `${bike.branch_id ?? ''}__${bike.brand}__${bike.model}`
    const freeSet = modelFreeIds.get(modelKey)
    if (!freeSet?.has(bike.id)) {
      return { ...bike, available: false, conflict_type: 'booked', conflict_reason: 'ถูกจองไว้แล้ว (รอกำหนดคัน)' }
    }
    return { ...bike, available: true, conflict_type: null }
  })

  return NextResponse.json({ bikes: result })
}
