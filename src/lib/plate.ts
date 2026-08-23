// ตัดช่องว่าง/ขีดออกเพื่อเทียบป้ายทะเบียนแบบไม่สนใจการเว้นวรรค — ใช้ทั้งฝั่ง client (จับคู่ OCR) และ server (ตรวจซ้ำ)
export function normalizePlate(plate: string): string {
  return plate.replace(/[\s\-]/g, '').toLowerCase()
}
