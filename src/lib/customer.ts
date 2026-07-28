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

// เทียบชื่อบัตรประชาชนกับชื่อผู้โอนในสลิป — สลิปบางแบบมีแค่ชื่อจริงไม่มีนามสกุล จึงเทียบแค่ตามจำนวน
// คำที่สลิปมีจริง (ชื่อจริงอย่างเดียวก็เทียบแค่ชื่อจริง) ไม่ตรง = ไม่ใช่เจ้าของบัตรคนเดียวกับที่โอนเงิน
// ถ้าอ่านชื่อจากสลิปไม่ได้เลย (ค่าว่าง) ถือว่าเทียบไม่ได้ ไม่นับเป็นไม่ตรง (ให้ผ่านไปก่อน ไม่ใช่บล็อกเพราะ OCR ล้มเหลว)
export function idAndSlipNameMatch(idName: string, slipName: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase()
  const idParts = norm(idName).split(/\s+/).filter(Boolean)
  const slipParts = norm(slipName).split(/\s+/).filter(Boolean)
  if (slipParts.length === 0) return true
  const compareCount = Math.min(idParts.length, slipParts.length)
  for (let i = 0; i < compareCount; i++) {
    if (idParts[i] !== slipParts[i]) return false
  }
  return true
}
