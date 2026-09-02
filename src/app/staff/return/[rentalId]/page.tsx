import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPromoPayDays, resolveSingleBikeRate, getBranchModelPricing } from '@/lib/bikeCatalog'
import ReturnCarForm from './ReturnCarForm'

export const dynamic = 'force-dynamic'

export default async function ReturnCarPage({ params }: { params: { rentalId: string } }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()
  const { data: rental } = await supabase
    .from('rentals')
    .select(`
      id, start_datetime, expected_end_datetime,
      total_amount, deposit_amount, deposit_method, daily_rate, total_days, outstanding_credit, status, notes, discount,
      return_type, return_address, send_fuel_full,
      bikes(id, license_plate, brand, model, branch_id, odometer, daily_rate, monthly_rate),
      customers(id, name, phone)
    `)
    .eq('id', params.rentalId)
    .in('status', ['active', 'extended'])
    .single()

  if (!rental) redirect('/staff/home')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rentalBike = (rental as any).bikes
  const promoPayDays = rentalBike ? await getPromoPayDays(supabase, rentalBike.brand, rentalBike.model, rentalBike.branch_id) : 5
  // ราคาปัจจุบันของรถ ใช้คิด "ราคาปกติ" เทียบตอนคืนรถก่อนกำหนด — ต้อง resolve เผื่อรถไม่ได้ override ราคาไว้
  const resolvedRental = rentalBike ? { ...rental, bikes: await resolveSingleBikeRate(supabase, rentalBike) } : rental

  // รูปกำกับราคาน้ำมันของรุ่นนี้ — โชว์ตอนคืนรถไม่เต็ม (เฉพาะกรณีตอนส่งเต็ม)
  const fuelReferencePhotoUrl = rentalBike
    ? (await getBranchModelPricing(supabase, rentalBike.branch_id, rentalBike.brand, rentalBike.model)).fuelReferencePhotoUrl
    : null

  // QR รับเงิน — โชว์เฉพาะตอนมัดจำไม่พอ ต้องเก็บเงินเพิ่มจากลูกค้า
  const { data: branchQr } = rentalBike
    ? await supabase.from('branch_settings').select('payment_qr_daily_url').eq('branch_id', rentalBike.branch_id).maybeSingle()
    : { data: null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (
    <ReturnCarForm
      rental={resolvedRental as any}
      staffId={staffId}
      promoPayDays={promoPayDays}
      fuelReferencePhotoUrl={fuelReferencePhotoUrl}
      qrDailyUrl={branchQr?.payment_qr_daily_url ?? null}
    />
  )
}
