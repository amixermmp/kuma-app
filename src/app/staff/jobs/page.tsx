import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds, getAllowedBikeIds } from '@/lib/staffBranch'
import JobsClient from './JobsClient'

export const dynamic = 'force-dynamic'

// Compute next due date from payment_day (day-of-month)
function getNextDueDate(paymentDay: number): Date {
  const now = new Date()
  const todayNum = now.getDate()
  const year = now.getFullYear()
  const month = now.getMonth()

  // Try this month first
  let due = new Date(year, month, paymentDay)
  // If today >= due day, move to next month
  if (todayNum >= paymentDay) {
    due = new Date(year, month + 1, paymentDay)
  }
  return due
}

export default async function JobsPage() {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()
  const now = new Date()
  const nowIso = now.toISOString()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  const today = now.toISOString().split('T')[0]
  const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const in2hAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()

  const allowedBranchIds = await getStaffBranchIds(staffId)
  const allowedBikeIds = await getAllowedBikeIds(allowedBranchIds)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyBranch = (q: any) => allowedBranchIds ? q.in('branch_id', allowedBranchIds) : q
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyBike   = (q: any) => allowedBikeIds   ? q.in('bike_id', allowedBikeIds)     : q

  const [
    { data: overdueRentals },
    { data: dueSoonRentals },
    { data: activeRentals },
    { data: repairs },
    { data: routines },
    { data: docsDue },
    { data: monthlyDue },
    { data: sendJobs },
    { data: allMonthlyActive },
  ] = await Promise.all([
    applyBike(supabase.from('rentals')
      .select('id, expected_end_datetime, bikes(id, license_plate, brand, model), customers(name, phone)')
      .lt('expected_end_datetime', nowIso)
      .in('status', ['active', 'extended'])
      .order('expected_end_datetime', { ascending: true })
      .limit(20)),

    applyBike(supabase.from('rentals')
      .select('id, expected_end_datetime, bikes(id, license_plate, brand, model), customers(name, phone)')
      .gte('expected_end_datetime', nowIso)
      .lte('expected_end_datetime', in24h)
      .in('status', ['active', 'extended'])
      .order('expected_end_datetime', { ascending: true })
      .limit(20)),

    applyBike(supabase.from('rentals')
      .select('id, start_datetime, expected_end_datetime, total_days, daily_rate, total_amount, bikes(id, license_plate, brand, model), customers(name, phone)')
      .in('status', ['active', 'extended'])
      .order('expected_end_datetime', { ascending: true })
      .limit(100)),

    applyBranch(supabase.from('repairs')
      .select('id, title, description, status, created_at, bikes(id, license_plate, brand, model)')
      .in('status', ['pending', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(20)),

    (allowedBikeIds
      ? supabase.from('bike_routines')
          .select('id, task_name, next_due_km, next_due_date, bikes(id, license_plate, brand, model, odometer)')
          .in('bike_id', allowedBikeIds)
          .limit(200)
      : supabase.from('bike_routines')
          .select('id, task_name, next_due_km, next_due_date, bikes(id, license_plate, brand, model, odometer)')
          .limit(200)),

    applyBike(supabase.from('bike_documents')
      .select('id, doc_type, expiry_date, bike_id, bikes(id, license_plate, brand, model)')
      .lte('expiry_date', in30days)
      .gte('expiry_date', today)
      .limit(20)),

    applyBike(supabase.from('monthly_payments')
      .select('id, due_date, amount, monthly_rental_id, monthly_rentals(id, bike_id, bikes(id, license_plate, brand, model), customers(name), monthly_rate)')
      .in('status', ['pending', 'overdue'])
      .lte('due_date', in30days)
      .limit(20)),

    applyBranch(supabase.from('bookings')
      .select('id, booking_ref, start_datetime, customer_name, customer_phone, total_days, daily_rate, requested_brand, requested_model, bikes(id, license_plate, brand, model)')
      .eq('status', 'confirmed')
      .gte('start_datetime', in2hAgo)
      .lte('start_datetime', in24h)
      .order('start_datetime', { ascending: true })
      .limit(20)),

    // All active monthly rentals — to compute upcoming due alerts
    applyBike(supabase.from('monthly_rentals')
      .select('id, bike_id, payment_day, monthly_rate, bikes(id, license_plate, brand, model), customers(name, phone)')
      .eq('status', 'active')
      .limit(100)),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overdueRoutines = (routines ?? []).filter((r: any) => {
    const odometer = r.bikes?.odometer ?? 0
    const kmOverdue = r.next_due_km != null && odometer >= r.next_due_km
    const dateOverdue = r.next_due_date != null && r.next_due_date <= today
    return kmOverdue || dateOverdue
  })

  // Attach nextDueDate to all active monthly rentals
  const todayDate = new Date()
  todayDate.setHours(0, 0, 0, 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allMonthlyRentals = (allMonthlyActive ?? []).map((mr: any) => {
    const nextDue = getNextDueDate(mr.payment_day)
    nextDue.setHours(0, 0, 0, 0)
    const daysUntil = Math.round((nextDue.getTime() - todayDate.getTime()) / 86_400_000)
    return { ...mr, nextDueDate: nextDue.toISOString().split('T')[0], daysUntil }
  })

  // Rental IDs that have actual overdue/unpaid payments in monthly_payments table
  const overdueRentalIds = new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (monthlyDue ?? []).filter((p: any) => p.status === 'overdue' || p.due_date < today)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => p.monthly_rental_id).filter(Boolean)
  )

  // Near-due: 0–2 days from payment_day computation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nearDueAlerts = allMonthlyRentals
    .filter((mr: any) => mr.daysUntil >= 0 && mr.daysUntil <= 2)
    .sort((a: any, b: any) => a.daysUntil - b.daysUntil)

  const nearDueIds = new Set(nearDueAlerts.map((mr: any) => mr.id)) // eslint-disable-line @typescript-eslint/no-explicit-any

  // Overdue: has unpaid payment record but isn't already in near-due
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overdueAlerts = allMonthlyRentals
    .filter((mr: any) => overdueRentalIds.has(mr.id) && !nearDueIds.has(mr.id))
    .map((mr: any) => ({ ...mr, daysUntil: -1 })) // eslint-disable-line @typescript-eslint/no-explicit-any

  const monthlyContactAlerts = [...overdueAlerts, ...nearDueAlerts]

  return (
    <JobsClient
      sendJobs={sendJobs ?? []}
      overdueRentals={overdueRentals ?? []}
      dueSoonRentals={dueSoonRentals ?? []}
      activeRentals={activeRentals ?? []}
      repairs={repairs ?? []}
      overdueRoutines={overdueRoutines}
      docsDue={docsDue ?? []}
      monthlyDue={monthlyDue ?? []}
      monthlyContactAlerts={monthlyContactAlerts}
      allMonthlyRentals={allMonthlyRentals}
    />
  )
}
