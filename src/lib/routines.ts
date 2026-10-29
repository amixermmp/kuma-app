import { createAdminClient } from '@/lib/supabase/admin'
import { routineDueReasons } from '@/lib/routineStatus'
import { addDaysIso } from '@/lib/routineCycle'

export type RoutineUrgency = 'overdue' | 'warning' | 'ok'

// ใช้ร่วมกันทั้งหน้ารูทีนและแบนเนอร์เตือนตอนรับคืนรถ — เกณฑ์เดียวกันเป๊ะ
export function calcRoutineUrgency(
  r: {
    next_due_km: number | null; next_due_date: string | null
    interval_rented_days?: number | null; rented_days_accumulated?: number | null
  },
  odometer: number
): { urgency: RoutineUrgency; due_reason: string } {
  // ตรวจครบทั้ง กม. / วันเช่าสะสม / ปฏิทิน — เงื่อนไขไหนเกินก็ถือว่าเกินกำหนด (อันที่แค่ "ใกล้ถึง" ไม่บังอันที่เกินแล้ว)
  const { overdue, warning } = routineDueReasons(r, odometer)
  if (overdue.length > 0) return { urgency: 'overdue', due_reason: overdue.map(x => x.text).join(' • ') }
  if (warning.length > 0) return { urgency: 'warning', due_reason: warning.map(x => x.text).join(' • ') }

  if (r.next_due_km == null && !r.next_due_date && r.interval_rented_days == null) {
    return { urgency: 'ok', due_reason: 'ยังไม่ตั้งค่ากำหนด' }
  }
  return { urgency: 'ok', due_reason: 'ปกติ' }
}

// ═══ วันเช่าสะสม: นับจาก "เวลาที่รถอยู่กับลูกค้าจริง" เป็นนาที แล้วหาร 24 ชม. (1440 นาที) = 1 วัน ═══
// ต่อสัญญา/คืนช้า/ออกหลายรอบต่อวัน ไม่ต้องมีกฎพิเศษ — เวลาที่รถอยู่นอกร้านถูกรวมตามจริง เศษที่ยังไม่ครบ 24 ชม. เก็บใน rented_minutes_carry
const MIN_PER_DAY = 1440
const dayStartMs = (isoDate: string) => Date.parse(`${isoDate}T00:00:00+07:00`)
const bkkDateOf = (ms: number) => new Date(ms + 7 * 3600_000).toISOString().split('T')[0]

export type RentalSpan = { start: number; end: number }

// รวมนาทีที่รถอยู่กับลูกค้าในหน้าต่าง [from, to) — สัญญาที่ซ้อนกันนับครั้งเดียว
export function rentedMinutesInWindow(spans: RentalSpan[], from: number, to: number): number {
  const clipped = spans
    .map(s => ({ start: Math.max(s.start, from), end: Math.min(s.end, to) }))
    .filter(s => s.end > s.start)
    .sort((a, b) => a.start - b.start)
  let total = 0
  let curStart = 0
  let curEnd = 0
  for (const s of clipped) {
    if (curEnd === 0 || s.start > curEnd) {
      total += curEnd - curStart
      curStart = s.start
      curEnd = s.end
    } else if (s.end > curEnd) {
      curEnd = s.end
    }
  }
  total += curEnd - curStart
  return Math.round(total / 60000)
}

// รวมนาทีเข้ากับเศษเดิม แล้วแตกเป็น วันเต็ม + เศษ
export function splitRentedMinutes(carryMinutes: number, addMinutes: number): { days: number; carry: number } {
  const total = carryMinutes + addMinutes
  const days = Math.floor(total / MIN_PER_DAY)
  return { days, carry: total - days * MIN_PER_DAY }
}

// ช่วงเวลาที่แต่ละคันอยู่กับลูกค้า (รายวัน + รายเดือน) ที่ทับกับหน้าต่าง [fromMs, toMs)
async function fetchRentalSpans(
  supabase: ReturnType<typeof createAdminClient>,
  bikeIds: string[],
  fromMs: number,
  toMs: number
): Promise<Map<string, RentalSpan[]>> {
  const byBike = new Map<string, RentalSpan[]>()
  const push = (bikeId: string, span: RentalSpan) => {
    const list = byBike.get(bikeId)
    if (list) list.push(span)
    else byBike.set(bikeId, [span])
  }
  if (bikeIds.length === 0 || toMs <= fromMs) return byBike

  const [{ data: rentals }, { data: monthlies }] = await Promise.all([
    supabase.from('rentals')
      .select('bike_id, start_datetime, expected_end_datetime, actual_end_datetime, status')
      .in('bike_id', bikeIds)
      .in('status', ['active', 'extended', 'overdue', 'returned'])
      .lt('start_datetime', new Date(toMs).toISOString())
      .or(`actual_end_datetime.is.null,actual_end_datetime.gt.${new Date(fromMs).toISOString()}`),
    supabase.from('monthly_rentals')
      .select('bike_id, start_date, end_date')
      .in('bike_id', bikeIds)
      .in('status', ['active', 'ended'])
      .lte('start_date', bkkDateOf(toMs - 1))
      .or(`end_date.is.null,end_date.gte.${bkkDateOf(fromMs)}`),
  ])

  for (const r of rentals ?? []) {
    // ยังไม่คืน = อยู่กับลูกค้าต่อเนื่องไม่ว่าเลยกำหนดหรือต่อสัญญาภายหลัง; คืนแล้วแต่ไม่มีเวลาคืนจริง ใช้เวลากำหนดคืน
    const end = r.actual_end_datetime
      ? Date.parse(r.actual_end_datetime)
      : r.status === 'returned' ? Date.parse(r.expected_end_datetime) : Infinity
    push(r.bike_id, { start: Date.parse(r.start_datetime), end })
  }
  for (const m of monthlies ?? []) {
    push(m.bike_id, {
      start: dayStartMs(m.start_date),
      end: m.end_date ? dayStartMs(addDaysIso(m.end_date, 1)) : Infinity,
    })
  }
  return byBike
}

// นับวันเช่าสะสมใหม่ตั้งแต่ "วันถัดจากวันที่ทำรูทีนล่าสุด" ถึงเที่ยงคืนต้นวันนี้ (เวลาไทย) — ใช้ตอนเจ้าของลงวันที่ย้อนหลัง
// ไม่นับวันที่ทำรูทีนเอง (ลูกค้าเปลี่ยนระหว่างวัน) วันนี้ให้ cron รอบถัดไปนับต่อ → countedThrough = วันสุดท้ายที่นับรวมแล้ว
export async function recountRentedSince(
  supabase: ReturnType<typeof createAdminClient>,
  bikeId: string,
  sinceDate: string,
  todayBkk: string
): Promise<{ days: number; carryMinutes: number; countedThrough: string }> {
  const yesterday = addDaysIso(todayBkk, -1)
  const countedThrough = sinceDate > yesterday ? sinceDate : yesterday
  const from = dayStartMs(addDaysIso(sinceDate, 1))
  const to = dayStartMs(addDaysIso(countedThrough, 1))
  const spans = (await fetchRentalSpans(supabase, [bikeId], from, to)).get(bikeId) ?? []
  const { days, carry } = splitRentedMinutes(0, rentedMinutesInWindow(spans, from, to))
  return { days, carryMinutes: carry, countedThrough }
}

// cron รายวัน: นับเวลาที่รถอยู่กับลูกค้าของ "วันเต็มที่ผ่านไปแล้ว" (ถึงสิ้นเมื่อวาน) เข้าตัวนับของทุกรูทีนที่เปิดนับวันเช่า
// วันไหน cron พลาด รอบถัดไปนับย้อนช่วงที่ขาดให้เอง; rented_days_last_ticked_date = วันสุดท้ายที่นับรวมแล้ว
// onlyBikeIds = จำกัดเฉพาะรถที่ระบุ (ใช้ตอนทดสอบกับข้อมูลทดลอง ไม่ให้แตะรถจริง)
export async function tickRentedDays(
  supabase: ReturnType<typeof createAdminClient>,
  todayBkk: string,
  onlyBikeIds?: string[]
): Promise<number> {
  const through = addDaysIso(todayBkk, -1)
  let query = supabase
    .from('bike_routines')
    .select('id, bike_id, last_done_date, rented_days_accumulated, rented_minutes_carry, rented_days_last_ticked_date')
    .not('interval_rented_days', 'is', null)
    .or(`rented_days_last_ticked_date.is.null,rented_days_last_ticked_date.lt.${through}`)
  if (onlyBikeIds) query = query.in('bike_id', onlyBikeIds)
  const { data: pending, error } = await query
  if (error) {
    console.error('[tickRentedDays] load failed:', JSON.stringify(error))
    return 0
  }
  if (!pending || pending.length === 0) return 0

  // รูทีนที่ยังไม่เคยมีวันที่นับล่าสุด เริ่มนับจากวันถัดจากวันที่ทำรูทีน (ไม่มีวันที่ทำ = นับแค่เมื่อวาน)
  const startOf = (r: { last_done_date: string | null; rented_days_last_ticked_date: string | null }) =>
    dayStartMs(addDaysIso(r.rented_days_last_ticked_date ?? r.last_done_date ?? addDaysIso(through, -1), 1))
  const to = dayStartMs(todayBkk)
  const from = Math.min(...pending.map(startOf))
  const spansByBike = await fetchRentalSpans(supabase, Array.from(new Set(pending.map(r => r.bike_id))), from, to)

  let updated = 0
  for (const r of pending) {
    const start = startOf(r)
    const added = rentedMinutesInWindow(spansByBike.get(r.bike_id) ?? [], start, to)
    const { days, carry } = splitRentedMinutes(r.rented_minutes_carry ?? 0, added)
    const { error: tickErr } = await supabase
      .from('bike_routines')
      .update({
        rented_days_last_ticked_date: through,
        rented_minutes_carry: carry,
        ...(days > 0 ? { rented_days_accumulated: (r.rented_days_accumulated ?? 0) + days } : {}),
      })
      .eq('id', r.id)
    if (tickErr) console.error('[tickRentedDays] update failed:', r.id, JSON.stringify(tickErr))
    else updated++
  }
  return updated
}

// รูทีนที่ไม่เคยทำ (last_done_km = null) ถูก seed ด้วย next_due_km = interval ดิบๆ
// ตั้งแต่ตอนที่ยังไม่รู้เลขไมล์รถ พอเลขไมล์จริงถูกบันทึกทีหลังจะแจ้งเตือน "ครบกำหนด" ผิดทันที
// → ทุกจุดที่เขียน bikes.odometer ต้องเรียกตัวนี้ เพื่อเลื่อนเป้าเป็น ไมล์ปัจจุบัน + interval
export async function recalcNeverDoneRoutines(
  supabase: ReturnType<typeof createAdminClient>,
  bikeId: string,
  odometer: number
) {
  if (!bikeId || !odometer || odometer <= 0) return

  const { data: routines } = await supabase
    .from('bike_routines')
    .select('id, interval_km, next_due_km')
    .eq('bike_id', bikeId)
    .is('last_done_km', null)

  for (const r of routines ?? []) {
    if (r.interval_km && r.next_due_km != null && odometer >= r.next_due_km) {
      await supabase
        .from('bike_routines')
        .update({ next_due_km: odometer + r.interval_km })
        .eq('id', r.id)
    }
  }
}
