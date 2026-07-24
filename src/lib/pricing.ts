// ── ตารางคิดเงินค่าเช่า — แหล่งเดียวของระบบ ใช้ทั้งหน้าส่งรถและหน้าจอง ──────
// โปรราย 7 วัน: ทุก 7 วันจ่าย 5 วัน (ฟรี 2 วัน)
// Cap รายเดือน: ส่วนรายวันถ้าคิดแล้วถึงเรทรายเดือน ให้คิดเรทรายเดือนแทน
// เช่ายาว (>= 30 วัน): แตกเป็นเดือนปฏิทิน (ขั้นต่ำ 30 วัน กันเดือน ก.พ.) + เศษวัน

export type MonthSegment = { label: string; days: number; price: number }
export type PriceResult = {
  months: MonthSegment[]
  remainDays: number
  remainPrice: number
  calcRemainDays: number
  total: number
}

const DAY_MS = 86_400_000

function calcDailySegment(days: number, ndr: number, mcr: number): { calcDays: number; price: number } {
  const calcDays = Math.floor(days / 7) * 5 + Math.min(days % 7, 5)
  return { calcDays, price: Math.min(calcDays * ndr, mcr) }
}

export function calcShortPrice(totalDays: number, ndr: number): { calcDays: number; total: number } {
  const calcDays = Math.floor(totalDays / 7) * 5 + Math.min(totalDays % 7, 5)
  return { calcDays, total: calcDays * ndr }
}

export function calcLongPrice(start: Date, end: Date, ndr: number, mcr: number): PriceResult | null {
  if (end <= start) return null

  let cursor = new Date(start)
  const months: MonthSegment[] = []
  let total = 0

  while (true) {
    const next = new Date(cursor)
    next.setMonth(next.getMonth() + 1)
    if (next >= end) break

    const rawDays = Math.round((next.getTime() - cursor.getTime()) / DAY_MS)
    const effectiveDays = Math.max(rawDays, 30) // Feb rule: min 30 days
    const label =
      cursor.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) +
      ' – ' +
      next.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })

    months.push({ label, days: effectiveDays, price: mcr })
    total += mcr

    cursor = effectiveDays > rawDays
      ? new Date(cursor.getTime() + effectiveDays * DAY_MS)
      : next
  }

  const remainDays = Math.round((end.getTime() - cursor.getTime()) / DAY_MS)
  let remainPrice = 0
  let calcRemainDays = 0

  if (remainDays > 0) {
    const seg = calcDailySegment(remainDays, ndr, mcr)
    calcRemainDays = seg.calcDays
    remainPrice = seg.price
    total += remainPrice
  }

  return { months, remainDays, remainPrice, calcRemainDays, total }
}

// นับจำนวนวันเช่าตามวันปฏิทิน (ไม่สนเวลารับ/คืน) — convention เดียวกับหน้าส่งรถ
// ที่บังคับเวลาเริ่ม-จบเท่ากัน เศษชั่วโมงไปคิดเป็นค่าล่วงเวลาตอนคืนแทน
export function calendarDays(start: Date, end: Date): number {
  const dateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.max(1, Math.round((dateOnly(end) - dateOnly(start)) / DAY_MS))
}

// ราคารวมจากวันเริ่ม + จำนวนวัน — ให้หน้าจองคิดราคาตรงกับหน้าส่งรถเป๊ะ
export function calcRentQuote(startDt: Date, totalDays: number, ndr: number, mcr: number): {
  isLong: boolean
  longResult: PriceResult | null
  shortResult: { calcDays: number; total: number } | null
  total: number
} {
  const isLong = totalDays >= 30
  const billingEnd = new Date(startDt.getTime() + totalDays * DAY_MS)
  const longResult = isLong ? calcLongPrice(startDt, billingEnd, ndr, mcr) : null
  const shortResult = !isLong ? calcShortPrice(totalDays, ndr) : null
  return { isLong, longResult, shortResult, total: isLong ? (longResult?.total ?? 0) : (shortResult?.total ?? 0) }
}
