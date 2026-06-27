import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds, getAllowedBikeIds } from '@/lib/staffBranch'
import JobsClient from './JobsClient'

export const dynamic = 'force-dynamic'

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
      .select('id, doc_type, expiry_date, bikes(id, license_plate, brand, model)')
      .lte('expiry_date', in30days)
      .gte('expiry_date', today)
      .limit(20)),

    applyBike(supabase.from('monthly_payments')
      .select('id, due_date, amount, monthly_rental_id, monthly_rentals(id, bike_id, bikes(id, license_plate, brand, model), customers(name), monthly_rate)')
      .in('status', ['pending', 'overdue'])
      .lte('due_date', in30days)
      .limit(20)),

    applyBranch(supabase.from('bookings')
      .select('id, booking_ref, start_datetime, customer_name, customer_phone, total_days, daily_rate, bikes(id, license_plate, brand, model)')
      .eq('status', 'confirmed')
      .gte('start_datetime', in2hAgo)
      .lte('start_datetime', in24h)
      .order('start_datetime', { ascending: true })
      .limit(20)),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overdueRoutines = (routines ?? []).filter((r: any) => {
    const odometer = r.bikes?.odometer ?? 0
    const kmOverdue = r.next_due_km != null && odometer >= r.next_due_km
    const dateOverdue = r.next_due_date != null && r.next_due_dat