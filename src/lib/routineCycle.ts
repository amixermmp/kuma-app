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
