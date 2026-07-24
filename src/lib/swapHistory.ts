export type BikeSwapLogEntry = {
  date: string
  from_bike_id?: string
  to_bike_id?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

/**
 * หา bike_id ที่ผูกอยู่จริง ณ วันที่ dateStr (เช่นวันที่เก็บเงิน) — เผื่อสัญญานี้เคยสลับรถ
 * ใช้ตอนคิดรายได้แยกรายคัน กันเงินที่เก็บไปก่อนสลับถูกนับผิดไปอยู่กับคันใหม่ที่สลับทีหลัง
 * (currentBikeId = bike_id ปัจจุบันของสัญญา, ใช้เป็นค่าเริ่มต้นถ้าไม่เคยสลับหรือ dateStr อยู่หลังสลับล่าสุด)
 */
export function getBikeIdAtDate(
  currentBikeId: string,
  swapLog: BikeSwapLogEntry[] | null | undefined,
  dateStr: string,
): string {
  if (!Array.isArray(swapLog) || swapLog.length === 0) return currentBikeId

  const bikeSwaps = swapLog.filter(e => e.date && e.from_bike_id && e.to_bike_id)
  if (bikeSwaps.length === 0) return currentBikeId

  const sorted = [...bikeSwaps].sort((a, b) => b.date.localeCompare(a.date))
  let bikeId = currentBikeId
  for (const entry of sorted) {
    if (dateStr < entry.date) {
      bikeId = entry.from_bike_id!
    } else {
      break
    }
  }
  return bikeId
}
