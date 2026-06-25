import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import CollectRentForm from './CollectRentForm'

export const dynamic = 'force-dynamic'

const MONTH_NAMES = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

export default async function CollectRentPage({ params }: { params: Promise<{ rentalId: string }> }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const { rentalId } = await params
  const supabase = createAdminClient()

  const [{ data: rental }, { data: collections }] = await Promise.all([
    supabase
      .from('rentals')
      .select(`
        id, start_datetime, daily_rate, total_amount, status,
        bikes(id, license_plate, brand, model),
        customers(id, name, phone, workplace)
      `)
      .eq('id', rentalId)
      .in('status', ['active', 'extended'])
      .single(),
    supabase
      .from('monthly_collections')
      .select('*')
      .eq('rental_id', rentalId)
      .order('created_at', { ascending: true }),
  ])

  if (!rental) redirect('/staff/home')

  // Calculate current period
  const startDate = new Date(rental.start_datetime)
  const now = new Date()
  const monthsElapsed =
    (now.getFullYear() - startDate.getFullYear()) * 12 +
    (now.getMonth() - startDate.getMonth())
  const currentPeriodNum = monthsElapsed + 1

  const dueDate = new Date(startDate)
  dueDate.setMonth(startDate.getMonth() + monthsElapsed)

  const thYear = dueDate.getFullYear() + 543
  const periodLabel = `เดือนที่ ${currentPeriodNum} — ${MONTH_NAMES[dueDate.getMonth()]} ${thYear}`

  const monthlyRate = rental.daily_rate * 30
  const totalCollected = (collections ?? []).reduce((s, c) => s + Number(c.amount_paid), 0)

  // Find current period record
  const currentPeriodRecord = (collections ?? []).find(c => c.period_label === periodLabel)
  const currentPaidAmt = currentPeriodRecord ? Number(currentPeriodRecord.amount_paid) : 0
  const fullyPaid = currentPeriodRecord?.status === 'paid'

  // Overdue: past due date and not fully paid
  const isOverdue = !fullyPaid && now > dueDate

  return (
    <CollectRentForm
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rental={rental as any}
      collections={(collections ?? []) as any[]}
      staffId={staffId}
      currentPeriodNum={currentPeriodNum}
      periodLabel={periodLabel}
      dueDate={dueDate.toISOString().split('T')[0]}
      monthlyRate={monthlyRate}
      totalCollected={totalCollected}
      currentPaidAmt={currentPaidAmt}
      fullyPaid={fullyPaid}
      isOverdue={isOverdue}
    />
  )
}
