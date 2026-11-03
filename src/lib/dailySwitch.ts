// สลับสัญญารายเดือน → รายวัน: ตัวคิดราคา/มัดจำที่ใช้ทั้งหน้าจอและ API (API คิดซ้ำฝั่งเซิร์ฟเวอร์ ไม่เชื่อราคาจากหน้าเว็บ)
// ไม่ import อะไรที่ผูกกับเซิร์ฟเวอร์ เพื่อให้ client component เรียกใช้ได้
//
// กติกา (ตกลงกับเจ้าของแล้ว):
//  - นับวันเช่าจาก "วันครบดีลเดิม" ที่ถึงแล้ว (ไม่ใช่วันที่กดสลับ) เวลาเริ่ม = เวลารับรถเดิม กำหนดคืนเป็นเวลาเดียวกันทุกวัน (เหมือนรายวันปกติ)
//  - ลูกค้าเลือก: ถึงวันนี้ / +1 วัน / ระบุจำนวนวัน → คิดตรงๆ วันละเรทรายวัน ไม่มีโปร ไม่มีเพดาน  |  แพ็กเกจสัปดาห์ → โปร 7 วันจ่าย 5
//  - จำนวนวันต้องไม่ต่ำกว่าที่ผ่านมาแล้ว (กำหนดคืนต้องไม่ตกอยู่ในอดีต ไม่งั้นสัญญาจะถูกมองว่าเลยกำหนดทันทีแล้วคิดค่าล่วงเวลา)
//  - แพ็กเกจสัปดาห์หลังเลยวันครบดีล: เตือน + บันทึก ไม่ล็อกแข็ง (พนักงานตัดสินใจรายเคส)
//  - มัดจำตามเกณฑ์เดียวกับหน้าส่งรถ: นักศึกษา 0 / 7 วันขึ้นไป 1,000 / สั้นไม่มีหลักฐานที่พัก 500 / สั้นมีหลักฐานที่พัก 0
import { calcShortPrice } from '@/lib/pricing'

export const DAY_MS = 86_400_000
const GRACE_MS = 30 * 60_000   // ฟรี 30 นาทีแรกเหมือนค่าล่วงเวลารายวัน

export type SwitchPackage = 'now' | 'plus1' | 'days' | 'week'

// เวลาเริ่มสัญญารายวัน = วันครบดีล + เวลารับรถ (เวลาไทย)
export function switchStartMs(dealStart: string, pickupTime: string): number {
  return new Date(`${dealStart}T${pickupTime}:00+07:00`).getTime()
}

// จำนวนวันขั้นต่ำที่ครอบคลุมถึงตอนนี้ (นับเป็นก้อน 24 ชม. จากเวลาเริ่ม เกินมาไม่ถึง 30 นาทีไม่นับ) อย่างน้อย 1 วัน
export function minSwitchDays(startMs: number, nowMs: number): number {
  return Math.max(1, Math.ceil(Math.max(0, nowMs - startMs - GRACE_MS) / DAY_MS))
}

export type SwitchQuote = {
  days: number
  total: number            // ยอดที่ลูกค้าจ่าย (หลังส่วนลด)
  normalTotal: number      // ยอดก่อนส่วนลดนักศึกษา
  discount: number
  isPromo: boolean
}

export function quoteSwitch(input: {
  pkg: SwitchPackage
  daysInput?: number
  minDays: number
  baseRate: number            // เรทรายวันปกติของคัน
  discountPerDay: number      // ส่วนลดนักศึกษาต่อวัน (0 = ไม่มี)
  promoPayDays: number
}): SwitchQuote | { error: string } {
  const { pkg, minDays, baseRate, promoPayDays } = input
  const ndr = Math.max(0, baseRate - Math.max(0, input.discountPerDay))
  if (!(baseRate > 0)) return { error: 'ไม่พบเรทรายวันของรถคันนี้ — ทักหาผู้จัดการให้ตั้งราคาก่อน' }

  if (pkg === 'week') {
    if (minDays > 7) return { error: 'แพ็กเกจสัปดาห์ (7 วัน) ครอบคลุมไม่ถึงวันนี้ — เลือกจำนวนวันแทน' }
    const total = calcShortPrice(7, ndr, 1e9, promoPayDays).total
    const normalTotal = calcShortPrice(7, baseRate, 1e9, promoPayDays).total
    return { days: 7, total, normalTotal, discount: Math.max(0, normalTotal - total), isPromo: true }
  }

  let days: number
  if (pkg === 'now') days = minDays
  else if (pkg === 'plus1') days = minDays + 1
  else {
    days = Math.floor(Number(input.daysInput))
    if (!Number.isFinite(days) || days < minDays) return { error: `จำนวนวันต้องไม่ต่ำกว่า ${minDays} วัน (นับถึงวันนี้แล้ว)` }
    if (days > 365) return { error: 'จำนวนวันมากเกินไป' }
  }
  const total = days * ndr
  const normalTotal = days * baseRate
  return { days, total, normalTotal, discount: Math.max(0, normalTotal - total), isPromo: false }
}

export function requiredDeposit(p: { isStudent: boolean; days: number; hasAccommodationProof: boolean }): number {
  if (p.isStudent) return 0
  if (p.days >= 7) return 1000
  return p.hasAccommodationProof ? 0 : 500
}

// ── วางบัตรประชาชนแทนมัดจำ: กติกากลางที่ทุกจุดใช้ร่วมกัน ─────────────────────────────────────────
// วางบัตรได้เฉพาะเช่าสั้น (<7 วัน) ไม่ใช่นักศึกษา/รายเดือน ถ้าต่อ/แปลง/สลับแล้วเข้าเกณฑ์ยาว ("cardConflict") ต้องเลือก 1 ใน 2:
//  - 'cash'      ลูกค้านำเงินสดมาแลกบัตร → เก็บมัดจำเงินสดตามเกณฑ์ เปลี่ยนวิธีมัดจำเป็นเงินสด คืนบัตรให้ลูกค้า
//  - 'keep_card' ผู้จัดการยืนยันให้คงบัตรไว้ต่อ → ต้องติ๊กยืนยัน ไม่แตะมัดจำ (หน้าเว็บเก็บแค่ติ๊ก ระบบเช็คตัวตนผู้จัดการไม่ได้ แต่บันทึกลงบันทึกการทำงาน)
// API ทุกจุดต้องเรียก checkCardGate ซ้ำเอง ไม่เชื่อหน้าเว็บ
export type CardChoice = 'cash' | 'keep_card'

export function checkCardGate(p: { cardChoice: unknown; confirmKeepCard: unknown }): { mode: CardChoice } | { error: string } {
  if (p.cardChoice === 'cash') return { mode: 'cash' }
  if (p.cardChoice === 'keep_card') {
    if (p.confirmKeepCard !== true) return { error: 'ผู้จัดการยังไม่ได้ยืนยันให้คงบัตรไว้ — ติ๊กยืนยันก่อน หรือเปลี่ยนเป็นมัดจำเงินสด' }
    return { mode: 'keep_card' }
  }
  return { error: 'ลูกค้าวางบัตรประชาชนไว้ แต่เกณฑ์นี้ต้องมัดจำเงินสด — เลือกเปลี่ยนเป็นมัดจำเงินสด หรือให้ผู้จัดการยืนยันคงบัตรไว้' }
}

// ต่อเวลาสัญญารายวัน: เตือนมัดจำเฉพาะตอนที่ต่อแล้ว "ข้ามเกณฑ์มัดจำขึ้น" (เช่นสั้น → 7 วันขึ้นไป) เท่านั้น
// ไม่ถามซ้ำทุกครั้งที่ต่อ (สัญญาที่หยวนมัดจำไว้ตั้งแต่ส่งรถจะได้ไม่โดนทวงทุกรอบ) และไม่มีการคืนมัดจำเมื่อเกณฑ์ลดลง — คืนทีเดียวตอนคืนรถ
// recommendedExtra = ยอดที่ควรเก็บเพิ่ม (ถ้า cardConflict = ยอดตอนเลือกเปลี่ยนเป็นเงินสด คิดจากถืออยู่ 0 เพราะบัตรไม่ใช่เงิน)
export function extendDepositPlan(p: {
  isStudent: boolean; oldDays: number; newDays: number; hasAccommodationProof: boolean; held: number; idCard: boolean
}): { required: number; tierUp: boolean; cardConflict: boolean; recommendedExtra: number } {
  const req = (days: number) => requiredDeposit({ isStudent: p.isStudent, days, hasAccommodationProof: p.hasAccommodationProof })
  const required = req(p.newDays)
  const tierUp = required > req(p.oldDays)
  const cardConflict = p.idCard && p.newDays >= 7 && p.oldDays < 7
  const recommendedExtra = !tierUp || (p.idCard && !cardConflict) ? 0 : Math.max(0, required - (p.idCard ? 0 : p.held))
  return { required, tierUp, cardConflict, recommendedExtra }
}
