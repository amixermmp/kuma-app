import { createAdminClient } from '@/lib/supabase/admin'
import { routineDueReasons } from '@/lib/routineStatus'

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
