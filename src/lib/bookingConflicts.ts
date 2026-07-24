import type { SupabaseClient } from '@supabase/supabase-js'
import { BUFFER_MS, UNRENTABLE_STATUSES, getBusyBikeIds } from './availability'

export type ModelBookingConflict = { id: string; booking_ref: string; customer_name: string; start_datetime: string }

// นับจำนวนรถขั้นต่ำที่ต้องใช้ "พร้อมกันจริง" จากช่วงเวลาที่อาจทับกัน — ถ้าสองช่วงไม่ทับกันเอง
// ใช้รถคันเดียวสลับกันได้ ไม่ต้องนับเป็น 2 คัน (bin packing) — sweep-line: +1 ตอนเริ่ม -1 ตอนจบ
// หาค่าที่ทับกันสูงสุด ณ จุดใดจุดหนึ่ง เวลาตรงกันเป๊ะให้จบก่อนเริ่ม (ชนกันพอดีตาม buffer ถือว่าไม่ทับ)
function maxOverlapCount(intervals: { start: number; end: number }[]): number {
  const events: { t: number; d: number }[] = []
  for (const iv of intervals) {
    events.push({ t: iv.start, d: 1 })
    events.push({ t: iv.end, d: -1 })
  }
  events.sort((a, b) => a.t - b.t || a.d - b.d)
  let cur = 0, max = 0
  for (const e of events) {
    cur += e.d
    if (cur > max) max = cur
  }
  return max
}

export type ModelAvailability = { totalCount: number; freeBikeIds: string[] }

/**
 * หารถว่างจริงของรุ่นนี้ในช่วง [fromIso, toIso] แบบคิดรวมการต่อคิวในคันเดียวกันได้ (bin packing)
 * เดิมทุกจุดที่เช็ค "รุ่นนี้ว่างไหม" นับแค่จำนวนคิวจองแบบระบุรุ่นที่ทับช่วงเวลา แล้วหักออกจากจำนวนรถตรงๆ
 * ทำให้คิวจองสองคิวที่ไม่ทับกันเอง (เช่น คิวแรกคืนเช้า คิวสองรับบ่ายวันเดียวกัน) โดนนับเป็น 2 คันทั้งที่
 * ใช้รถคันเดียวสลับกันได้จริง — พาลูกค้าที่ควรจองได้ให้ขึ้น "ไม่มีรถว่าง" ทั้งที่ยังว่างจริงอยู่
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getModelBikeAvailability(
  supabase: SupabaseClient<any, any, any>,
  branchId: string, brand: string, model: string,
  fromIso: string, toIso: string,
  excludeBikeId?: string,
  excludeBookingId?: string,
): Promise<ModelAvailability> {
  const bufferStart = new Date(new Date(fromIso).getTime() - BUFFER_MS).toISOString()
  const bufferEnd = new Date(new Date(toIso).getTime() + BUFFER_MS).toISOString()

  const [{ data: candidates }, busyIds, { data: specificBookings }, { data: modelBookingsRaw }] = await Promise.all([
    supabase.from('bikes').select('id')
      .eq('branch_id', branchId).eq('brand', brand).eq('model', model)
      .not('status', 'in', `("${UNRENTABLE_STATUSES.join('","')}")`),
    getBusyBikeIds(supabase, fromIso, toIso),
    supabase.from('bookings').select('bike_id, start_datetime, end_datetime')
      .eq('status', 'confirmed').not('bike_id', 'is', null)
      .lt('start_datetime', bufferEnd).gt('end_datetime', bufferStart),
    supabase.from('bookings').select('id, start_datetime, end_datetime')
      .eq('branch_id', branchId).eq('requested_brand', brand).eq('requested_model', model)
      .is('bike_id', null).eq('status', 'confirmed')
      .lt('start_datetime', bufferEnd).gt('end_datetime', bufferStart),
  ])
  // ตอนแก้ไขวันของคิวจองเดิม ไม่นับตัวเองเป็นคู่แข่งชิงโควต้ารุ่น (ไม่งั้นจะชนกับตัวเองปลอมๆ)
  const modelBookings = (modelBookingsRaw ?? []).filter(b => b.id !== excludeBookingId)

  const candidateIds = (candidates ?? []).map(b => b.id).filter(id => id !== excludeBikeId)
  const specificallyBusy = new Set((specificBookings ?? []).map(b => b.bike_id))
  const physicallyFreeIds = candidateIds.filter(id => !busyIds.has(id) && !specificallyBusy.has(id))

  // หาร BUFFER_MS ครึ่งหนึ่งขยายแต่ละฝั่ง เพราะ sweep-line เทียบทั้งคู่ที่ขยายแล้ว — ถ้าขยายเต็มทั้งคู่
  // จะกลายเป็นต้องเว้นช่องว่างจริง 2 เท่าของ buffer ที่ตั้งใจไว้ (นับ buffer ซ้อนสองรอบโดยไม่ตั้งใจ)
  const intervals = modelBookings.map(b => ({
    start: new Date(b.start_datetime).getTime() - BUFFER_MS / 2,
    end: new Date(b.end_datetime).getTime() + BUFFER_MS / 2,
  }))
  const used = Math.min(maxOverlapCount(intervals), physicallyFreeIds.length)

  return {
    totalCount: (candidates ?? []).length,
    freeBikeIds: physicallyFreeIds.slice(used),
  }
}

/**
 * เช็คว่าถ้าเอารถคันนี้ (excludeBikeId) ไปใช้ในช่วง [startIso, endIso] จะทำให้คิวจองแบบ
 * "ระบุแค่รุ่น ไม่เจาะจงคัน" (bike_id เป็น null) ของรุ่นเดียวกันในสาขาเดียวกันขาดรถหรือไม่
 * ใช้ตอนส่งรถ/ต่อเวลา/ทำสัญญารายเดือน — เดิมระบบเช็คแค่ชนคิวที่เจาะจงคันนี้ตรงๆ เท่านั้น
 * ไม่เคยเช็คผลกระทบต่อคิวจองแบบรุ่น ทำให้ปล่อยผ่านเงียบๆ แล้วไปโผล่คิวมีปัญหาทีหลังแบบไม่มีการเตือนล่วงหน้า
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findModelBookingConflict(
  supabase: SupabaseClient<any, any, any>,
  branchId: string, brand: string, model: string, excludeBikeId: string,
  startIso: string, endIso: string,
): Promise<ModelBookingConflict | null> {
  const bufferStart = new Date(new Date(startIso).getTime() - BUFFER_MS).toISOString()
  const bufferEnd = new Date(new Date(endIso).getTime() + BUFFER_MS).toISOString()

  const [{ data: modelBookings }, { data: modelBikes }] = await Promise.all([
    supabase.from('bookings')
      .select('id, booking_ref, customer_name, start_datetime, end_datetime, created_at')
      .eq('branch_id', branchId).eq('requested_brand', brand).eq('requested_model', model)
      .is('bike_id', null).eq('status', 'confirmed')
      .lt('start_datetime', bufferEnd).gt('end_datetime', bufferStart),
    supabase.from('bikes').select('id')
      .eq('branch_id', branchId).eq('brand', brand).eq('model', model)
      .not('status', 'in', `("${UNRENTABLE_STATUSES.join('","')}")`),
  ])
  if (!modelBookings || modelBookings.length === 0) return null

  const busyIds = await getBusyBikeIds(supabase, startIso, endIso)
  const freeCountExcludingThis = (modelBikes ?? []).filter(b => b.id !== excludeBikeId && !busyIds.has(b.id)).length

  // คิดรวมการต่อคิวในคันเดียวกันได้ (bin packing) — สองคิวที่ไม่ทับกันเองใช้รถคันเดียวสลับกันได้
  // ไม่ต้องนับเป็น 2 คัน (เดิมนับจำนวนคิวจองตรงๆ ทำให้เตือนชนคิวเกินจริงบ่อยเกินไป)
  // หาร BUFFER_MS ครึ่งหนึ่งขยายแต่ละฝั่ง กันนับ buffer ซ้อนสองรอบ (ดูเหตุผลเดียวกับ getModelBikeAvailability)
  const neededSimultaneously = maxOverlapCount(modelBookings.map(b => ({
    start: new Date(b.start_datetime).getTime() - BUFFER_MS / 2,
    end: new Date(b.end_datetime).getTime() + BUFFER_MS / 2,
  })))
  if (freeCountExcludingThis >= neededSimultaneously) return null

  // เตือนคิวที่ใกล้ถึงกำหนดที่สุดก่อน (คิวใกล้ยังมีเวลาหาคันทดแทนน้อยกว่า) ถ้าวันเวลารับรถตรงกันเป๊ะ
  // ค่อยดูว่าใครจองไว้ก่อน (created_at)
  return [...modelBookings].sort((a, b) =>
    new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime() ||
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )[0]
}

/**
 * เช็คว่าคิวจองนี้ (thisBooking) จะได้รถจริงไหมถ้าจัดให้รุ่น (brand, model) แบบ "เข้มงวด" —
 * ต้องได้รถเองด้วย AND ต้องไม่ไปแย่งคิวจองอื่นของรุ่นนี้ที่ตอนนี้ยังได้รถอยู่ดีๆ ให้กลายเป็นคิวมีปัญหาแทน
 * (จำลองจัดสรร 2 รอบ — ไม่มี thisBooking กับมี thisBooking แล้วเทียบว่ามีใครหลุดจากที่เคยได้รถไหม)
 * ใช้ตอนเปลี่ยนรุ่นที่จองจากหน้าคิวมีปัญหา (คิวยังมาไม่ถึง ไม่ใช่เคสรถเสียเร่งด่วนที่ลูกค้ารออยู่ตรงหน้า
 * ซึ่งใช้ findModelBookingConflict + Fast lane แยกต่างหาก ยอมแย่งได้เพราะเร่งด่วนกว่าจริง)
 * ป้องกันเคส "สลับรุ่นแก้คิวนี้ได้ แต่ดันไปทำอีกคิวพังแทนแบบเงียบๆ" ซึ่งไม่ได้แก้อะไรเลยในภาพรวม
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function wouldBookingGetBikeForModel(
  supabase: SupabaseClient<any, any, any>,
  branchId: string, brand: string, model: string,
  thisBooking: { id: string; start_datetime: string; end_datetime: string; created_at: string },
): Promise<boolean> {
  const bufferStart = new Date(new Date(thisBooking.start_datetime).getTime() - BUFFER_MS).toISOString()
  const bufferEnd = new Date(new Date(thisBooking.end_datetime).getTime() + BUFFER_MS).toISOString()

  const [{ data: candidates }, { data: modelBookings }, { data: specificBookings }, { data: rentals }, { data: monthlies }] = await Promise.all([
    supabase.from('bikes').select('id')
      .eq('branch_id', branchId).eq('brand', brand).eq('model', model)
      .not('status', 'in', `("${UNRENTABLE_STATUSES.join('","')}")`),
    supabase.from('bookings').select('id, start_datetime, end_datetime, created_at')
      .eq('branch_id', branchId).eq('requested_brand', brand).eq('requested_model', model)
      .is('bike_id', null).eq('status', 'confirmed')
      .lt('start_datetime', bufferEnd).gt('end_datetime', bufferStart),
    supabase.from('bookings').select('bike_id, start_datetime, end_datetime')
      .eq('status', 'confirmed').not('bike_id', 'is', null)
      .lt('start_datetime', bufferEnd).gt('end_datetime', bufferStart),
    supabase.from('rentals').select('bike_id, start_datetime, expected_end_datetime').in('status', ['active', 'extended']),
    supabase.from('monthly_rentals').select('bike_id').eq('status', 'active'),
  ])

  const candidateIds = new Set((candidates ?? []).map(b => b.id))
  const monthlyBusy = new Set((monthlies ?? []).map(m => m.bike_id))
  const nowMs = Date.now()

  function isBikeBusyInWindow(bikeId: string, startIso: string, endIso: string): boolean {
    if (monthlyBusy.has(bikeId)) return true
    const bStart = new Date(startIso).getTime() - BUFFER_MS
    const bEnd = new Date(endIso).getTime() + BUFFER_MS
    return (rentals ?? []).some(r => {
      if (r.bike_id !== bikeId) return false
      const overdue = new Date(r.expected_end_datetime).getTime() <= nowMs
      const overlaps = new Date(r.start_datetime).getTime() < bEnd && new Date(r.expected_end_datetime).getTime() > bStart
      return overdue || overlaps
    })
  }

  // จำลองจัดสรรตามลำดับความสำคัญเดียวกับคิวมีปัญหา (ใกล้วันรับก่อน แล้วตามลำดับจอง)
  // คืนค่า id ของคิวที่ "ได้รถ" ทั้งหมดในรอบจำลองนั้น — เรียกซ้ำได้ไม่ชนกันเพราะสร้าง claimed ใหม่ทุกครั้ง
  function allocate(pool: { id: string; start_datetime: string; end_datetime: string; created_at: string }[]): Set<string> {
    const claimed = new Map<string, { start: number; end: number }[]>()
    for (const sc of specificBookings ?? []) {
      if (!candidateIds.has(sc.bike_id)) continue
      const arr = claimed.get(sc.bike_id) ?? []
      arr.push({ start: new Date(sc.start_datetime).getTime(), end: new Date(sc.end_datetime).getTime() })
      claimed.set(sc.bike_id, arr)
    }
    const priority = [...pool].sort((a, b) =>
      new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime() ||
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    const succeeded = new Set<string>()
    for (const b of priority) {
      const bStart = new Date(b.start_datetime).getTime()
      const bEnd = new Date(b.end_datetime).getTime()
      const bike = (candidates ?? []).find(bk => {
        if (isBikeBusyInWindow(bk.id, b.start_datetime, b.end_datetime)) return false
        const claims = claimed.get(bk.id) ?? []
        return !claims.some(c => c.start < bEnd + BUFFER_MS && c.end > bStart - BUFFER_MS)
      })
      if (bike) {
        const claims = claimed.get(bike.id) ?? []
        claims.push({ start: bStart, end: bEnd })
        claimed.set(bike.id, claims)
        succeeded.add(b.id)
      }
    }
    return succeeded
  }

  const others = (modelBookings ?? []).filter(b => b.id !== thisBooking.id)
  const beforeSucceeded = allocate(others)
  const afterSucceeded = allocate([...others, thisBooking])

  if (!afterSucceeded.has(thisBooking.id)) return false
  for (const id of Array.from(beforeSucceeded)) {
    if (!afterSucceeded.has(id)) return false // มีคิวที่เคยได้รถอยู่ดีๆ โดนแย่งไป — ไม่ยอมให้เสนอรุ่นนี้
  }
  return true
}

export type BrokenBooking = {
  id: string
  booking_ref: string
  customer_name: string
  customer_phone: string | null
  start_datetime: string
  end_datetime: string
  created_at: string
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
    .select('id, booking_ref, bike_id, branch_id, requested_brand, requested_model, customer_name, customer_phone, start_datetime, end_datetime, created_at, fast_lane, bikes(license_plate, brand, model, status)')
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

  // คิวจองแบบระบุแค่รุ่น (bike_id เป็น null) — จำลองจัดสรรรถแบบ greedy ตามลำดับความสำคัญเดียวกับที่
  // โชว์ในคิวมีปัญหา (ใกล้วันรับก่อน แล้วค่อยตามลำดับจอง) แทนการนับ "ชนกันกี่คิว" แบบสมมาตรเดิม
  // ซึ่งทำให้คิวที่มีช่วงเวลายาว (เลยทับคิวอื่นเยอะ) ถูกตัดสินว่า broken ทั้งที่ควรได้รถก่อนเพราะใกล้ถึงกำหนดกว่า
  const modelGroups = new Map<string, typeof bookings>()
  for (const b of bookings) {
    if (b.bike_id || !b.requested_brand || !b.requested_model) continue
    const key = `${b.branch_id}__${b.requested_brand}__${b.requested_model}`
    if (!modelGroups.has(key)) modelGroups.set(key, [])
    modelGroups.get(key)!.push(b)
  }

  const brokenModelBookingIds = new Set<string>()
  for (const [key, groupBookings] of Array.from(modelGroups)) {
    const [groupBranchId, groupBrand, groupModel] = key.split('__')
    const candidates = (allBikes ?? []).filter(bk =>
      bk.branch_id === groupBranchId && bk.brand === groupBrand && bk.model === groupModel &&
      !UNRENTABLE_STATUSES.includes(bk.status)
    )
    const priority = [...groupBookings].sort((a, b) =>
      new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime() ||
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    const claimed = new Map<string, { start: number; end: number }[]>()
    for (const b of priority) {
      const bStart = new Date(b.start_datetime).getTime()
      const bEnd = new Date(b.end_datetime).getTime()
      const bike = candidates.find(bk => {
        if (isBikeBusyInWindow(bk.id, b.start_datetime, b.end_datetime).busy) return false
        const claims = claimed.get(bk.id) ?? []
        // เผื่อ buffer เตรียมรถ/ทำความสะอาดระหว่าง 2 คิวติดกัน เหมือนกับที่ isBikeBusyInWindow ใช้อยู่แล้ว
        return !claims.some(c => c.start < bEnd + BUFFER_MS && c.end > bStart - BUFFER_MS)
      })
      if (bike) {
        const claims = claimed.get(bike.id) ?? []
        claims.push({ start: bStart, end: bEnd })
        claimed.set(bike.id, claims)
      } else {
        brokenModelBookingIds.add(b.id)
      }
    }
  }

  const results: BrokenBooking[] = []

  for (const b of bookings) {
    const bike = one(b.bikes)
    const base = {
      id: b.id, booking_ref: b.booking_ref, customer_name: b.customer_name, customer_phone: b.customer_phone,
      start_datetime: b.start_datetime, end_datetime: b.end_datetime, created_at: b.created_at, branch_id: b.branch_id,
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
      if (brokenModelBookingIds.has(b.id)) {
        results.push({ ...base, reason: `ไม่มีรถรุ่น ${b.requested_brand} ${b.requested_model} ว่างพอในช่วงเวลานี้`, fastLane: !!b.fast_lane })
      }
    }
  }

  // เรียงตามวันรับรถที่ใกล้ที่สุดก่อน — คิวที่เร่งด่วนกว่าต้องเห็นก่อน (ยังมีเวลาหาคันทดแทนน้อยกว่าคิวที่ไกล)
  // ถ้าวันเวลารับรถตรงกันเป๊ะ ค่อยดูว่าใครจองไว้ก่อน (created_at)
  results.sort((a, b) =>
    new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime() ||
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

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
