import { createAdminClient } from '@/lib/supabase/admin'

// เทียบชื่อแบบตัดคำนำหน้า/ช่องว่างเกิน — ชื่อจาก OCR กับที่ owner กรอกอาจต่างกันเล็กน้อย
const normalizeName = (s: string) =>
  s.replace(/^(นาย|นางสาว|นาง|เด็กชาย|เด็กหญิง|mr\.?|mrs\.?|ms\.?|miss)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

const normalizePhone = (s: string) => s.replace(/\D/g, '')

// เลขบัตรประชาชนไทย (ตัวเลขล้วน) หรือเลขพาสปอร์ต (มีตัวอักษรปนได้) — ตัดขีด/เว้นวรรค เทียบแบบไม่สนตัวพิมพ์
const normalizeIdCard = (s: string) => s.replace(/[\s-]/g, '').toUpperCase()

export type BlacklistHit = { name: string; reason: string | null; matchedBy: 'id_card' | 'phone' | 'name' }

// เช็คชื่อ/เบอร์/เลขบัตรกับบัญชีดำของร้าน — เจอคืนรายการที่แมตช์, ไม่เจอคืน null
// เลขบัตรเช็คก่อนเพราะเป็นสัญญาณที่แม่นสุด (กันเคสโจรเปลี่ยนชื่อ แต่เลขบัตรเดิม
// และกันเคสลูกค้าจริงชื่อซ้ำโจรบังเอิญแต่คนละเลขบัตร ไม่ให้โดนเหมาบล็อกผิดคน)
export async function checkBlacklist(
  supabase: ReturnType<typeof createAdminClient>,
  { name, phone, idCardNumber }: { name?: string | null; phone?: string | null; idCardNumber?: string | null }
): Promise<BlacklistHit | null> {
  const nName = name ? normalizeName(name) : ''
  const nPhone = phone ? normalizePhone(phone) : ''
  const nIdCard = idCardNumber ? normalizeIdCard(idCardNumber) : ''
  if (!nName && !nPhone && !nIdCard) return null

  const { data: rows } = await supabase.from('blacklist').select('name, phone, id_card_number, reason')

  for (const r of rows ?? []) {
    if (nIdCard && r.id_card_number && normalizeIdCard(r.id_card_number) === nIdCard) {
      return { name: r.name, reason: r.reason, matchedBy: 'id_card' }
    }
  }
  for (const r of rows ?? []) {
    if (nPhone && r.phone && normalizePhone(r.phone) === nPhone) {
      return { name: r.name, reason: r.reason, matchedBy: 'phone' }
    }
  }
  for (const r of rows ?? []) {
    if (nName && r.name && normalizeName(r.name) === nName) {
      return { name: r.name, reason: r.reason, matchedBy: 'name' }
    }
  }
  return null
}
