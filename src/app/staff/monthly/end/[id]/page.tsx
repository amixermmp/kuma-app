import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import MonthlyEndClient from './MonthlyEndClient'

export const dynamic = 'force-dynamic'

export default async function MonthlyEndPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const { id } = await params
  const supabase = createAdminClient()

  const [{ data: rental }, { data: payments }] = await Promise.all([
    supabase
      .from('monthly_rentals')
      .select(`
        id, start_date, payment_day, monthly_rate, deposit_amount, status,
        bikes(id, license_plate, brand, model, odometer, daily_rate, monthly_rate),
        customers(id, name, phone)
      `)
      .eq('id', id)
      .eq('status', 'active')
      .single(),
    supabase
      .from('monthly_payments')
      .select('due_date, amount, status')
      .eq('monthly_rental_id', id)
      .is('voided_at', null)
      .in('status', ['paid', 'partial']),
  ])

  if (!rental) redirect('/staff/home')

  const totalCollected = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0)

  const startDate = new Date(rental.start_date)
  const now = new Date()
  const monthsRented =
    (now.getFullYear() - startDate.getFullYear()) * 12 +
    (now.getMonth() - startDate.getMonth()) + 1

  // งวดปัจจุบันที่จ่ายไปแล้ว (due_date ล่าสุด) — ใช้หาว่าคืนรถก่อนครบงวดไหม
  const dueDates = Array.from(new Set((payments ?? []).map(p => p.due_date))).sort()
  const periodEnd = dueDates[dueDates.length - 1] ?? null
  const periodStart = dueDates.length >= 2 ? dueDates[dueDates.length - 2] : rental.start_date
  const periodPaidAmount = periodEnd
    ? (payments ?? []).filter(p => p.due_date === periodEnd).reduce((s, p) => s + Number(p.amount), 0)
    : 0

  return (
    <MonthlyEndClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rental={rental as any}
      totalCollected={totalCollected}
      monthsRented={monthsRented}
      periodStart={periodStart}
      periodEnd={periodEnd}
      periodPaidAmount={periodPaidAmount}
      staffId={staffId}
    />
  )
}
