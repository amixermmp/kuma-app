import type { SupabaseClient } from '@supabase/supabase-js'
import { getBikeIdAtDate } from '@/lib/swapHistory'

// รายได้สะสมตลอดชีพของรถคันหนึ่ง — ตามกติกาบัญชีเดียวกับแดชบอร์ด: เงินสดตามวันเก็บจริงจาก rental_payments (รายวัน ทุก kind)
// + monthly_payments (รายเดือน paid/partial) ไม่นับมัดจำ/ค่าจอง/รายการที่ยกเลิก (voided)
// สัญญาที่เคยสลับรถ: นับเงินให้คันที่ผูกอยู่จริง ณ วันที่เก็บ (getBikeIdAtDate ตัวเดียวกับแดชบอร์ด) ไม่ใช่คันปัจจุบันของสัญญา
// ดึงเฉพาะสัญญาที่คันนี้เกี่ยวข้อง (คันปัจจุบัน หรือเคยเป็น from_bike_id ในประวัติสลับ) เพื่อไม่ต้องไล่ทั้งตาราง

const CHUNK = 100

type Contract = { id: string; bike_id: string; swap_log: unknown }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getBikeLifetimeRevenue(supabase: SupabaseClient<any, any, any>, bikeId: string): Promise<number> {
  const involved = `bike_id.eq.${bikeId},swap_log.cs.[{"from_bike_id":"${bikeId}"}]`

  const [{ data: dailyContracts }, { data: monthlyContracts }] = await Promise.all([
    supabase.from('rentals').select('id, bike_id, swap_log').or(involved),
    supabase.from('monthly_rentals').select('id, bike_id, swap_log').or(involved),
  ])

  const daily = new Map((dailyContracts ?? []).map((c: Contract) => [c.id, c]))
  const monthly = new Map((monthlyContracts ?? []).map((c: Contract) => [c.id, c]))
  let total = 0

  const dailyIds = Array.from(daily.keys())
  for (let i = 0; i < dailyIds.length; i += CHUNK) {
    const { data } = await supabase.from('rental_payments')
      .select('rental_id, amount, paid_at')
      .in('rental_id', dailyIds.slice(i, i + CHUNK))
      .is('voided_at', null)
    for (const p of data ?? []) {
      const c = daily.get(p.rental_id)
      if (c && getBikeIdAtDate(c.bike_id, c.swap_log as never, String(p.paid_at).slice(0, 10)) === bikeId) total += Number(p.amount ?? 0)
    }
  }

  const monthlyIds = Array.from(monthly.keys())
  for (let i = 0; i < monthlyIds.length; i += CHUNK) {
    const { data } = await supabase.from('monthly_payments')
      .select('monthly_rental_id, amount, paid_date')
      .in('monthly_rental_id', monthlyIds.slice(i, i + CHUNK))
      .in('status', ['paid', 'partial'])
      .is('voided_at', null)
    for (const p of data ?? []) {
      const c = monthly.get(p.monthly_rental_id)
      if (c && getBikeIdAtDate(c.bike_id, c.swap_log as never, String(p.paid_date).slice(0, 10)) === bikeId) total += Number(p.amount ?? 0)
    }
  }

  return total
}
