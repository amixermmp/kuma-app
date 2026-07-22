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
    .select('id, booking_ref, bike_id, branch_id, requested_brand, requested_model, customer_name, customer_phone, start_datetime, end_datetime, bikes(license_plate, brand, model, status)')
    .eq('status', 'confirmed')
    .lte('start_datetime', in14days)
    .gte('end_datetime', nowIso)
  if (branchIds) bq = bq.in('branch_id', branchIds)
  const { data: bookings } = await bq
  if (!bookings || bookings.length === 0) return []

  const [{ data: rentals }, { data: monthlies }, { data: allBikes }] = await Promise.all([
    supabase.from('rentals').select('bike_id, start_datetime, expected_end_datetime').in('status', ['active', 'extended']),
    supabase.from('monthly_rentals').select('bike_id').eq('status', 'active'),
    supabase.from('bikes').select('id, branch_id, brand, model, status'),
  ])

  const monthlyBusy = new Set((monthlies ?? []).map(m => m.bike_id))
  const nowMs = Date.now()

  function isBikeBusyInWindow(bikeId: string, startIso: string, endIso: string): boolean {
    if (monthlyBusy.has(bikeId)) return true
    const bufferStart = new Date(startIso).getTime() - BUFFER_MS
    const bufferEnd = new Date(endIso).getTime() + BUFFER_MS
    return (rentals ?? []).some(r => {
      if (r.bike_id !== bikeId) return false
      const overdue = new Date(r.expected_end_datetime).getTime() <= nowMs
      const overlaps = new Date(r.start_datetime).getTime() < bufferEnd && new Date(r.expected_end_datetime).getTime() > bufferStart
      return overdue || overlaps
    })
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
      if (UNRENTABLE_STATUSES.includes(bike.status)) {
        results.push({ ...base, reason: `รถ ${bike.license_plate} ไม่พร้อมใช้งาน (${bike.status})` })
      } else if (isBikeBusyInWindow(b.bike_id, b.start_datetime, b.end_datetime)) {
        results.push({ ...base, reason: `รถ ${bike.license_plate} มีคนอื่นใช้ทับช่วงเวลานี้แล้ว` })
      }
    } else if (b.requested_brand && b.requested_model) {
      const candidates = (allBikes ?? []).filter(bk =>
        bk.branch_id === b.branch_id && bk.brand === b.requested_brand && bk.model === b.requested_model &&
        !UNRENTABLE_STATUSES.includes(bk.status)
      )
      const freeCount = candidates.filter(bk => !isBikeBusyInWindow(bk.id, b.start_datetime, b.end_datetime)).length
      // งานคิวรุ่นเดียวกัน ช่วงเวลาทับกัน ที่จะมาแย่งรถว่างชุดเดียวกัน
      const competing = bookings.filter(b2 =>
        b2.id !== b.id && !b2.bike_id && b2.branch_id === b.branch_id &&
        b2.requested_brand === b.requested_brand && b2.requested_model === b.requested_model &&
        new Date(b2.start_datetime).getTime() < new Date(b.end_datetime).getTime() &&
        new Date(b2.end_datetime).getTime() > new Date(b.start_datetime).getTime()
      ).length
      if (freeCount - competing <= 0) {
        results.push({ ...base, reason: `ไม่มีรถรุ่น ${b.requested_brand} ${b.requested_model} ว่างพอในช่วงเวลานี้` })
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
