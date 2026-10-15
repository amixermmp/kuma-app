// ตารางเวลาที่ LINE chatbot ตอบ — ใช้ทั้งฝั่งหน้าตั้งค่า (แสดงสถานะ) และตัวบอท (ตัดสินใจตอบ/เงียบ)
// เวลาไทยทั้งหมด (UTC+7 คงที่) ช่วงเวลาข้ามเที่ยงคืนได้ (start > end เช่น 20:00–02:00)

export type DayMode = 'all' | 'range' | 'off'
export type DayRule = { mode: DayMode; start?: string; end?: string }
export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export type DayKey = (typeof DAY_KEYS)[number]
export type WeekSchedule = Partial<Record<DayKey, DayRule>>
export type TodayOverride = DayRule & { date: string } // date = YYYY-MM-DD เวลาไทย

const H7_MS = 7 * 60 * 60 * 1000

export function toMinutes(hhmm: unknown): number | null {
  if (typeof hhmm !== 'string') return null
  const m = hhmm.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

// กฎของวันหนึ่ง ตอบอยู่ ณ นาทีที่ minutes ของวันนั้นหรือไม่ (ไม่รวมส่วนที่ล้นมาจากวันก่อน)
function activeInOwnDay(rule: DayRule | undefined, minutes: number): boolean {
  if (!rule || rule.mode === 'all') return true // ไม่ได้ตั้ง = ตอบทั้งวัน
  if (rule.mode === 'off') return false
  const s = toMinutes(rule.start)
  const e = toMinutes(rule.end)
  if (s == null || e == null) return false // ช่วงเวลาไม่ถูกต้อง = เงียบไว้ก่อน
  if (s === e) return true
  return s < e ? minutes >= s && minutes < e : minutes >= s // ข้ามเที่ยงคืน: ช่วงก่อนเที่ยงคืนของวันนี้
}

// ส่วนของช่วงข้ามเที่ยงคืนของ "เมื่อวาน" ที่ล้นมาถึงเช้าวันนี้
function activeFromYesterday(rule: DayRule | undefined, minutes: number): boolean {
  if (!rule || rule.mode !== 'range') return false
  const s = toMinutes(rule.start)
  const e = toMinutes(rule.end)
  return s != null && e != null && s > e && minutes < e
}

export function isBotActiveNow(
  schedule: WeekSchedule | null | undefined,
  override: TodayOverride | null | undefined,
  nowMs: number = Date.now()
): boolean {
  const bkk = new Date(nowMs + H7_MS)
  const date = bkk.toISOString().slice(0, 10)
  const minutes = bkk.getUTCHours() * 60 + bkk.getUTCMinutes()
  const day = bkk.getUTCDay()

  const todayRule = override && override.date === date ? override : schedule?.[DAY_KEYS[day]]
  const yesterdayRule = schedule?.[DAY_KEYS[(day + 6) % 7]]
  return activeInOwnDay(todayRule, minutes) || activeFromYesterday(yesterdayRule, minutes)
}

// ข้อความสรุปกฎ ใช้แสดงในหน้าตั้งค่า
export function describeRule(rule: DayRule | undefined): string {
  if (!rule || rule.mode === 'all') return 'ตอบทั้งวัน'
  if (rule.mode === 'off') return 'ไม่ตอบทั้งวัน'
  return `ตอบ ${rule.start ?? '--:--'}–${rule.end ?? '--:--'} น.`
}
