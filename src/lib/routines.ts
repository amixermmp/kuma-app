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

// นับ "วันเช่า" ของรถหลังวันที่ทำรูทีนล่าสุดจนถึงวันนี้ (เวลาไทย) — ใช้ตอนเจ้าของลงวันที่ย้อนหลัง
// กติกาเดียวกับ cron ที่เดินทีละวัน: วันไหนมีสัญญาเช่าค้างอยู่ (รายวันหรือรายเดือน) นับ 1 วัน ไม่ว่ากี่สัญญา
// ไม่นับวันที่ทำรูทีนเอง (ลูกค้าเปลี่ยนระหว่างวัน) เริ่มนับจากวันถัดไป
export async function countRentedDaysSince(
  supabase: ReturnType<typeof createAdminClient>,
  bikeId: string,
  sinceDate: string,
  todayBkk: string
): Promise<number> {
  const firstDay = addDaysIso(sinceDate, 1)
  if (firstDay > todayBkk) return 0
  const bkkDate = (iso: string) => new Date(Date.parse(iso) + 7 * 3600_000).toISOString().split('T')[0]

  const [{ data: rentals }, { data: monthlies }] = await Promise.all([
    supabase.from('rentals')
      .select('start_datetime, expected_end_datetime, actual_end_datetime, status')
      .eq('bike_id', bikeId)
      .in('status', ['active', 'extended', 'overdue', 'returned'])
      .lte('start_datetime', `${todayBkk}T23:59:59+07:00`)
      .or(`actual_end_datetime.is.null,actual_end_datetime.gte.${firstDay}T00:00:00+07:00`),
    supabase.from('monthly_rentals')
      .select('start_date, end_date')
      .eq('bike_id', bikeId)
      .in('status', ['active', 'ended'])
      .lte('start_date', todayBkk)
      .or(`end_date.is.null,end_date.gte.${firstDay}`),
  ])

  const ranges: { from: string; to: string }[] = []
  for (const r of rentals ?? []) {
    const stillOut = r.status !== 'returned'
    const end = r.actual_end_datetime ?? (stillOut ? null : r.expected_end_datetime)
    ranges.push({ from: bkkDate(r.start_datetime), to: end ? bkkDate(end) : todayBkk })
  }
  for (const m of monthlies ?? []) ranges.push({ from: m.start_date, to: m.end_date ?? todayBkk })

  const days = new Set<string>()
  for (const { from, to } of ranges) {
    let d = from < firstDay ? firstDay : from
    const last = to > todayBkk ? todayBkk : to
    while (d <= last) {
      days.add(d)
      d = addDaysIso(d, 1)
    }
  }
  return days.size
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
