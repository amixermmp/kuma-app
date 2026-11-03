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

// เวรเพิ่มรายวัน: พนักงานกดลงเวรว่างเอง หรือเจ้าของเพิ่มให้ (นอกเหนือจากแบบแผนรายสัปดาห์)
export type ExtraShift = { staffId: string; day: string }

// ใครมีเวรวันนั้นตามแบบแผน (คนเดียวกันซ้ำนับครั้งเดียว)
export function patternStaffOnDate(patterns: SchedulePattern[], dateStr: string): string[] {
  const w = weekdayOf(dateStr)
  const out = new Set<string>()
  for (const p of patterns) {
    if (dateStr >= p.startDate && dateStr <= p.endDate && p.weekdays.includes(w)) out.add(p.staffId)
  }
  return Array.from(out)
}

// การลาที่อนุมัติแล้ว: คนนั้นถูกตัดออกจากวันนั้น (ที่ว่างเปิดให้คนอื่นกดลง) — คำขอที่ยังรออนุมัติยังนับว่ามาทำงานตามปกติ
export type LeaveMark = { staffId: string; day: string }

// ใครมีเวรวันนั้น = (ตามแบบแผน + เวรเพิ่มรายวัน) − คนที่ลาอนุมัติแล้ว (คนเดียวกันซ้ำนับครั้งเดียว)
export function staffOnDate(patterns: SchedulePattern[], dateStr: string, extras: ExtraShift[] = [], leaves: LeaveMark[] = []): string[] {
  const out = new Set(patternStaffOnDate(patterns, dateStr))
  for (const e of extras) if (e.day === dateStr) out.add(e.staffId)
  for (const l of leaves) if (l.day === dateStr) out.delete(l.staffId)
  return Array.from(out)
}

// ── กติกาการลา (เจ้าของตกลง) ──────────────────────────────────────────────────────────────
//  ล่วงหน้า < 48 ชม. (นับถึง 09:00 ของวันนั้น) → ลาในแอปไม่ได้ ต้องทักหาพี่เจ้าของร้าน (เจ้าของบันทึกลาให้)
//  ล่วงหน้า ≥ 10 วัน → อนุมัติทันที | น้อยกว่า 10 วัน → ถ้าระบุคนแทน รอคนแทนกดรับ (รับแล้วอนุมัติ) ไม่มีคนแทน = ส่งเจ้าของ
//  ลาเป็นช่วง: ยาวเกิน 14 วัน หรือมีวันที่ใกล้กว่า 10 วัน → ส่งเจ้าของทั้งช่วง (ไม่แยกครึ่งอนุมัติครึ่งรอ); ช่วงไม่มีคนแทน
export const LEAVE_MIN_HOURS = 48
export const LEAVE_AUTO_DAYS = 10
export const LEAVE_MAX_AUTO_RANGE = 14
const SHIFT_START_HOUR_BKK = 9

export type LeaveRoute = 'auto' | 'cover' | 'owner'

export const diffDaysStr = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

// เวลาเริ่มเวรของวันนั้น (09:00 เวลาไทย) เป็น ms
export const shiftStartMs = (dateStr: string) => Date.parse(`${dateStr}T0${SHIFT_START_HOUR_BKK}:00:00+07:00`)

export function leaveRoute(
  p: { today: string; nowMs: number; days: string[]; hasCover: boolean },
): { route: LeaveRoute } | { error: 'invalid' | 'too_late' | 'too_far' | 'cover_range' } {
  const days = [...p.days].sort()
  if (days.length === 0) return { error: 'invalid' }
  const first = days[0], last = days[days.length - 1]
  if (first <= p.today) return { error: 'too_late' }
  if (shiftStartMs(first) - p.nowMs < LEAVE_MIN_HOURS * 3_600_000) return { error: 'too_late' }
  if (last > addDays(p.today, SCHEDULE_DAYS - 1)) return { error: 'too_far' }
  if (days.length > 1 && p.hasCover) return { error: 'cover_range' }
  const rangeSpan = diffDaysStr(first, last) + 1
  if (rangeSpan > LEAVE_MAX_AUTO_RANGE) return { route: 'owner' }
  if (diffDaysStr(p.today, first) >= LEAVE_AUTO_DAYS) return { route: 'auto' }
  return { route: p.hasCover ? 'cover' : 'owner' }
}

// วันที่ติดกันตั้งแต่ from ถึง to (รวมทั้งสองวัน) — null ถ้าช่วงไม่ถูกต้อง
export function dateRange(from: unknown, to: unknown, maxDays = SCHEDULE_DAYS): string[] | null {
  if (!isDateStr(from) || !isDateStr(to) || to < from) return null
  const n = diffDaysStr(from, to) + 1
  if (n > maxDays) return null
  return Array.from({ length: n }, (_, i) => addDays(from, i))
}

// วันที่คนเกินเป้า: ถ้าคนหนึ่งลา วันนั้นยังเหลือคน "ถึงเป้า" อยู่ไหม (count = จำนวนคนก่อนลา รวมคนที่ลา)
// ใช้กับการลาที่ล่วงหน้าน้อยกว่า 10 วัน: เหลือถึงเป้า → อนุมัติทันที ไม่ต้องหาคนแทน/รอเจ้าของ (คนที่รับเกินไว้เป็นตัวสำรอง)
export function stillAtTargetAfterLeave(count: number, type: DayType, c: ScheduleCounts): boolean {
  const target = type === 'weekend' ? c.weekendTarget : c.weekdayTarget
  return count - 1 >= target
}

// ลงเวรว่างได้กี่ที่ (ถึงเป้าแล้ว = 0) — ใช้ทั้งปุ่ม "ลงเวรนี้" และให้ฝั่งเซิร์ฟเวอร์คิดซ้ำ
export function openSlots(count: number, type: DayType, c: ScheduleCounts): number {
  const target = type === 'weekend' ? c.weekendTarget : c.weekdayTarget
  return Math.max(0, target - count)
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
  extraStaffIds: string[]   // ในจำนวน staffIds: คนที่ลงเพิ่มเอง/เจ้าของเพิ่มให้ (ไม่ได้มาจากแบบแผน)
  leaveStaffIds: string[]   // คนที่มีเวรวันนี้แต่ลาอนุมัติแล้ว (ถูกตัดออกจาก staffIds)
  count: number
  min: number
  target: number
  open: number              // ลงเวรว่างได้อีกกี่ที่
  status: DayStatus
}

export function buildScheduleDays(
  fromDate: string,
  days: number,
  patterns: SchedulePattern[],
  overrides: Record<string, DayType>,
  counts: ScheduleCounts,
  extras: ExtraShift[] = [],
  leaves: LeaveMark[] = [],
): ScheduleDay[] {
  const out: ScheduleDay[] = []
  for (let i = 0; i < days; i++) {
    const date = addDays(fromDate, i)
    const type = dayTypeFor(date, overrides)
    const staffIds = staffOnDate(patterns, date, extras, leaves)
    const planned = staffOnDate(patterns, date, extras)
    const fromPattern = new Set(patternStaffOnDate(patterns, date))
    out.push({
      date, weekday: weekdayOf(date), type, overridden: overrides[date] != null,
      staffIds, extraStaffIds: staffIds.filter(id => !fromPattern.has(id)),
      leaveStaffIds: planned.filter(id => !staffIds.includes(id)), count: staffIds.length,
      min: type === 'weekend' ? counts.weekendMin : counts.weekdayMin,
      target: type === 'weekend' ? counts.weekendTarget : counts.weekdayTarget,
      open: openSlots(staffIds.length, type, counts),
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
