// เบอร์โทร "จริง" ต้องมีเลขอย่างน้อย 9 หลัก (เกณฑ์เดียวกับที่ฝั่ง client ใช้ก่อนยิง lookup/blacklist)
// ใช้กันก่อน match ลูกค้าเดิมด้วยเบอร์โทร — staff ที่ไม่มีเบอร์จริงมักพิมพ์ "," หรือ "-" ผ่าน required
// field เฉยๆ ถ้าเอาไปเทียบตรงๆ ลูกค้าคนละคนที่ใช้ placeholder เดียวกันในสาขาเดียวกันจะไปชนกันเป็นคนเดียวกัน
export function isRealPhone(phone: string): boolean {
  return phone.replace(/\D/g, '').length >= 9
}

// บัตรไทย = เลข 13 หลักล้วน — ใช้แยกลูกค้าไทย/ต่างชาติจากเลขบัตรที่ OCR อ่านมา
// (นโยบายร้าน: คนไทยต้องโอนเงินอย่างเดียว จ่ายเงินสดได้เฉพาะต่างชาติที่ถือพาสปอร์ต)
export function isThaiIdNumber(idCardNumber: string): boolean {
  return /^\d{13}$/.test(idCardNumber.replace(/\D/g, '')) && idCardNumber.replace(/\D/g, '').length === 13
}

const TITLES = ['นาย', 'นาง', 'นางสาว', 'น.ส.', 'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'miss']

// เทียบชื่อบัตรประชาชนกับชื่อผู้โอนในสลิป — ตัดคำนำหน้า (นาย/นาง/นางสาว/Mr/Ms ฯลฯ) ออกก่อนเทียบเสมอ
// กันเคสฝั่งนึงมีคำนำหน้าอีกฝั่งไม่มีแล้วคำเทียบเยื้องกันทั้งชื่อ
// สลิปธนาคารมักย่อนามสกุลเหลือ "อักษรตัวแรก + จุด" (เช่น "สุขญาติ" -> "ส.") ไม่ใช่แค่ตัดทิ้งทั้งคำ —
// ถ้าเจอคำย่อแบบนี้เทียบแค่ตัวอักษรแรกของนามสกุลในบัตรว่าใช่ตัวเดียวกันไหม แทนที่จะฟ้องว่าไม่ตรงเลย
// ถ้าอ่านชื่อจากสลิปไม่ได้เลย (ค่าว่าง) ถือว่าเทียบไม่ได้ ไม่นับเป็นไม่ตรง (ให้ผ่านไปก่อน ไม่ใช่บล็อกเพราะ OCR ล้มเหลว)
export function idAndSlipNameMatch(idName: string, slipName: string): boolean {
  const parts = (s: string) => s.trim().toLowerCase().split(/\s+/).filter(Boolean).filter(p => !TITLES.includes(p))
  const idParts = parts(idName)
  const slipParts = parts(slipName)
  if (slipParts.length === 0) return true
  const compareCount = Math.min(idParts.length, slipParts.length)
  for (let i = 0; i < compareCount; i++) {
    const idPart = idParts[i]
    const slipPart = slipParts[i]
    if (idPart === slipPart) continue
    const slipAbbrev = slipPart.replace(/\.$/, '')
    if (slipAbbrev.length === 1 && idPart.startsWith(slipAbbrev)) continue
    return false
  }
  return true
}
