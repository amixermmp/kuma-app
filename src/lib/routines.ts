import { createAdminClient } from '@/lib/supabase/admin'

export type RoutineUrgency = 'overdue' | 'warning' | 'ok'

// ใช้ร่วมกันทั้งหน้ารูทีนและแบนเนอร์เตือนตอนรับคืนรถ — เกณฑ์เดียวกันเป๊ะ
export function calcRoutineUrgency(
  r: { next_due_km: number | null; next_due_date: string | null },
  odometer: number
): { urgency: RoutineUrgency; due_reason: string } {
  const today = Date.now()

  // km-based check
  if (r.next_due_km != null) {
    const diff = odometer - r.next_due_km
    if (diff >= 0) return { urgency: 'overdue', due_reason: `ถึงกำหนดแล้ว! (${odometer.toLocaleString()} กม. / กำหนด ${r.next_due_km.toLocaleString()} กม.)` }
    if (diff >= -500) return { urgency: 'warning', due_reason: `อีก ${Math.abs(diff)} กม. จะถึงกำหนด` }
  }

  // date-based check
  if (r.next_due_date) {
    const days = Math.ceil((new Date(r.next_due_date).getTime() - today) / 86_400_000)
    if (days <= 0) return { urgency: 'overdue', due_reason: `ถึงกำหนดตามวันที่ (${new Date(r.next_due_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})` }
    if (days <= 14) return { urgency: 'warning', due_reason: `อีก ${days} วันจะถึงกำหนด` }
  }

  if (r.next_due_km == null && !r.next_due_date) {
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
