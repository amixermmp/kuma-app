// แปลงเวลา datetime-local (ไม่มี timezone) → ตีความเป็นเวลาไทย (+07:00) แล้วเป็น UTC ISO
// ⭐ ตัวเดียวที่ใช้ทุกฟอร์ม — ห้ามส่ง datetime-local ดิบไปเซิร์ฟเวอร์ (Vercel=UTC จะเพี้ยน 7 ชม.)
export function bangkokToUTC(localStr: string): string {
  const s = localStr.length === 16 ? localStr + ':00' : localStr
  return new Date(s + '+07:00').toISOString()
}
