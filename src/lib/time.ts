// แปลงเวลา datetime-local (ไม่มี timezone) → ตีความเป็นเวลาไทย (+07:00) แล้วเป็น UTC ISO
// ⭐ ตัวเดียวที่ใช้ทุกฟอร์ม — ห้ามส่ง datetime-local ดิบไปเซิร์ฟเวอร์ (Vercel=UTC จะเพี้ยน 7 ชม.)
export function bangkokToUTC(localStr: string): string {
  const s = localStr.length === 16 ? localStr + ':00' : localStr
  return new Date(s + '+07:00').toISOString()
}

// แปลงกลับ — UTC ISO จาก DB → ค่าใส่ input datetime-local ตามเวลาไทย (ใช้ตอนดึงค่าเดิมมาเติมฟอร์มแก้ไข)
export function utcToBangkokLocal(utcIso: string): string {
  const bkk = new Date(new Date(utcIso).getTime() + 7 * 3_600_000)
  return bkk.toISOString().slice(0, 16)
}
