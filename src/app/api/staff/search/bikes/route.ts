import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds } from '@/lib/staffBranch'

const BUFFER_HOURS = 3

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const searchStart = new Date(from)
  const searchEnd = new Date(to)

  // 3-hour buffer on BOTH sides: an existing rental/booking must end ≥3h before
  // search start AND start ≥3h after search end, otherwise it conflicts.
  const bufferStart = new Date(searchStart.getTime() - BUFFER_HOURS * 3_600_000)
  const bufferEnd = new Date(searchEnd.getTime() + BUFFER_HOURS * 3_600_000)

  const supabase = createAdminClient()

  // Get staff's allowed branches
  const allowedBranchIds = await getStaffBranchIds(staffId)

  // Get bikes filtered to staff's branches
  let bikesQuery = supabase
    .from('bikes')
    .select('id, license_plate, brand, model, color, year, daily_rate, odometer, status')
    .order('daily_rate', { ascending: true })

  if (allowedBranchIds) {
    bikesQuery = bikesQuery.in('branch_id', allowedBranchIds)
  }

  const { data: bikes } = await bikesQuery

  if (!bikes) return NextResponse.json({ bikes: [] })

  // Get daily rentals that conflict
  const { data: rentalConflicts } = await supabase
    .from('rentals')
    .select('bike_id, start_datetime, expected_end_datetime')
    .in('status', ['active', 'extended'])
    .lt('start_datetime', bufferEnd.toISOString())
    .gt('expected_end_datetime', bufferStart.toISOString())

  // Get bookings that conflict — split by specific-bike vs model-based
  const { data: bookingConflicts } = await supabase
    .from('bookings')
    .select('bike_id, requested_brand, requested_model, start_datetime, end_datetime')
    .in('status', ['confirmed'])
    .lt('start_datetime', bufferEnd.toISOString())
    .gt('end_datetime', bufferStart.toISOString())

  // Get active monthly rentals
  const { data: monthlyConflicts } = await supabase
    .from('monthly_rentals')
    .select('bike_id')
    .eq('status', 'active')

  // Map conflicts
  const rentalMap = new Map<string, { start: string; end: string }>()
  for (const r of rentalConflicts ?? []) {
    rentalMap.set(r.bike_id, { start: r.start_datetime, end: r.expected_end_datetime })
  }

  // Specific-bike bookings (bike_id is set)
  const bookingMap = new Map<string, { start: string; end: string }>()
  // Model-based bookings (bike_id = null) — count per brand+model
  const modelBookingCount = new Map<string, number>()
  for (const b of bookingConflicts ?? []) {
    if (b.bike_id) {
      if (!rentalMap.has(b.bike_id)) {
        bookingMap.set(b.bike_id, { start: b.start_datetime, end: b.end_datetime })
      }
    } else if (b.requested_brand && b.requested_model) {
      const key = `${b.requested_brand}__${b.requested_model}`
      modelBookingCount.set(key, (modelBookingCount.get(key) ?? 0) + 1)
    }
  }

  const monthlySet = new Set((monthlyConflicts ?? []).map(m => m.bike_id))

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
    const rental = rentalMap.get(bike.id)
    if (rental) {
      return {
        ...bike, available: false, conflict_type: 'rented',
        conflict_reason: `มีการเช่า ${fmt(rental.start)}–${fmt(rental.end)}`,
      }
    }
    if (monthlySet.has(bike.id)) {
      return { ...bike, available: false, conflict_type: 'rented', conflict_reason: 'เช่ารายเดือน' }
    }
    const booking = bookingMap.get(bike.id)
    if (booking) {
      return {
        ...bike, available: false, conflict_type: 'booked',
        conflict_reason: `ติดจอง ${fmt(booking.start)}–${fmt(booking.end)}`,
      }
    }
    // Check if a model-based booking consumes this available bike
    const modelKey = `${bike.brand}__${bike.model}`
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
