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

function calcDailySegment(days: number, ndr: number, mcr: number, payDays = 5): { calcDays: number; price: number } {
  const calcDays = Math.floor(days / 7) * payDays + Math.min(days % 7, payDays)
  return { calcDays, price: Math.min(calcDays * ndr, mcr) }
}

export function calcShortPrice(totalDays: number, ndr: number, mcr: number, payDays = 5): { calcDays: number; total: number } {
  const calcDays = Math.floor(totalDays / 7) * payDays + Math.min(totalDays % 7, payDays)
  return { calcDays, total: Math.min(calcDays * ndr, mcr) }
}

export function calcLongPrice(start: Date, end: Date, ndr: number, mcr: number, payDays = 5): PriceResult | null {
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
    const seg = calcDailySegment(remainDays, ndr, mcr, payDays)
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
// payDays = จำนวนวันที่จ่ายต่อรอบ 7 วัน (ค่ากลาง 5 = ฟรี 2 วัน) — ตั้งได้ต่อรุ่นผ่าน bike_models.promo_pay_days
export function calcRentQuote(startDt: Date, totalDays: number, ndr: number, mcr: number, payDays = 5): {
  isLong: boolean
  longResult: PriceResult | null
  shortResult: { calcDays: number; total: number } | null
  total: number
} {
  const isLong = totalDays >= 30
  const billingEnd = new Date(startDt.getTime() + totalDays * DAY_MS)
  const longResult = isLong ? calcLongPrice(startDt, billingEnd, ndr, mcr, payDays) : null
  const shortResult = !isLong ? calcShortPrice(totalDays, ndr, mcr, payDays) : null
  return { isLong, longResult, shortResult, total: isLong ? (longResult?.total ?? 0) : (shortResult?.total ?? 0) }
}

// ── ค่าล่วงเวลา — ใช้ทั้งตอนคืนรถจริง (เทียบเวลาจริงกับกำหนดคืน) และตอนพรีวิวราคาตอนค้นหา/จอง
// (เทียบเวลาที่เลือกกับ "ขอบเขตวันเต็ม" ที่ calendarDays คิดให้ไปแล้ว จะได้เห็นราคารวมจริงก่อนตัดสินใจ) ──
export const OVERTIME_HOURLY_RATE = 50
const OVERTIME_GRACE_MIN = 30
const OVERTIME_DAY_THRESHOLD_HOURS = 5

// จำนวนชั่วโมงที่ต้องคิดค่าล่วงเวลา จาก ms ที่เกินมา — ฟรี 30 นาทีแรก จากนั้นปัดขึ้นเป็นชั่วโมงถ้าเกิน 30 นาทีในชั่วโมงนั้น
export function calcLateHours(lateMs: number): number {
  if (lateMs <= 0) return 0
  const lateMinutes = lateMs / 60_000
  if (lateMinutes <= OVERTIME_GRACE_MIN) return 0
  const lateWholeHours = Math.floor(lateMs / 3_600_000)
  const lateRemainMs = lateMs % 3_600_000
  return lateWholeHours + (lateRemainMs > OVERTIME_GRACE_MIN * 60_000 ? 1 : 0)
}

// ค่าล่วงเวลาจากจำนวนชั่วโมง — คิดรายชั่วโมงจนถึง 5 ชม. แล้วสลับเป็นคิดเต็มวันแทน (ไม่มีทางเกินราคา 1 วัน/24 ชม.)
export function calcOvertimeCharge(lateHours: number, dailyRate: number): number {
  if (lateHours <= 0) return 0
  return lateHours >= OVERTIME_DAY_THRESHOLD_HOURS
    ? Math.ceil(lateHours / 24) * dailyRate
    : lateHours * OVERTIME_HOURLY_RATE
}

// ชั่วโมงที่เกินจาก "ขอบเขตวันเต็ม" ที่ calendarDays นับให้ — ใช้พรีวิวค่าล่วงเวลาที่จะเกิดขึ้นจริงตอนคืน
// ถ้าเลือกเวลาคืนตรงกับเวลาที่รับ (คูณ 24 ชม.พอดี) จะไม่มีส่วนเกิน
export function calcExcessHours(startDt: Date, endDt: Date, days: number): number {
  const boundaryMs = startDt.getTime() + days * DAY_MS
  return calcLateHours(Math.max(0, endDt.getTime() - boundaryMs))
}
