import type { SupabaseClient } from '@supabase/supabase-js'

export const BUFFER_MS = 3 * 3_600_000 // เว้น 3 ชม. ทั้งก่อนรับและหลังคืน

/**
 * รถที่ "ไม่ว่าง" จากสัญญาเช่า (ตัวกลาง — ทุกจุดที่เช็ครถว่างต้องใช้ตัวนี้)
 *
 * กติกา:
 *  1. สัญญา active/extended = รถยังอยู่ข้างนอก (ยังไม่กดจบสัญญา)
 *  2. ถ้า "เกินกำหนดแล้วแต่ยังไม่คืน" → ไม่ว่างเสมอ ไม่ว่าค้นหาช่วงไหน
 *     (ห้ามให้จอง/ส่งรถทับ จนกว่าจะกดจบสัญญา — ลูกค้าอาจจ่ายช้า/ยังไม่คืน)
 *  3. ถ้ายังไม่เกินกำหนด → ไม่ว่างเฉพาะเมื่อช่วงเช่าทับหน้าต่างค้นหา (รวม buffer 3 ชม.)
 *  4. รายเดือน active = ไม่ว่างเสมอ
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getBusyBikeIds(supabase: SupabaseClient<any, any, any>, windowStartIso: string, windowEndIso: string): Promise<Set<string>> {
  const bufferStart = new Date(new Date(windowStartIso).getTime() - BUFFER_MS).toISOString()
  const bufferEnd = new Date(new Date(windowEndIso).getTime() + BUFFER_MS).toISOString()
  const nowIso = new Date().toISOString()

  const [{ data: rentals }, { data: monthlies }] = await Promise.all([
    supabase.from('rentals')
      .select('bike_id, start_datetime, expected_end_datetime')
      .in('status', ['active', 'extended']),
    supabase.from('monthly_rentals')
      .select('bike_id')
      .eq('status', 'active'),
  ])

  const busy = new Set<string>()
  for (const r of rentals ?? []) {
    const overdue = r.expected_end_datetime <= nowIso
    const overlaps = r.start_datetime < bufferEnd && r.expected_end_datetime > bufferStart
    if (overdue || overlaps) busy.add(r.bike_id)
  }
  for (const m of monthlies ?? []) busy.add(m.bike_id)
  return busy
}

// สถานะรถที่ห้ามปล่อยเช่า/จองเสมอ
export const UNRENTABLE_STATUSES = ['repair', 'maintenance', 'locked', 'retired', 'inactive']

/**
 * รถคันนี้มี "สัญญาค้าง" อยู่ไหม (รายวัน active/extended หรือรายเดือน active)
 * ใช้เป็น guard ก่อนสร้างสัญญาใหม่/สลับรถ — กันสัญญาซ้อนคันเดียวกัน
 * (ไม่สนสถานะรถ เพราะสถานะอาจค้าง/ไม่ตรงจริง — ดูจากสัญญาเป็นหลัก)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function hasOpenContract(supabase: SupabaseClient<any, any, any>, bikeId: string): Promise<boolean> {
  const [{ data: openRental }, { data: openMonthly }] = await Promise.all([
    supabase.from('rentals').select('id').eq('bike_id', bikeId).in('status', ['active', 'extended']).limit(1).maybeSingle(),
    supabase.from('monthly_rentals').select('id').eq('bike_id', bikeId).eq('status', 'active').limit(1).maybeSingle(),
  ])
  return Boolean(openRental || openMonthly)
}
