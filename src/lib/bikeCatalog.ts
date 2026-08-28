import { createAdminClient } from '@/lib/supabase/admin'

export type BikeModel = { brand: string; name: string }

// ดึงคลังยี่ห้อ/รุ่นจาก DB (ใช้ในหน้า server ที่เรนเดอร์ฟอร์มเพิ่ม/แก้รถ)
export async function getBikeCatalog(): Promise<{ brands: string[]; models: BikeModel[] }> {
  const admin = createAdminClient()
  const [{ data: brands }, { data: models }] = await Promise.all([
    admin.from('bike_brands').select('name').order('name'),
    admin.from('bike_models').select('brand, name').order('name'),
  ])
  return {
    brands: (brands ?? []).map(b => b.name),
    models: (models ?? []).map(m => ({ brand: m.brand, name: m.name })),
  }
}

// จำนวนวันที่จ่ายต่อรอบ 7 วัน ของรุ่นนั้นที่สาขานี้ — ตั้งได้เฉพาะต่อสาขาเท่านั้น (ไม่มีค่ากลางทั้งร้านอีกต่อไป)
// ไม่ได้ตั้ง/ไม่ส่ง branchId มา = ค่ากลาง 5 — ใช้ก่อนเรียก calcRentQuote()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPromoPayDays(admin: any, brand: string, model: string, branchId?: string): Promise<number> {
  if (!branchId) return 5
  const { data: branchRow } = await admin
    .from('branch_model_pricing')
    .select('promo_pay_days')
    .eq('branch_id', branchId)
    .eq('brand', brand)
    .eq('model', model)
    .maybeSingle()
  return branchRow?.promo_pay_days ?? 5
}

export type BranchModelPricing = { dailyRate: number | null; monthlyRate: number | null; promoPayDays: number; fuelReferencePhotoUrl: string | null }

// ราคา+โปร ที่ตั้งไว้เฉพาะสาขานั้นสำหรับรุ่นนี้ (ใช้ auto-fill ตอนย้ายรถไปสาขาใหม่)
// dailyRate/monthlyRate เป็น null ถ้ายังไม่ได้ตั้ง — ผู้เรียกต้อง fallback เอง (เช่น ใช้ราคาเดิมของรถ)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getBranchModelPricing(admin: any, branchId: string, brand: string, model: string): Promise<BranchModelPricing> {
  const { data: branchRow } = await admin
    .from('branch_model_pricing')
    .select('daily_rate, monthly_rate, promo_pay_days, fuel_reference_photo_url')
    .eq('branch_id', branchId)
    .eq('brand', brand)
    .eq('model', model)
    .maybeSingle()
  return {
    dailyRate: branchRow?.daily_rate ?? null,
    monthlyRate: branchRow?.monthly_rate ?? null,
    promoPayDays: branchRow?.promo_pay_days ?? 5,
    fuelReferencePhotoUrl: branchRow?.fuel_reference_photo_url ?? null,
  }
}

export type ResolvableBike = {
  daily_rate: number | null
  monthly_rate: number | null
  brand: string
  model: string
  branch_id: string | null
}

// รถไม่ได้ override ราคา (ค่าว่าง) = ใช้ราคามาตรฐานสาขา+รุ่นแทน — ไม่มีมาตรฐานตั้งไว้เลยก็ fallback ฿0/null
export function resolveBikeRate<T extends ResolvableBike>(bike: T, standard: { dailyRate: number | null; monthlyRate: number | null }): T {
  return {
    ...bike,
    daily_rate: bike.daily_rate ?? standard.dailyRate ?? 0,
    monthly_rate: bike.monthly_rate ?? standard.monthlyRate ?? null,
  }
}

// สำหรับหน้าที่ดึงรถคันเดียว — resolve ราคาให้ก่อนส่งต่อไปยัง client component
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveSingleBikeRate<T extends ResolvableBike>(admin: any, bike: T): Promise<T> {
  if (bike.daily_rate != null && bike.monthly_rate != null) return bike
  const standard = await getBranchModelPricing(admin, bike.branch_id ?? '', bike.brand, bike.model)
  return resolveBikeRate(bike, standard)
}

export type BikePricingMap = Map<string, { dailyRate: number | null; monthlyRate: number | null; promoPayDays: number }>

// โหลด branch_model_pricing ทั้งหมดมาเป็น map เดียว — ใช้กับหน้า list (ค้นหา/fleet ฯลฯ) กันยิง query ทีละคัน
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getBranchModelPricingMap(admin: any): Promise<BikePricingMap> {
  const { data } = await admin
    .from('branch_model_pricing')
    .select('branch_id, brand, model, daily_rate, monthly_rate, promo_pay_days')
  const map: BikePricingMap = new Map()
  for (const row of data ?? []) {
    map.set(`${row.branch_id}__${row.brand}__${row.model}`, {
      dailyRate: row.daily_rate ?? null,
      monthlyRate: row.monthly_rate ?? null,
      promoPayDays: row.promo_pay_days ?? 5,
    })
  }
  return map
}

export function resolveBikeRateFromMap<T extends ResolvableBike>(bike: T, map: BikePricingMap): T {
  const standard = map.get(`${bike.branch_id ?? ''}__${bike.brand}__${bike.model}`)
  return resolveBikeRate(bike, { dailyRate: standard?.dailyRate ?? null, monthlyRate: standard?.monthlyRate ?? null })
}
