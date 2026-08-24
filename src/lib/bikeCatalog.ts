import { createAdminClient } from '@/lib/supabase/admin'

export type BikeModel = { brand: string; name: string; promoPayDays?: number | null }

// ดึงคลังยี่ห้อ/รุ่นจาก DB (ใช้ในหน้า server ที่เรนเดอร์ฟอร์มเพิ่ม/แก้รถ)
export async function getBikeCatalog(): Promise<{ brands: string[]; models: BikeModel[] }> {
  const admin = createAdminClient()
  const [{ data: brands }, { data: models }] = await Promise.all([
    admin.from('bike_brands').select('name').order('name'),
    admin.from('bike_models').select('brand, name, promo_pay_days').order('name'),
  ])
  return {
    brands: (brands ?? []).map(b => b.name),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    models: (models ?? []).map((m: any) => ({ brand: m.brand, name: m.name, promoPayDays: m.promo_pay_days })),
  }
}

// จำนวนวันที่จ่ายต่อรอบ 7 วัน ของรุ่นนั้น — ถ้าส่ง branchId มา เช็คค่าตั้งเฉพาะสาขานั้นก่อน
// (NULL/ไม่เจอทั้งคู่ = ค่ากลาง 5) — ใช้ก่อนเรียก calcRentQuote()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPromoPayDays(admin: any, brand: string, model: string, branchId?: string): Promise<number> {
  if (branchId) {
    const { data: branchRow } = await admin
      .from('branch_model_pricing')
      .select('promo_pay_days')
      .eq('branch_id', branchId)
      .eq('brand', brand)
      .eq('model', model)
      .maybeSingle()
    if (branchRow?.promo_pay_days != null) return branchRow.promo_pay_days
  }
  const { data } = await admin
    .from('bike_models')
    .select('promo_pay_days')
    .eq('brand', brand)
    .eq('name', model)
    .maybeSingle()
  return data?.promo_pay_days ?? 5
}

export type BranchModelPricing = { dailyRate: number | null; monthlyRate: number | null; promoPayDays: number }

// ราคา+โปร ที่ตั้งไว้เฉพาะสาขานั้นสำหรับรุ่นนี้ (ใช้ auto-fill ตอนย้ายรถไปสาขาใหม่)
// dailyRate/monthlyRate เป็น null ถ้ายังไม่ได้ตั้ง — ผู้เรียกต้อง fallback เอง (เช่น ใช้ราคาเดิมของรถ)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getBranchModelPricing(admin: any, branchId: string, brand: string, model: string): Promise<BranchModelPricing> {
  const [{ data: branchRow }, { data: modelRow }] = await Promise.all([
    admin.from('branch_model_pricing').select('daily_rate, monthly_rate, promo_pay_days').eq('branch_id', branchId).eq('brand', brand).eq('model', model).maybeSingle(),
    admin.from('bike_models').select('promo_pay_days').eq('brand', brand).eq('name', model).maybeSingle(),
  ])
  return {
    dailyRate: branchRow?.daily_rate ?? null,
    monthlyRate: branchRow?.monthly_rate ?? null,
    promoPayDays: branchRow?.promo_pay_days ?? modelRow?.promo_pay_days ?? 5,
  }
}
