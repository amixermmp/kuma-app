// ตารางเวรพนักงานพาร์ทไทม์: ตัวคำนวณล้วน (ไม่ผูกกับเซิร์ฟเวอร์/ฐานข้อมูล ใช้ได้ทั้งหน้าเว็บและ API)
// วันที่ทุกตัวเป็นข้อความ YYYY-MM-DD (วันตามปฏิทินไทย) — weekdays: 0=อาทิตย์ ... 6=เสาร์
export type DayType = 'weekday' | 'weekend'

export type SchedulePattern = {
  id: string
  staffId: string
  weekdays: number[]
  startDate: string
  endDate: string
}

export type ScheduleCounts = { weekdayMin: number; weekdayTarget: number; weekendMin: number; weekendTarget: number }

export const DEFAULT_COUNTS: ScheduleCounts = { weekdayMin: 2, weekdayTarget: 2, weekendMin: 2, weekendTarget: 3 }

export const SCHEDULE_DAYS = 60

const H7 = 7 * 3_600_000
export const bkkDateStr = (ms: number = Date.now()) => new Date(ms + H7).toISOString().slice(0, 10)

export const addDays = (dateStr: string, n: number) =>
  new Date(Date.parse(`${dateStr}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

export const weekdayOf = (dateStr: string) => new Date(`${dateStr}T00:00:00Z`).getUTCDay()

export const isDateStr = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))

// จันทร์-ศุกร์ = วันธรรมดา (ขาดไม่ได้) เสาร์-อาทิตย์ = วันหยุด (เหลือ 2 ได้) — เจ้าของกำหนดทับเป็นรายวันได้ (วันหยุดพิเศษ)
export function dayTypeFor(dateStr: string, overrides: Record<string, DayType> = {}): DayType {
  const o = overrides[dateStr]
  if (o) return o
  const w = weekdayOf(dateStr)
  return w === 0 || w === 6 ? 'weekend' : 'weekday'
}

// ใครมีเวรวันนั้นตามแบบแผน (คนเดียวกันซ้ำนับครั้งเดียว)
export function staffOnDate(patterns: SchedulePattern[], dateStr: string): string[] {
  const w = weekdayOf(dateStr)
  const out = new Set<string>()
  for (const p of patterns) {
    if (dateStr >= p.startDate && dateStr <= p.endDate && p.weekdays.includes(w)) out.add(p.staffId)
  }
  return Array.from(out)
}

export type DayStatus = 'short' | 'low' | 'ok'   // short = ต่ำกว่าขั้นต่ำ (แดง) / low = ต่ำกว่าเป้า (เหลือง) / ok

export function dayStatus(count: number, type: DayType, c: ScheduleCounts): DayStatus {
  const min = type === 'weekend' ? c.weekendMin : c.weekdayMin
  const target = type === 'weekend' ? c.weekendTarget : c.weekdayTarget
  if (count < min) return 'short'
  if (count < target) return 'low'
  return 'ok'
}

export type ScheduleDay = {
  date: string
  weekday: number
  type: DayType
  overridden: boolean
  staffIds: string[]
  count: number
  min: number
  target: number
  status: DayStatus
}

export function buildScheduleDays(
  fromDate: string,
  days: number,
  patterns: SchedulePattern[],
  overrides: Record<string, DayType>,
  counts: ScheduleCounts,
): ScheduleDay[] {
  const out: ScheduleDay[] = []
  for (let i = 0; i < days; i++) {
    const date = addDays(fromDate, i)
    const type = dayTypeFor(date, overrides)
    const staffIds = staffOnDate(patterns, date)
    out.push({
      date, weekday: weekdayOf(date), type, overridden: overrides[date] != null,
      staffIds, count: staffIds.length,
      min: type === 'weekend' ? counts.weekendMin : counts.weekdayMin,
      target: type === 'weekend' ? counts.weekendTarget : counts.weekdayTarget,
      status: dayStatus(staffIds.length, type, counts),
    })
  }
  return out
}

// เช็คแบบแผนใหม่/ที่แก้ ก่อนบันทึก — คืนข้อความผิดพลาด (ไทย) หรือ null ถ้าถูกต้อง
// กติกา: 1 คนมีแบบแผนได้ทีละ 1 ช่วง (เทอมใหม่ = ช่วงวันใหม่ ห้ามช่วงวันทับกัน กันความกำกวม)
export function validatePattern(
  p: { weekdays: unknown; startDate: unknown; endDate: unknown },
  existingOfSameStaff: { id: string; startDate: string; endDate: string }[],
  selfId?: string,
): string | null {
  if (!Array.isArray(p.weekdays) || p.weekdays.length === 0) return 'กรุณาเลือกวันทำงานอย่างน้อย 1 วันต่อสัปดาห์'
  if (!p.weekdays.every(n => Number.isInteger(n) && n >= 0 && n <= 6)) return 'วันทำงานไม่ถูกต้อง'
  if (!isDateStr(p.startDate) || !isDateStr(p.endDate)) return 'กรุณาใส่วันเริ่ม-วันสิ้นสุดให้ครบ'
  const startDate = p.startDate, endDate = p.endDate
  if (endDate < startDate) return 'วันสิ้นสุดต้องไม่ก่อนวันเริ่ม'
  if (addDays(startDate, 400) < endDate) return 'ช่วงวันยาวเกินไป (เกิน 400 วัน) — ตรวจวันที่อีกครั้ง'
  const clash = existingOfSameStaff.find(e => e.id !== selfId && !(endDate < e.startDate || startDate > e.endDate))
  if (clash) return `ช่วงวันนี้ทับกับแบบแผนเดิมของคนนี้ (${clash.startDate} ถึง ${clash.endDate}) — แก้หรือลบอันเดิมก่อน`
  return null
}

export const WEEKDAY_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
