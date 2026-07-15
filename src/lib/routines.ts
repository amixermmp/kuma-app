import { createAdminClient } from '@/lib/supabase/admin'

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
