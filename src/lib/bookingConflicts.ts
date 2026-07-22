import type { SupabaseClient } from '@supabase/supabase-js'
import { BUFFER_MS, UNRENTABLE_STATUSES } from './availability'

export type BrokenBooking = {
  id: string
  booking_ref: string
  customer_name: string
  customer_phone: string | null
  start_datetime: string
  end_datetime: string
  branch_id: string
  bike_id: string | null
  requested_brand: string | null
  requested_model: string | null
  reason: string
  fastLane: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function one(v: any) {
  return Array.isArray(v) ? v[0] : v
}

/**
 * คิวจอง (confirmed, ยังไม่เกิน 14 วันข้างหน้า) ที่ตอนนี้ "พังจริง" เพราะรถที่ผูกไว้
 * ไม่พร้อมใช้แล้ว (ซ่อม/ล็อค/เลิกใช้ หรือมีคนอื่นใช้ทับ) หรือรุ่นที่จองไว้ไม่มีรถว่างพอ
 * เช็คสดทุกครั้งที่เรียก — ไม่มีสถานะค้างในฐานข้อมูล พอแก้ปัญหาแล้วรายการจะหายเอง
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findBrokenBookings(supabase: SupabaseClient<any, any, any>, branchIds?: string[] | null): Promise<BrokenBooking[]> {
  const nowIso = new Date().toISOString()
  const in14days = new Date(Date.now() + 14 * 86_400_000).toISOString()

  let bq = supabase.from('bookings')
    .select('id, booking_ref, bike_id, branch_id, requested_brand, requested_model, customer_name, customer_phone, start_datetime, end_datetime, fast_lane, bikes(license_plate, brand, model, status)')
    .eq('status', 'confirmed')
    .lte('start_datetime', in14days)
    .gte('end_datetime', nowIso)
  if (branchIds) bq = bq.in('branch_id', branchIds)
  const { data: bookings } = await bq
  if (!bookings || bookings.length === 0) return []

  const specificBikeIds = Array.from(new Set(bookings.filter(b => b.bike_id).map(b => b.bike_id as string)))

  const [{ data: rentals }, { data: monthlies }, { data: allBikes }, { data: otherBookingsOnSameBikes }] = await Promise.all([
    supabase.from('rentals').select('bike_id, start_datetime, expected_end_datetime, fast_lane').in('status', ['active', 'extended']),
    supabase.from('monthly_rentals').select('bike_id, fast_lane').eq('status', 'active'),
    supabase.from('bikes').select('id, branch_id, brand, model, status'),
    specificBikeIds.length > 0
      ? supabase.from('bookings').select('id, booking_ref, customer_name, bike_id, start_datetime, end_datetime, fast_lane').eq('status', 'confirmed').in('bike_id', specificBikeIds)
      : Promise.resolve({ data: [] as { id: string; booking_ref: string; customer_name: string; bike_id: string; start_datetime: string; end_datetime: string; fast_lane: boolean | null }[] }),
  ])

  const monthlyBusy = new Map((monthlies ?? []).map(m => [m.bike_id, !!m.fast_lane]))
  const nowMs = Date.now()

  function isBikeBusyInWindow(bikeId: string, startIso: string, endIso: string): { busy: boolean; fastLane: boolean } {
    if (monthlyBusy.has(bikeId)) return { busy: true, fastLane: !!monthlyBusy.get(bikeId) }
    const bufferStart = new Date(startIso).getTime() - BUFFER_MS
    const bufferEnd = new Date(endIso).getTime() + BUFFER_MS
    const hit = (rentals ?? []).find(r => {
      if (r.bike_id !== bikeId) return false
      const overdue = new Date(r.expected_end_datetime).getTime() <= nowMs
      const overlaps = new Date(r.start_datetime).getTime() < bufferEnd && new Date(r.expected_end_datetime).getTime() > bufferStart
      return overdue || overlaps
    })
    return { busy: !!hit, fastLane: !!hit?.fast_lane }
  }

  // จองซ้อนจอง (booking vs booking) — ปกติระบบกันไว้ตั้งแต่ตอนสร้างจอง แต่ Fast lane
  // อนุญาตให้จองซ้อนได้โดยตั้งใจ จึงต้องเช็คเพิ่มแยกจาก isBikeBusyInWindow (เช็คแค่รถชนสัญญาที่เปิดใช้งานจริง)
  function findOverlappingBooking(bookingId: string, bikeId: string, startIso: string, endIso: string) {
    return (otherBookingsOnSameBikes ?? []).find(ob =>
      ob.id !== bookingId && ob.bike_id === bikeId &&
      new Date(ob.start_datetime).getTime() < new Date(endIso).getTime() &&
      new Date(ob.end_datetime).getTime() > new Date(startIso).getTime()
    )
  }

  const results: BrokenBooking[] = []

  for (const b of bookings) {
    const bike = one(b.bikes)
    const base = {
      id: b.id, booking_ref: b.booking_ref, customer_name: b.customer_name, customer_phone: b.customer_phone,
      start_datetime: b.start_datetime, end_datetime: b.end_datetime, branch_id: b.branch_id,
      bike_id: b.bike_id, requested_brand: b.requested_brand, requested_model: b.requested_model,
    }

    if (b.bike_id) {
      if (!bike) continue
      const overlappingBooking = findOverlappingBooking(b.id, b.bike_id, b.start_datetime, b.end_datetime)
      const busyCheck = isBikeBusyInWindow(b.bike_id, b.start_datetime, b.end_datetime)
      if (UNRENTABLE_STATUSES.includes(bike.status)) {
        results.push({ ...base, reason: `รถ ${bike.license_plate} ไม่พร้อมใช้งาน (${bike.status})`, fastLane: false })
      } else if (busyCheck.busy) {
        results.push({ ...base, reason: `รถ ${bike.license_plate} มีคนอื่นใช้ทับช่วงเวลานี้แล้ว`, fastLane: busyCheck.fastLane })
      } else if (overlappingBooking) {
        results.push({ ...base, reason: `รถ ${bike.license_plate} มีคิวจองอื่นชนช่วงเวลาเดียวกัน — ${overlappingBooking.booking_ref} คุณ${overlappingBooking.customer_name}`, fastLane: !!b.fast_lane || !!overlappingBooking.fast_lane })
      }
    } else if (b.requested_brand && b.requested_model) {
      const candidates = (allBikes ?? []).filter(bk =>
        bk.branch_id === b.branch_id && bk.brand === b.requested_brand && bk.model === b.requested_model &&
        !UNRENTABLE_STATUSES.includes(bk.status)
      )
      const freeCount = candidates.filter(bk => !isBikeBusyInWindow(bk.id, b.start_datetime, b.end_datetime).busy).length
      // งานคิวรุ่นเดียวกัน ช่วงเวลาทับกัน ที่จะมาแย่งรถว่างชุดเดียวกัน
      const competing = bookings.filter(b2 =>
        b2.id !== b.id && !b2.bike_id && b2.branch_id === b.branch_id &&
        b2.requested_brand === b.requested_brand && b2.requested_model === b.requested_model &&
        new Date(b2.start_datetime).getTime() < new Date(b.end_datetime).getTime() &&
        new Date(b2.end_datetime).getTime() > new Date(b.start_datetime).getTime()
      ).length
      if (freeCount - competing <= 0) {
        results.push({ ...base, reason: `ไม่มีรถรุ่น ${b.requested_brand} ${b.requested_model} ว่างพอในช่วงเวลานี้`, fastLane: !!b.fast_lane })
      }
    }
  }

  // เรียงตามวันรับรถที่ใกล้ที่สุดก่อน — คิวที่เร่งด่วนกว่าต้องเห็นก่อน
  results.sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime())

  return results
}

/**
 * เช็คเฉพาะคิวที่เกี่ยวกับรถคันเดียว — ใช้เด้ง popup ทันทีหลังทำรายการที่กระทบรถคันนั้น
 * (แจ้งรถเสีย / สลับรถ)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findBookingConflictsForBike(supabase: SupabaseClient<any, any, any>, bikeId: string): Promise<BrokenBooking[]> {
  const { data: bike } = await supabase.from('bikes').select('id, branch_id, brand, model').eq('id', bikeId).single()
  if (!bike) return []
  const all = await findBrokenBookings(supabase, [bike.branch_id])
  return all.filter(r => r.bike_id === bikeId || (!r.bike_id && r.requested_brand === bike.brand && r.requested_model === bike.model))
}
