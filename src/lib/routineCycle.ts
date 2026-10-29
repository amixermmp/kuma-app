// น้ำมันเฟืองท้ายตามรอบน้ำมันเครื่อง: รอบที่ 1, 2, 3 (= เครื่อง+เฟืองท้าย) แล้ววนใหม่
// ไฟล์นี้ไม่ import อะไรฝั่งเซิร์ฟเวอร์ — หน้า client ใช้ร่วมด้วย
//
// ตัวนับ (bike_routines.engine_changes_since ที่แถวเฟืองท้าย) = เปลี่ยนน้ำมันเครื่องมากี่ครั้งในรอบปัจจุบัน
//   - เปลี่ยนเครื่อง+เฟืองท้ายพร้อมกัน        → 0 (จบรอบ ครั้งถัดไปเป็นรอบที่ 1)
//   - เปลี่ยนเฟืองท้ายเดี่ยวคนละวันกับเครื่อง   → 1 (ถือว่าน้ำมันเครื่องครั้งล่าสุดเป็นรอบที่ 1)
//   - เปลี่ยนน้ำมันเครื่องโดยไม่ทำเฟืองท้าย     → +1
export const ENGINE_TASK = 'เปลี่ยนน้ำมันเครื่อง'
export const GEAR_TASK = 'เปลี่ยนน้ำมันเฟืองท้าย'
export const CYCLE_LENGTH = 3
// เพดานปฏิทินของเฟืองท้าย — ไม่ได้เปลี่ยนเกินกี่วันก็เตือนเอง กันตัวนับรอบเพี้ยนหรือรถถูกใช้น้อย
export const GEAR_CEILING_DAYS = 365
// กำหนดวันเช่าสะสมของน้ำมันเครื่อง — รถเข้าระบบ/เจ้าของเว้นช่องไว้ ใส่ค่านี้ให้ กันรถที่ไม่มีตัวนับวันเช่าตกหล่น
export const DEFAULT_ENGINE_RENTED_DAYS = 30

// true = ครั้งนี้ที่เปลี่ยนน้ำมันเครื่องคือรอบที่ 3 ขึ้นไป (หรือค้างจากรอบก่อน) ต้องเสนอเปลี่ยนเฟืองท้ายด้วย
export function gearDueThisChange(engineChangesSince: number): boolean {
  return engineChangesSince + 1 >= CYCLE_LENGTH
}

// รอบที่ของการเปลี่ยนน้ำมันเครื่องครั้งถัดไป (1..3, เกิน 3 = ค้างเฟืองท้าย)
export function nextEnginePosition(engineChangesSince: number): number {
  return engineChangesSince + 1
}

// จุดตั้งต้นตัวนับตอนเข้าระบบใหม่ — เทียบวันที่ทำล่าสุดของเครื่องกับเฟืองท้าย (รูปแบบ YYYY-MM-DD)
export function initialCycleCount(engineLastDone: string | null, gearLastDone: string | null): number {
  if (engineLastDone && gearLastDone && engineLastDone === gearLastDone) return 0
  return 1
}

export function addDaysIso(fromIso: string, days: number): string {
  const d = new Date(fromIso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

// เฟืองท้ายเก่าเกินกี่วันถือว่าควรเปลี่ยนในน้ำมันเครื่องครั้งถัดไป (ตัวนับ 2) แทนที่จะรอรอบ 3 ตามปกติ
export const GEAR_STALE_DAYS = 120
// รถที่ไม่รู้วันที่เปลี่ยนเฟืองท้าย — ตั้งเพดานเตือนกี่วันจากวันนี้ (ตาข่ายกันลืมถ้าน้ำมันเครื่องไม่ถึงรอบนาน)
export const GEAR_UNKNOWN_CEILING_DAYS = 60

export type GearChoice = { mode: 'same' | 'other' | 'unknown'; date?: string | null }

// เฟืองท้ายของรถที่เพิ่งลงทะเบียนใหม่ (เข้าระบบตามรอบน้ำมันเครื่องเลย)
//   same    = เปลี่ยนพร้อมน้ำมันเครื่อง (วันเดียวกัน) → ตัวนับ 0
//   other   = เปลี่ยนคนละวัน (ต้องมีวันที่)        → ตัวนับ 1 (ถ้าเก่าเกิน GEAR_STALE_DAYS → 2)
//   unknown = ยังไม่เปลี่ยน/ไม่แน่ใจ                → ตัวนับ 2 (น้ำมันเครื่องครั้งหน้าเป็นรอบ 3 เปลี่ยนเฟืองท้ายพร้อม)
export function planGearForNewBike(
  choice: GearChoice,
  engineLastDone: string | null,
  today: string,
): { ok: true; lastDoneDate: string | null; count: number; ceilingDate: string } | { ok: false; error: string } {
  let lastDoneDate: string | null = null
  let count = 2
  if (choice.mode === 'same') {
    if (!engineLastDone) return { ok: false, error: 'เปลี่ยนเฟืองท้ายพร้อมน้ำมันเครื่อง — กรุณากรอกวันที่เปลี่ยนน้ำมันเครื่องล่าสุดด้วย' }
    lastDoneDate = engineLastDone
    count = 0
  } else if (choice.mode === 'other') {
    if (!choice.date) return { ok: false, error: 'กรุณากรอกวันที่เปลี่ยนเฟืองท้ายล่าสุด' }
    lastDoneDate = choice.date
    const age = Math.floor((new Date(today).getTime() - new Date(choice.date).getTime()) / 86_400_000)
    count = choice.date === engineLastDone ? 0 : age > GEAR_STALE_DAYS ? 2 : 1
  }
  let ceilingDate = lastDoneDate ? addDaysIso(lastDoneDate, GEAR_CEILING_DAYS) : addDaysIso(today, GEAR_UNKNOWN_CEILING_DAYS)
  if (ceilingDate < today) ceilingDate = addDaysIso(today, GEAR_UNKNOWN_CEILING_DAYS)
  return { ok: true, lastDoneDate, count, ceilingDate }
}
