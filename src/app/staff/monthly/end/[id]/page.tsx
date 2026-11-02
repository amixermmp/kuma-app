import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadMonthlySettlement } from '@/lib/monthlySettlementServer'
import { isThaiIdNumber } from '@/lib/customer'
import MonthlyEndClient from './MonthlyEndClient'

export const dynamic = 'force-dynamic'

export default async function MonthlyEndPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const { id } = await params
  const supabase = createAdminClient()

  // ใบสรุปคิดที่ฝั่งเซิร์ฟเวอร์ด้วยตัวคิดตัวเดียวกับ API จบสัญญา (API คิดซ้ำอีกรอบตอนกดยืนยัน)
  const loaded = await loadMonthlySettlement(supabase, id)
  if (!loaded) redirect('/staff/home')
  const { rental, customer, currentBike, formulaBike, settlement, totalCollected, depositCash } = loaded

  const startDate = new Date(rental.start_date)
  const now = new Date()
  const monthsRented =
    (now.getFullYear() - startDate.getFullYear()) * 12 +
    (now.getMonth() - startDate.getMonth()) + 1

  return (
    <MonthlyEndClient
      rental={{
        id: rental.id,
        start_date: rental.start_date,
        payment_day: rental.payment_day,
        monthly_rate: Number(rental.monthly_rate),
        deposit_amount: Number(rental.deposit_amount) || 0,
        deposit_method: rental.deposit_method ?? null,
      }}
      bike={{
        license_plate: currentBike.license_plate,
        brand: currentBike.brand,
        model: currentBike.model,
        odometer: currentBike.odometer ?? 0,
      }}
      customer={{ name: customer?.name ?? '', phone: customer?.phone ?? '' }}
      settlement={settlement}
      formulaBike={formulaBike}
      depositCash={depositCash}
      totalCollected={totalCollected}
      monthsRented={monthsRented}
      isThaiId={isThaiIdNumber(customer?.id_card_number ?? '')}
    />
  )
}
