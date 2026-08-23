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

// จำนวนวันที่จ่ายต่อรอบ 7 วัน ของรุ่นนั้น (NULL/ไม่เจอ = ค่ากลาง 5) — ใช้ก่อนเรียก calcRentQuote()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPromoPayDays(admin: any, brand: string, model: string): Promise<number> {
  const { data } = await admin
    .from('bike_models')
    .select('promo_pay_days')
    .eq('brand', brand)
    .eq('name', model)
    .maybeSingle()
  return data?.promo_pay_days ?? 5
}
