export type SwapLogEntry = {
  date: string
  old_rate?: number
  new_rate?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

/**
 * หาอัตรารายเดือนที่ควรใช้จริงสำหรับรอบบิล (dueDateStr) — เผื่อเคยสลับรถกลางทางแล้วราคาเปลี่ยน
 * รอบที่กำหนดชำระ (due_date) เกิดขึ้น "ก่อน" วันที่สลับ ยังคงใช้ราคาเดิมตอนนั้น ไม่ให้ราคาใหม่
 * (ที่อาจแพงกว่าเพราะสลับฉุกเฉิน) มีผลย้อนหลังกับรอบที่ตกลงราคาไว้แล้ว — ราคาใหม่มีผลแค่รอบถัดไปที่
 * due_date อยู่หลังวันสลับเท่านั้น (ตามนโยบาย: สลับฉุกเฉินไม่เก็บเพิ่ม เก็บราคาใหม่ตอนต่อรอบจริง)
 */
export function getApplicableMonthlyRate(
  currentRate: number,
  swapLog: SwapLogEntry[] | null | undefined,
  dueDateStr: string,
): number {
  if (!Array.isArray(swapLog) || swapLog.length === 0) return currentRate

  // สลับที่มีข้อมูลราคาบันทึกไว้เท่านั้น (สลับเก่าก่อนมีฟีเจอร์นี้จะไม่มี old_rate/new_rate — ข้ามไป
  // ใช้ราคาปัจจุบันแทน เพราะไม่มีทางรู้ราคาย้อนหลังตอนนั้นแล้ว)
  const rateSwaps = swapLog.filter(e => e.date && e.old_rate != null && e.new_rate != null)
  if (rateSwaps.length === 0) return currentRate

  const sorted = [...rateSwaps].sort((a, b) => b.date.localeCompare(a.date))
  let rate = currentRate
  for (const entry of sorted) {
    if (dueDateStr < entry.date) {
      rate = entry.old_rate!
    } else {
      break
    }
  }
  return rate
}

/**
 * ราคารถ (override เองหรือราคามาตรฐาน) เปลี่ยน — sync ไปสัญญารายเดือนที่เช่าอยู่ตอนนี้ของรถคันนี้ทันที
 * (ถ้ามี) ไม่ต้องรอพนักงานยืนยัน เพราะราคาเป็นเรื่องที่โอนเนอร์ตัดสินใจอยู่แล้ว — บันทึก old_rate/new_rate
 * พร้อมวันที่ไว้ใน swap_log ชุดเดียวกับตอนสลับรถ กันไม่ให้งวดที่ครบกำหนดจ่ายไปแล้วโดนคิดราคาใหม่ย้อนหลัง
 * (ใช้ตรรกะเดียวกับ getApplicableMonthlyRate ด้านบน)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncMonthlyRentalRate(admin: any, bikeId: string, newRate: number): Promise<void> {
  const { data: rental } = await admin
    .from('monthly_rentals')
    .select('id, monthly_rate, swap_log')
    .eq('bike_id', bikeId)
    .eq('status', 'active')
    .maybeSingle()
  if (!rental) return
  if (Number(rental.monthly_rate) === Number(newRate)) return

  const logEntry: SwapLogEntry = {
    date: new Date().toISOString().split('T')[0],
    old_rate: rental.monthly_rate,
    new_rate: newRate,
    reason: 'ปรับตามราคารถ/ราคามาตรฐานล่าสุด',
  }
  const existingLog = Array.isArray(rental.swap_log) ? rental.swap_log : []
  await admin
    .from('monthly_rentals')
    .update({ monthly_rate: newRate, swap_log: [...existingLog, logEntry] })
    .eq('id', rental.id)
}
