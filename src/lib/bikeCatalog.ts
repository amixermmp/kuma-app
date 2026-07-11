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
    models: (models ?? []) as BikeModel[],
  }
}
