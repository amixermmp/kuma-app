import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

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

  // 3-hour buffer: a rental must end at least 3h before search start to not conflict
  const bufferStart = new Date(searchStart.getTime() - BUFFER_HOURS * 3_600_000)

  const supabase = createAdminClient()

  // Get all bikes
  const { data: bikes } = await supabase
    .from('bikes')
    .select('id, license_plate, brand, model, color, year, daily_rate, odometer, status')
    .order('daily_rate', { ascending: true })

  if (!bikes) return NextResponse.json({ bikes: [] })

  // Get rentals that conflict
  const { data: rentalConflicts } = await supabase
    .from('rentals')
    .select('bike_id, start_datetime, expected_end_datetime')
    .in('status', ['active', 'extended'])
    .lt('start_datetime', searchEnd.toISOString())
    .gt('expected_end_datetime', bufferStart.toISOString())

  // Get bookings that conflict
  const { data: bookingConflicts } = await supabase
    .from('bookings')
    .select('bike_id, start_datetime, end_datetime')
    .in('status', ['confirmed'])
    .lt('start_datetime', searchEnd.toISOString())
    .gt('end_datetime', bufferStart.toISOString())

  // Map conflicts — rentals take priority over bookings
  const rentalMap = new Map<string, { start: string; end: string }>()
  for (const r of rentalConflicts ?? []) {
    rentalMap.set(r.bike_id, { start: r.start_datetime, end: r.expected_end_datetime })
  }

  const bookingMap = new Map<string, { start: string; end: string }>()
  for (const b of bookingConflicts ?? []) {
    if (!rentalMap.has(b.bike_id)) {
      bookingMap.set(b.bike_id, { start: b.start_datetime, end: b.end_datetime })
    }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' })

  const result = bikes.map(bike => {
    if (bike.status === 'repair') {
      return { ...bike, available: false, conflict_type: 'repair', conflict_reason: 'อยู่ระหว่างซ่อม' }
    }
    const rental = rentalMap.get(bike.id)
    if (rental) {
      return {
        ...bike, available: false, conflict_type: 'rented',
        conflict_reason: `มีการเช่า ${fmt(rental.start)}–${fmt(rental.end)}`,
      }
    }
    const booking = bookingMap.get(bike.id)
    if (booking) {
      return {
        ...bike, available: false, conflict_type: 'booked',
        conflict_reason: `ติดจอง ${fmt(booking.start)}–${fmt(booking.end)}`,
      }
    }
    return { ...bike, available: true, conflict_type: null }
  })

  return NextResponse.json({ bikes: result })
}
