// ใบสรุปตอนจบสัญญารายเดือน — ตัวคิดเงินตัวเดียว ใช้ทั้งหน้าจอ (แสดงสด) และ API (คิดซ้ำฝั่งเซิร์ฟเวอร์ ไม่เชื่อตัวเลขจากหน้าเว็บ)
// ไม่ import อะไรที่ผูกกับเซิร์ฟเวอร์ เพื่อให้ client component เรียกใช้ได้ (ตัวดึงข้อมูลอยู่ที่ monthlySettlementServer.ts)
//
// กติกา (ตกลงกับเจ้าของแล้ว):
//  - due_date ของ monthly_payments = "วันแรกของเดือนที่จ่าย" (สัญญาส่วนใหญ่: แถวจ่ายแรก due_date = วันเริ่มสัญญา)
//    ยกเว้นสัญญาที่ตั้งวันครบดีลไม่ตรงวันเริ่ม แถวจ่ายแรกจะ due_date = "วันสุดท้ายของเดือนที่จ่าย" → ดูจากแถวจ่ายแรกว่าตรงวันเริ่มไหม
//  - คืนก่อนวันครบดีล: คิดค่าใช้ตามสูตรเช่าใหม่ (7 วันจ่าย 5 + เศษรายวัน) นับวันปฏิทิน ไม่เกินราคาเดือนของสัญญา เทียบกับที่จ่ายมา
//  - คืนวันครบดีลหรือหลังจากนั้น: ค่าใช้ = ราคาเดือนของสัญญา (ไม่คืนส่วนเกิน เก็บเฉพาะส่วนที่ยังขาด เช่นผ่อนครึ่งค้าง)
//  - วันเกินกำหนด: พนักงานกรอกเอง × เรทรายวันเต็มของคันปัจจุบัน (ไม่มีโปร ไม่มีเพดาน)
//  - สลับคันในเดือนนั้น: ราคาเพดาน = old_rate, เรทรายวันที่ใช้คิด = ของคันที่ขี่ตอนเริ่มเดือน
import { calcShortPrice } from '@/lib/pricing'

const DAY_MS = 86_400_000

export type SwapEntry = {
  date?: string
  old_rate?: number | null
  new_rate?: number | null
  from_bike_id?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export type PaymentRow = { due_date: string; amount: number | string }

// "วันนี้" ตามเวลาไทย (YYYY-MM-DD) — ห้ามใช้ toISOString().split('T')[0] ตรงๆ (เป็น UTC เพี้ยนช่วง 00:00-07:00 น.)
export function bangkokDateStr(ms: number = Date.now()): string {
  return new Date(ms + 7 * 3_600_000).toISOString().slice(0, 10)
}

const toMs = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number)
  return Date.UTC(y, m - 1, dd)
}

export function diffDays(from: string, to: string): number {
  return Math.round((toMs(to) - toMs(from)) / DAY_MS)
}

// เลื่อนเดือนโดยยึดวัน anchorDay (เดือนสั้นถอยมาวันสุดท้ายของเดือน) — ตรงกับวิธีสร้างวันครบกำหนดของหน้าเก็บเงิน
export function addMonthsAnchored(dateStr: string, months: number, anchorDay: number): string {
  const [y, m] = dateStr.split('-').map(Number)
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = total % 12
  const dim = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  return new Date(Date.UTC(ny, nm, Math.min(anchorDay, dim))).toISOString().slice(0, 10)
}

export type Period = { label: string; start: string; end: string; paid: number }

export function buildPeriods(
  startDate: string,
  paymentDay: number | null | undefined,
  payments: PaymentRow[],
  firstPeriodExtra = 0,
  clampFirstStart = false,
): { periods: Period[]; labelIsStart: boolean } {
  const anchor = paymentDay || Number(startDate.slice(8, 10))
  const byLabel = new Map<string, number>()
  for (const p of payments) byLabel.set(p.due_date, (byLabel.get(p.due_date) ?? 0) + Number(p.amount))
  const labels = Array.from(byLabel.keys()).sort()
  if (labels.length === 0) return { periods: [], labelIsStart: true }

  const labelIsStart = labels[0] === startDate
  const periods = labels.map((label, i) => {
    let start = labelIsStart ? label : addMonthsAnchored(label, -1, anchor)
    // เดือนแรกของสัญญาที่สร้างตรงๆ (ไม่ได้แปลงจากรายวัน) ลูกค้าเพิ่งรับรถวันเริ่มสัญญา ไม่ใช่ต้นรอบที่คำนวณย้อนจากวันครบดีล
    if (i === 0 && !labelIsStart && clampFirstStart && start < startDate) start = startDate
    return {
      label,
      start,
      end: labelIsStart ? addMonthsAnchored(label, 1, anchor) : label,
      // แถวจ่ายแรกของสัญญารวมค่าส่งรถนอกสถานที่ไว้ด้วย (ไม่ใช่ค่าเช่า) — หักออกก่อนเทียบ กันเอาไปคืนเป็นค่าเช่า
      paid: Math.max(0, (byLabel.get(label) ?? 0) - (i === 0 ? firstPeriodExtra : 0)),
    }
  })
  return { periods, labelIsStart }
}

export type SettlementInput = {
  startDate: string
  paymentDay: number | null
  today: string
  payments: PaymentRow[]
  currentMonthlyRate: number
  swapLog: SwapEntry[] | null
  firstPeriodExtra: number          // ค่าส่งรถนอกสถานที่ที่รวมอยู่ในแถวจ่ายแรก
  clampFirstStart: boolean          // สัญญาสร้างตรงๆ (ไม่ได้แปลงจากรายวัน) → เดือนแรกนับจากวันเริ่มสัญญาจริง
  formulaDailyRate: number         // เรทรายวันของคันที่ขี่ตอนเริ่มเดือน (ใช้คิดค่าใช้ตอนคืนก่อนครบ)
  formulaPromoPayDays: number
  currentDailyRate: number          // เรทรายวันคันปัจจุบัน (ใช้คิดวันเกินกำหนด)
}

export type Settlement = {
  hasPeriod: boolean
  periodStart: string | null
  periodEnd: string | null
  daysUsed: number
  reachedEnd: boolean               // ถึง/เลยวันครบดีลแล้ว = ใช้เต็มเดือน
  overdueDays: number               // เลยวันครบดีลมากี่วัน (แสดงเป็นคำแนะนำ พนักงานกรอกเองว่าจะคิดกี่วัน)
  contractRate: number              // ราคาเดือนของสัญญาในงวดนี้ (เพดาน)
  usedSwapRate: boolean
  paidCurrent: number               // ค่าเช่าที่จ่ายแล้วของงวดนี้ (ไม่เกินราคาสัญญา ไม่รวมค่าส่งรถ)
  futurePaid: number                // จ่ายล่วงหน้าเดือนที่ยังไม่เริ่ม (คืนเต็ม)
  charge: number                    // ค่าใช้จริงของงวดนี้
  rentAdjustment: number            // + เก็บเพิ่ม / − คืนลูกค้า
  formulaDailyRate: number
  currentDailyRate: number
  dailyRateMissing: boolean
}

export function computeSettlement(input: SettlementInput): Settlement {
  const { periods } = buildPeriods(input.startDate, input.paymentDay, input.payments, input.firstPeriodExtra, input.clampFirstStart)
  const base = {
    formulaDailyRate: input.formulaDailyRate,
    currentDailyRate: input.currentDailyRate,
    dailyRateMissing: false,
  }
  if (periods.length === 0) {
    return {
      ...base, hasPeriod: false, periodStart: null, periodEnd: null, daysUsed: 0, reachedEnd: false, overdueDays: 0,
      contractRate: input.currentMonthlyRate, usedSwapRate: false, paidCurrent: 0, futurePaid: 0, charge: 0, rentAdjustment: 0,
    }
  }

  const started = periods.filter(p => p.start <= input.today)
  const future = periods.filter(p => p.start > input.today)
  const futurePaid = future.reduce((s, p) => s + p.paid, 0)
  // งวดปัจจุบัน = งวดล่าสุดที่เริ่มแล้ว (ไม่มีเลย = ยังไม่ได้ใช้รถสักวัน คืนเต็มทั้งหมด)
  const current = started.length > 0 ? started[started.length - 1] : null
  if (!current) {
    return {
      ...base, hasPeriod: true, periodStart: null, periodEnd: null, daysUsed: 0, reachedEnd: false, overdueDays: 0,
      contractRate: input.currentMonthlyRate, usedSwapRate: false, paidCurrent: 0, futurePaid, charge: 0, rentAdjustment: -futurePaid,
    }
  }

  // ราคาเดือนของสัญญาในงวดนี้: ถ้าเคยสลับคัน/ปรับราคาตั้งแต่ต้นงวดนี้เป็นต้นมา ใช้ราคาก่อนสลับครั้งแรกในงวดนี้
  const rateSwaps = (input.swapLog ?? [])
    .filter(e => e && e.date && e.date >= current.start && e.old_rate != null && e.new_rate != null)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const usedSwapRate = rateSwaps.length > 0
  const contractRate = Math.round(usedSwapRate ? Number(rateSwaps[0].old_rate) : input.currentMonthlyRate)

  const paidCurrent = Math.min(current.paid, contractRate)
  const reachedEnd = input.today >= current.end
  const overdueDays = Math.max(0, diffDays(current.end, input.today))
  const daysUsed = Math.max(1, diffDays(current.start, input.today))
  const dailyRateMissing = !(input.formulaDailyRate > 0)

  let charge: number
  if (reachedEnd) {
    charge = contractRate
  } else if (dailyRateMissing) {
    // ไม่รู้เรทรายวัน คิดไม่ได้ — ไม่คืนอะไรเลย ดีกว่าคืนเต็มจำนวนผิดๆ
    charge = paidCurrent
  } else {
    charge = calcShortPrice(daysUsed, input.formulaDailyRate, contractRate, input.formulaPromoPayDays).total
  }
  charge = Math.round(charge)

  let rentAdjustment = charge - paidCurrent - futurePaid
  // ใช้ครบเดือนแล้ว: เก็บเฉพาะส่วนที่ยังขาด ไม่คืนส่วนที่จ่ายเกิน
  if (reachedEnd) rentAdjustment = Math.max(0, charge - paidCurrent) - futurePaid

  return {
    ...base, dailyRateMissing,
    hasPeriod: true, periodStart: current.start, periodEnd: current.end, daysUsed, reachedEnd, overdueDays,
    contractRate, usedSwapRate, paidCurrent, futurePaid, charge, rentAdjustment: Math.round(rentAdjustment),
  }
}

export type SettlementInputs = { overdueDays: number; damage: number; fuel: number }

// กรองเลขที่พนักงานกรอก: จำนวนเต็ม ไม่ติดลบ ไม่เกินเพดานกันพิมพ์พลาด
export function cleanAmount(v: unknown, max = 1_000_000): number {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0
}

export function computeNet(s: Settlement, depositCash: number, raw: { overdueDays?: unknown; damage?: unknown; fuel?: unknown }) {
  const inputs: SettlementInputs = {
    overdueDays: cleanAmount(raw.overdueDays, 365),
    damage: cleanAmount(raw.damage),
    fuel: cleanAmount(raw.fuel),
  }
  const overdueCharge = inputs.overdueDays * Math.round(s.currentDailyRate)
  // + = คืนลูกค้า / − = ต้องเก็บเพิ่มจากลูกค้า
  const netToCustomer = Math.round(depositCash - s.rentAdjustment - overdueCharge - inputs.damage - inputs.fuel)
  return { ...inputs, overdueCharge, netToCustomer }
}
