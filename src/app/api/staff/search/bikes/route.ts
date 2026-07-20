import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds } from '@/lib/staffBranch'
import { getBusyBikeIds, BUFFER_MS } from '@/lib/availability'

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const bufferStart = new Date(new Date(from).getTime() - BUFFER_MS)
  const bufferEnd = new Date(new Date(to).getTime() + BUFFER_MS)

  const supabase = createAdminClient()

  // Get staff's allowed branches
  const allowedBranchIds = await getStaffBranchIds(staffId)

  // Get bikes filtered to staff's branches
  let bikesQuery = supabase
    .from('bikes')
    .select('id, branch_id, license_plate, brand, model, color, year, daily_rate, odometer, status')
    .order('daily_rate', { ascending: true })

  if (allowedBranchIds) {
    bikesQuery = bikesQuery.in('branch_id', allowedBranchIds)
  }

  const { data: bikes } = await bikesQuery

  if (!bikes) return NextResponse.json({ bikes: [] })

  const nowIso = new Date().toISOString()

  // รถไม่ว่างจากสัญญาเช่า — ตัวกลาง เดียวกับทุกจุดในระบบ (กันเกินกำหนดยังไม่คืนหลุดคิว)
  const [busySet, { data: rentalConflicts }, { data: bookingConflicts }] = await Promise.all([
    getBusyBikeIds(supabase, from, to),
    // รายละเอียดสัญญา — ใช้โชว์เหตุผลเท่านั้น ไม่ใช่ตัวตัดสินว่าว่างไหม (busySet ตัดสินแล้ว)
    supabase
      .from('rentals')
      .select('bike_id, start_datetime, expected_end_datetime')
      .in('status', ['active', 'extended']),
    supabase
      .from('bookings')
      .select('bike_id, branch_id, requested_brand, requested_model, start_datetime, end_datetime')
      .in('status', ['confirmed'])
      .lt('start_datetime', bufferEnd.toISOString())
      .gt('end_datetime', bufferStart.toISOString()),
  ])

  const rentalDetail = new Map<string, { start: string; end: string; overdue: boolean }>()
  for (const r of rentalConflicts ?? []) {
    rentalDetail.set(r.bike_id, {
      start: r.start_datetime,
      end: r.expected_end_datetime,
      overdue: r.expected_end_datetime <= nowIso,
    })
  }

  // Specific-bike bookings (bike_id is set)
  const bookingMap = new Map<string, { start: string; end: string }>()
  // Model-based bookings (bike_id = null) — นับแยกตามสาขา ไม่ให้จองสาขาอื่นมากันรถสาขาเรา
  const modelBookingCount = new Map<string, number>()
  for (const b of bookingConflicts ?? []) {
    if (b.bike_id) {
      if (!busySet.has(b.bike_id)) {
        bookingMap.set(b.bike_id, { start: b.start_datetime, end: b.end_datetime })
      }
    } else if (b.requested_brand && b.requested_model) {
      const key = `${b.branch_id ?? ''}__${b.requested_brand}__${b.requested_model}`
      modelBookingCount.set(key, (modelBookingCount.get(key) ?? 0) + 1)
    }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' })

  // Track how many "slots" each model-based booking has consumed
  const modelBookingUsed = new Map<string, number>()

  const result = bikes.map(bike => {
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
    // Check if a model-based booking (สาขาเดียวกัน) consumes this available bike
    const modelKey = `${bike.branch_id ?? ''}__${bike.brand}__${bike.model}`
    const booked = modelBookingCount.get(modelKey) ?? 0
    const used = modelBookingUsed.get(modelKey) ?? 0
    if (used < booked) {
      modelBookingUsed.set(modelKey, used + 1)
      return { ...bike, available: false, conflict_type: 'booked', conflict_reason: 'ถูกจองไว้แล้ว (รอกำหนดคัน)' }
    }
    return { ...bike, available: true, conflict_type: null }
  })

  return NextResponse.json({ bikes: result })
}
