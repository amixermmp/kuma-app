import type { SupabaseClient } from '@supabase/supabase-js'
import { BUFFER_MS, UNRENTABLE_STATUSES } from './availability'

export type ModelBookingConflict = { id: string; booking_ref: string; customer_name: string; start_datetime: string }

export type ModelAvailability = { totalCount: number; freeBikeIds: string[] }

/**
 * หารถว่างจริงของรุ่นนี้ในช่วง [fromIso, toIso] แบบจำลองจัดสรรรถให้คิวจองที่มีอยู่ก่อนจริงๆ
 * (เดินตารางแบบเดียวกับ findBrokenBookings/findModelBookingConflict) แทนการนับ "ชนกันสูงสุดกี่คิว"
 * เทียบกับ "ว่างกี่คัน" แบบหยาบ ซึ่งนับคิวที่ไม่ได้ใช้รถพร้อมกันจริงเป็นการแย่งโควต้าเกินจริง — เคยเจอเคส
 * ค้นหาไม่ว่างทั้งที่กดส่งจริงผ่านฉลุยไม่ชนคิวเลย เพราะสองจุดนี้ใช้ตรรกะคนละแบบกัน
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getModelBikeAvailability(
  supabase: SupabaseClient<any, any, any>,
  branchId: string, brand: string, model: string,
  fromIso: string, toIso: string,
  excludeBikeId?: string,
  excludeBookingId?: string,
): Promise<ModelAvailability> {
  const nowIso = new Date().toISOString()

  const [{ data: candidatesRaw }, { data: modelBookings }, { data: specificBookings }, { data: rentals }, { data: monthlies }] = await Promise.all([
    supabase.from('bikes').select('id')
      .eq('branch_id', branchId).eq('brand', brand).eq('model', model)
      .not('status', 'in', `("${UNRENTABLE_STATUSES.join('","')}")`),
    supabase.from('bookings').select('id, start_datetime, end_datetime, created_at')
      .eq('branch_id', branchId).eq('requested_brand', brand).eq('requested_model', model)
      .is('bike_id', null).eq('status', 'confirmed')
      .gt('end_datetime', nowIso),
    supabase.from('bookings').select('bike_id, start_datetime, end_datetime')
      .eq('status', 'confirmed').not('bike_id', 'is', null)
      .gt('end_datetime', nowIso),
    supabase.from('rentals').select('bike_id, start_datetime, expected_end_datetime').in('status', ['active', 'extended']),
    supabase.from('monthly_rentals').select('bike_id').eq('status', 'active'),
  ])

  const candidates = (candidatesRaw ?? []).filter(b => b.id !== excludeBikeId)
  const candidateIds = new Set(candidates.map(b => b.id))
  const monthlyBusy = new Set((monthlies ?? []).map(m => m.bike_id))
  const nowMs = Date.now()

  function isBikeBusyInWindow(bikeId: string, bStartIso: string, bEndIso: string): boolean {
    if (monthlyBusy.has(bikeId)) return true
    const bStart = new Date(bStartIso).getTime() - BUFFER_MS
    const bEnd = new Date(bEndIso).getTime() + BUFFER_MS
    return (rentals ?? []).some(r => {
      if (r.bike_id !== bikeId) return false
      const overdue = new Date(r.expected_end_datetime).getTime() <= nowMs
      const overlaps = new Date(r.start_datetime).getTime() < bEnd && new Date(r.expected_end_datetime).getTime() > bStart
      return overdue || overlaps
    })
  }

  // จำลองจัดสรรคิวจองแบบระบุแค่รุ่นที่มีอยู่ก่อนแล้ว (ไม่รวมคิวที่กำลังแก้ไขเอง) ตามลำดับความสำคัญ
  // เดียวกับคิวมีปัญหา เพื่อรู้ว่าคันไหนถูกจับจองไว้แล้วจริงๆ ช่วงไหนบ้าง
  const claimed = new Map<string, { start: number; end: number }[]>()
  for (const sc of specificBookings ?? []) {
    if (!candidateIds.has(sc.bike_id)) continue
    const arr = claimed.get(sc.bike_id) ?? []
    arr.push({ start: new Date(sc.start_datetime).getTime(), end: new Date(sc.end_datetime).getTime() })
    claimed.set(sc.bike_id, arr)
  }
  const priorityBookings = (modelBookings ?? []).filter(b => b.id !== excludeBookingId)
  const priority = [...priorityBookings].sort((a, b) =>
    new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime() ||
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  for (const b of priority) {
    const bStart = new Date(b.start_datetime).getTime()
    const bEnd = new Date(b.end_datetime).getTime()
    const bike = candidates.find(bk => {
      if (isBikeBusyInWindow(bk.id, b.start_datetime, b.end_datetime)) return false
      const claims = claimed.get(bk.id) ?? []
      return !claims.some(c => c.start < bEnd + BUFFER_MS && c.end > bStart - BUFFER_MS)
    })
    if (bike) {
      const claims = claimed.get(bike.id) ?? []
      claims.push({ start: bStart, end: bEnd })
      claimed.set(bike.id, claims)
    }
  }

  // คันที่ว่างจริงสำหรับช่วง [fromIso, toIso] คือคันที่ไม่ติดสัญญาเช่าจริง และไม่ถูกคิวจองที่มีอยู่ก่อนจับจองไว้ทับช่วงนี้
  const targetStart = new Date(fromIso).getTime()
  const targetEnd = new Date(toIso).getTime()
  const freeBikeIds = candidates.filter(bk => {
    if (isBikeBusyInWindow(bk.id, fromIso, toIso)) return false
    const claims = claimed.get(bk.id) ?? []
    return !claims.some(c => c.start < targetEnd + BUFFER_MS && c.end > targetStart - BUFFER_MS)
  }).map(bk => bk.id)

  return {
    totalCount: candidates.length,
    freeBikeIds,
  }
}

/**
 * เช็คว่าถ้าเอารถคันนี้ (excludeBikeId) ไปใช้ในช่วง [startIso, endIso] จะทำให้คิวจองแบบ
 * "ระบุแค่รุ่น ไม่เจาะจงคัน" (bike_id เป็น null) ของรุ่นเดียวกันในสาขาเดียวกันขาดรถหรือไม่
 * ใช้ตอนส่งรถ/ต่อเวลา/ทำสัญญารายเดือน — เดิมระบบเช็คแค่ชนคิวที่เจาะจงคันนี้ตรงๆ เท่านั้น
 * ไม่เคยเช็คผลกระทบต่อคิวจองแบบรุ่น ทำให้ปล่อยผ่านเงียบๆ แล้วไปโผล่คิวมีปัญหาทีหลังแบบไม่มีการเตือนล่วงหน้า
 *
 * จำลองจัดสรรรถแบบเดียวกับคิวมีปัญหา (findBrokenBookings) 2 รอบ — ก่อน/หลังให้คันนี้ไม่ว่างเพิ่มช่วง
 * [startIso, endIso] แล้วเทียบว่ามีคิวไหนที่เคยได้รถอยู่ดีๆ หลุดไปไหม เดิมเช็คแบบหยาบ (นับรถที่ไม่ว่าง
 * "ตรงไหนก็ได้ในช่วงที่เช็ค" ว่าไม่ว่างทั้งช่วง) ทำให้รถที่ไม่ว่างแค่ต้นช่วงสั้นๆ ถูกนับว่าไม่ว่างทั้งช่วงยาว
 * เตือนชนคิวเกินจริงบ่อยตอนเช็คช่วงกว้างๆ (ต่อเวลารายสัปดาห์/ทำสัญญารายเดือน) ทั้งที่จัดสรรจริงยังพอ
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findModelBookingConflict(
  supabase: SupabaseClient<any, any, any>,
  branchId: string, brand: string, model: string, excludeBikeId: string,
  startIso: string, endIso: string,
): Promise<ModelBookingConflict | null> {
  const nowIso = new Date().toISOString()

  const [{ data: candidates }, { data: modelBookings }, { data: specificBookings }, { data: rentals }, { data: monthlies }] = await Promise.all([
    supabase.from('bikes').select('id')
      .eq('branch_id', branchId).eq('brand', brand).eq('model', model)
      .not('status', 'in', `("${UNRENTABLE_STATUSES.join('","')}")`),
    supabase.from('bookings')
      .select('id, booking_ref, customer_name, start_datetime, end_datetime, created_at')
      .eq('branch_id', branchId).eq('requested_brand', brand).eq('requested_model', model)
      .is('bike_id', null).eq('status', 'confirmed')
      .gt('end_datetime', nowIso),
    supabase.from('bookings').select('bike_id, start_datetime, end_datetime')
      .eq('status', 'confirmed').not('bike_id', 'is', null)
      .gt('end_datetime', nowIso),
    supabase.from('rentals').select('bike_id, start_datetime, expected_end_datetime').in('status', ['active', 'extended']),
    supabase.from('monthly_rentals').select('bike_id').eq('status', 'active'),
  ])
  if (!modelBookings || modelBookings.length === 0) return null

  const candidateIds = new Set((candidates ?? []).map(b => b.id))
  const monthlyBusy = new Set((monthlies ?? []).map(m => m.bike_id))
  const nowMs = Date.now()
  const extraBusyStart = new Date(startIso).getTime()
  const extraBusyEnd = new Date(endIso).getTime()
  let applyExtraBusy = false

  function isBikeBusyInWindow(bikeId: string, bStartIso: string, bEndIso: string): boolean {
    if (monthlyBusy.has(bikeId)) return true
    const bStart = new Date(bStartIso).getTime() - BUFFER_MS
    const bEnd = new Date(bEndIso).getTime() + BUFFER_MS
    if (applyExtraBusy && bikeId === excludeBikeId && extraBusyStart < bEnd && extraBusyEnd > bStart) return true
    return (rentals ?? []).some(r => {
      if (r.bike_id !== bikeId) return false
      const overdue = new Date(r.expected_end_datetime).getTime() <= nowMs
      const overlaps = new Date(r.start_datetime).getTime() < bEnd && new Date(r.expected_end_datetime).getTime() > bStart
      return overdue || overlaps
    })
  }

  // จำลองจัดสรรตามลำดับความสำคัญเดียวกับคิวมีปัญหา (ใกล้วันรับก่อน แล้วตามลำดับจอง)
  function allocate(): Set<string> {
    const claimed = new Map<string, { start: number; end: number }[]>()
    for (const sc of specificBookings ?? []) {
      if (!candidateIds.has(sc.bike_id)) continue
      const arr = claimed.get(sc.bike_id) ?? []
      arr.push({ start: new Date(sc.start_datetime).getTime(), end: new Date(sc.end_datetime).getTime() })
      claimed.set(sc.bike_id, arr)
    }
    const priority = [...(modelBookings ?? [])].sort((a, b) =>
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

  applyExtraBusy = false
  const beforeSucceeded = allocate()
  applyExtraBusy = true
  const afterSucceeded = allocate()

  const brokenIds = Array.from(beforeSucceeded).filter(id => !afterSucceeded.has(id))
  if (brokenIds.length === 0) return null

  // เตือนคิวที่ใกล้ถึงกำหนดที่สุดก่อน (คิวใกล้ยังมีเวลาหาคันทดแทนน้อยกว่า) ถ้าวันเวลารับรถตรงกันเป๊ะ
  // ค่อยดูว่าใครจองไว้ก่อน (created_at)
  const broken = modelBookings.filter(b => brokenIds.includes(b.id))
  return [...broken].sort((a, b) =>
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
