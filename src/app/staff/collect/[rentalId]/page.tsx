import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getApplicableMonthlyRate } from '@/lib/monthlyRate'
import CollectRentForm from './CollectRentForm'

export const dynamic = 'force-dynamic'

const MONTH_NAMES = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

function getDueDate(startDate: Date, periodIndex: number, paymentDay: number): Date {
  // If payment_day < start day-of-month, first due date is in the next month
  const offset = paymentDay < startDate.getDate() ? 1 : 0
  const d = new Date(startDate)
  d.setMonth(d.getMonth() + periodIndex + offset)
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(paymentDay, daysInMonth))
  return d
}

export default async function CollectRentPage({ params }: { params: Promise<{ rentalId: string }> }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const { rentalId } = await params
  const supabase = createAdminClient()

  const [{ data: rental }, { data: payments }] = await Promise.all([
    supabase
      .from('monthly_rentals')
      .select(`
        id, start_date, payment_day, monthly_rate, deposit_amount, status, swap_log,
        bikes(id, license_plate, brand, model),
        customers(id, name, phone, workplace)
      `)
      .eq('id', rentalId)
      .eq('status', 'active')
      .single(),
    supabase
      .from('monthly_payments')
      .select('*')
      .eq('monthly_rental_id', rentalId)
      .is('voided_at', null)
      .order('paid_date', { ascending: true }),
  ])

  if (!rental) redirect('/staff/home')

  const startDate = new Date(rental.start_date)
  const paymentDay = rental.payment_day ?? startDate.getDate()
  const now = new Date()

  // Generate all periods from start until next month
  const monthsElapsed =
    (now.getFullYear() - startDate.getFullYear()) * 12 +
    (now.getMonth() - startDate.getMonth())
  const totalPeriods = monthsElapsed + 1 // include current month

  // Build period list with payment data
  const periods = Array.from({ length: totalPeriods }, (_, i) => {
    const dueDate = getDueDate(startDate, i, paymentDay)
    const dueDateStr = dueDate.toISOString().split('T')[0]
    const thYear = dueDate.getFullYear() + 543
    const label = `เดือนที่ ${i + 1} — ${MONTH_NAMES[dueDate.getMonth()]} ${thYear}`

    // เคยสลับรถหลังรอบนี้กำหนดชำระไปแล้วไหม — ถ้าใช่ใช้ราคาเดิมตอนนั้น ไม่ใช่ราคาใหม่ที่อาจแพงกว่า
    const periodRate = getApplicableMonthlyRate(rental.monthly_rate, rental.swap_log, dueDateStr)
    const periodPayments = (payments ?? []).filter(p => p.due_date === dueDateStr)
    const totalPaid = periodPayments.reduce((s, p) => s + Number(p.amount), 0)
    const fullyPaid = totalPaid >= periodRate
    const isOverdue = !fullyPaid && now > dueDate

    return {
      periodNum: i + 1,
      dueDate: dueDateStr,
      label,
      payments: periodPayments,
      totalPaid,
      periodRate,
      fullyPaid,
      isOverdue,
    }
  })

  // Current period = first unpaid, or last if all paid
  const currentPeriod = periods.find(p => !p.fullyPaid) ?? periods[periods.length - 1]
  const totalCollected = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0)

  return (
    <CollectRentForm
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rental={rental as any}
      periods={periods}
      currentPeriod={currentPeriod}
      staffId={staffId}
      totalCollected={totalCollected}
    />
  )
}
