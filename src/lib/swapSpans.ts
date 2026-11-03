// แตกช่วงเวลาของ 1 สัญญา เป็นช่วงต่อคัน ตามประวัติสลับคัน (swap_log) — ใช้นับ "วันเช่าสะสม" ให้แต่ละคันได้เฉพาะช่วงที่ลูกค้าถือคันนั้นจริง
// เดิมนับทั้งสัญญาให้ bike_id ปัจจุบัน ทำให้คันใหม่ได้วันก่อนสลับที่ไม่ใช่ของมัน ส่วนคันเก่าเสียวันที่ลูกค้าใช้จริง
// swap_log บันทึกแค่วันที่ (ไม่มีเวลา) → ใช้เที่ยงวันของวันที่สลับเป็นจุดแบ่ง (ผิดได้ไม่เกินครึ่งวันต่อครั้ง)
// รายการที่ไม่มี from_bike_id/to_bike_id (เช่น ปรับราคาตามคันล่าสุด) ไม่นับเป็นการสลับคัน
export type BikeSpan = { bikeId: string; start: number; end: number }

type SwapEntry = { date?: string; from_bike_id?: string; to_bike_id?: string }

const dayStartMs = (isoDate: string) => Date.parse(`${isoDate}T00:00:00+07:00`)

export function splitSpanBySwaps(
  currentBikeId: string,
  start: number,
  end: number,
  swapLog: unknown,
): BikeSpan[] {
  const swaps = (Array.isArray(swapLog) ? (swapLog as SwapEntry[]) : [])
    .filter(e => e && e.from_bike_id && e.to_bike_id && typeof e.date === 'string' && e.date.length >= 10)
    .map(e => ({ at: dayStartMs(e.date!.slice(0, 10)) + 12 * 3600_000, from: e.from_bike_id!, to: e.to_bike_id! }))
    .filter(e => Number.isFinite(e.at))
    .sort((a, b) => a.at - b.at)
  if (swaps.length === 0) return [{ bikeId: currentBikeId, start, end }]

  const out: BikeSpan[] = []
  let bikeId = swaps[0].from
  let from = start
  for (const s of swaps) {
    out.push({ bikeId, start: from, end: Math.max(from, Math.min(end, s.at)) })
    from = Math.max(from, s.at)
    bikeId = s.to
  }
  out.push({ bikeId, start: from, end })
  return out.filter(x => x.end > x.start)
}
