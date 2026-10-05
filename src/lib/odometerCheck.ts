// ตัวช่วยกลางเช็คเลขไมล์ที่พนักงานพิมพ์ — ใช้ร่วมกันทั้งหน้าจอ (เตือนทันที) และหลังบ้าน (กันซ้ำ)
// ไมล์ที่พิมพ์ผิด (หลักหาย/เกิน) จะเขียนทับไมล์รถทันที ทำให้รูทีนแบบ กม. เพี้ยนตาม

// เพิ่มจากในระบบเกินนี้ถามยืนยัน (แค่ถาม ไม่บล็อก — รายเดือนที่เช่านานวิ่งเกินได้จริง)
export const ODO_JUMP_CONFIRM_KM = 1500

// ต่ำกว่าไมล์ในระบบ = บล็อก (คืนข้อความ error) ไม่ต่ำกว่า = null
export function odometerLowerError(entered: number, current: number | null | undefined): string | null {
  const cur = Number(current) || 0
  if (!Number.isFinite(entered) || entered < 0) return 'เลขไมล์ไม่ถูกต้อง'
  if (entered < cur) {
    return `ไมล์ที่กรอก (${entered.toLocaleString()}) ต่ำกว่าไมล์ในระบบ (${cur.toLocaleString()} กม.) — เช็คตัวเลขกับหน้าปัดอีกครั้ง (ถ้าไมล์ในระบบผิดเอง ให้เจ้าของแก้ที่หน้าแก้ไขข้อมูลรถก่อน)`
  }
  return null
}

// เพิ่มผิดปกติ = คืนข้อความถามยืนยัน (ไมล์ในระบบเป็น 0/ว่าง = ยังไม่มีค่าอ้างอิง ไม่ถาม)
export function odometerJumpWarning(entered: number, current: number | null | undefined): string | null {
  const cur = Number(current) || 0
  if (cur <= 0) return null
  const diff = entered - cur
  if (diff > ODO_JUMP_CONFIRM_KM) {
    return `ไมล์เพิ่มขึ้น ${diff.toLocaleString()} กม. จากในระบบ (${cur.toLocaleString()}) แน่ใจว่าตัวเลขถูกต้อง?`
  }
  return null
}

// ฝั่งหน้าจอ: คืน true = ผ่านไปต่อได้, false = หยุด (พร้อมตั้งข้อความ error ให้เรียกใช้เอง)
export function confirmOdometerClient(entered: number, current: number | null | undefined): { ok: true } | { ok: false; error: string } {
  const lower = odometerLowerError(entered, current)
  if (lower) return { ok: false, error: lower }
  const jump = odometerJumpWarning(entered, current)
  if (jump && typeof window !== 'undefined' && !window.confirm(jump)) return { ok: false, error: 'ยกเลิก — กรุณาเช็คเลขไมล์อีกครั้ง' }
  return { ok: true }
}
