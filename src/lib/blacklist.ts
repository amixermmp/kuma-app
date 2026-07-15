import { createAdminClient } from '@/lib/supabase/admin'

// เทียบชื่อแบบตัดคำนำหน้า/ช่องว่างเกิน — ชื่อจาก OCR กับที่ owner กรอกอาจต่างกันเล็กน้อย
const normalizeName = (s: string) =>
  s.replace(/^(นาย|นางสาว|นาง|เด็กชาย|เด็กหญิง|mr\.?|mrs\.?|ms\.?|miss)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

const normalizePhone = (s: string) => s.replace(/\D/g, '')

export type BlacklistHit = { name: string; reason: string | null; matchedBy: 'phone' | 'name' }

// เช็คชื่อ/เบอร์กับบัญชีดำของร้าน — เจอคืนรายการที่แมตช์, ไม่เจอคืน null
export async function checkBlacklist(
  supabase: ReturnType<typeof createAdminClient>,
  { name, phone }: { name?: string | null; phone?: string | null }
): Promise<BlacklistHit | null> {
  const nName = name ? normalizeName(name) : ''
  const nPhone = phone ? normalizePhone(phone) : ''
  if (!nName && !nPhone) return null

  const { data: rows } = await supabase.from('blacklist').select('name, phone, reason')

  for (const r of rows ?? []) {
    if (nPhone && r.phone && normalizePhone(r.phone) === nPhone) {
      return { name: r.name, reason: r.reason, matchedBy: 'phone' }
    }
    if (nName && r.name && normalizeName(r.name) === nName) {
      return { name: r.name, reason: r.reason, matchedBy: 'name' }
    }
  }
  return null
}
