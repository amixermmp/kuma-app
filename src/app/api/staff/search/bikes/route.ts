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

  // Get rentals that conflict with the search period (including 3h buffer)
  // Conflict = rental.start_datetime < searchEnd AND rental.expected_end_datetime > bufferStart
  const { data: conflicts } = await supabase
    .from('rentals')
    .select('bike_id, start_datetime, expected_end_datetime')
    .in('status', ['active', 'extended'])
    .lt('start_datetime', searchEnd.toISOString())
    .gt('expected_end_datetime', bufferStart.toISOString())

  // Map conflicting bike IDs with their rental info
  const conflictMap = new Map<string, { start: string; end: string }>()
  for (const r of conflicts ?? []) {
    conflictMap.set(r.bike_id, {
      start: r.start_datetime,
      end: r.expected_end_datetime,
    })
  }

  const result = bikes.map(bike => {
    if (bike.status === 'repair') {
      return { ...bike, available: false, conflict_reason: 'อยู่ระหว่างซ่อม' }
    }
    const conflict = conflictMap.get(bike.id)
    if (conflict) {
      const s = new Date(conflict.start).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' })
      const e = new Date(conflict.end).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' })
      return {
        ...bike,
        available: false,
        conflict_reason: `มีการเช่า ${s}–${e} (+ buffer ${BUFFER_HOURS} ชม.)`,
      }
    }
    return { ...bike, available: true }
  })

  return NextResponse.json({ bikes: result })
}
