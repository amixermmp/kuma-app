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
      .select('id, expected_end_datetime, bikes(id, license_plate, brand, model, color, photo_url), customers(name, phone)')
      .lt('expected_end_datetime', nowIso)
      .in('status', ['active', 'extended'])
      .order('expected_end_datetime', { ascending: true })
      .limit(20)),

    applyBike(supabase.from('rentals')
      .select('id, expected_end_datetime, bikes(id, license_plate, brand, model, color, photo_url), customers(name, phone)')
      .gte('expected_end_datetime', nowIso)
      .lte('expected_end_datetime', in24h)
      .in('status', ['active', 'extended'])
      .order('expected_end_datetime', { ascending: true })
      .limit(20)),

    applyBike(supabase.from('rentals')
      .select('id, start_datetime, expected_end_datetime, total_days, daily_rate, total_amount, bikes(id, license_plate, brand, model, color, photo_url), customers(name, phone)')
      .in('status', ['active', 'extended'])
      .order('expected_end_datetime', { ascending: true })
      .limit(100)),

    applyBranch(supabase.from('repairs')
      .select('id, title, description, status, created_at, bikes(id, license_plate, brand, model, color, photo_url)')
      .in('status', ['pending', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(20)),

    (allowedBikeIds
      ? supabase.from('bike_routines')
          .select('id, task_name, next_due_km, next_due_date, bikes(id, license_plate, brand, model, odometer, color, photo_url)')
          .in('bike_id', allowedBikeIds)
          .limit(200)
      : supabase.from('bike_routines')
          .select('id, task_name, next_due_km, next_due_date, bikes(id, license_plate, brand, model, odometer, color, photo_url)')
          .limit(200)),

    applyBike(supabase.from('bike_documents')
      .select('id, doc_type, expiry_date, bike_id, bikes(id, license_plate, brand, model, color, photo_url)')
      .lte('expiry_date', in30days)
      .gte('expiry_date', today)
      .limit(20)),

    applyBike(supabase.from('monthly_payments')
      .select('id, due_date, amount, monthly_rental_id, monthly_rentals(id, bike_id, bikes(id, license_plate, brand, model, color, photo_url), customers(name), monthly_rate)')
      .in('status', ['pending', 'overdue'])
      .lte('due_date', in30days)
      .limit(20)),

    applyBranch(supabase.from('bookings')
      .select('id, booking_ref, start_datetime, customer_name, customer_phone, total_days, daily_rate, requested_brand, requested_model, bikes(id, license_plate, brand, model, color, photo_url)')
      .eq('status', 'confirmed')
      .order('start_datetime', { ascending: true })
      .limit(100)),

    // All active monthly rentals — to compute upcoming due alerts
    applyBike(supabase.from('monthly_rentals')
      .select('id, bike_id, start_date, payment_day, monthly_rate, bikes(id, license_plate, brand, model, color, photo_url), customers(name, phone)')
      .eq('status', 'active')
      .limit(100)),
  ])

  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overdueRoutines = (routines ?? []).filter((r: any) => {
    const odometer = r.bikes?.odometer ?? 0
    // km-based: แจ้งเมื่อเลยกำหนดแล้ว
    if (r.next_due_km != null && odometer >= r.next_due_km) return true
    // date-based: แจ้งก่อน 7 วัน
    if (r.next_due_date != null && r.next_due_date <= in7days) return true
    return false
  }).sort((a: any, b: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    // เรียงจากเร่งด่วนที่สุดก่อน
    const dA = a.next_due_date ?? '9999-99-99'
    const dB = b.next_due_date ?? '9999-99-99'
    return dA.localeCompare(dB)
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

  // ── แจ้งเตือนติดต่อลูกค้ารายเดือน ──
  // โชว์ตั้งแต่ 2 วันก่อนครบกำหนด แล้ว "อยู่ต่อไปเรื่อยๆ" (แม้เกินกำหนด) จนกว่าจะเก็บเงินรอบนั้นได้
  // หรือปิดสัญญา (สัญญาที่ ended จะหลุดจาก allMonthlyActive เอง)
  // "วันนี้" ตามเวลาไทย แล้วคำนวณด้วยเลข component ล้วน (ไม่พึ่ง timezone เซิร์ฟเวอร์)
  const bkkTodayStr = new Date(Date.now() + 7 * 3_600_000).toISOString().split('T')[0]
  const [ty, tm, tdd] = bkkTodayStr.split('-').map(Number)
  const todayMs = Date.UTC(ty, tm - 1, tdd)
  const cutoffMs = todayMs + 2 * 86_400_000 // ถึงก่อน 2 วัน

  // วันครบกำหนด "รอบปัจจุบัน" (รอบล่าสุดที่ถึง/ใกล้ถึง) — อิงวันเริ่ม+payment_day ตรงกับหน้าเก็บเงิน
  const currentCycleDue = (startDateStr: string, paymentDay: number): { due: string; daysUntil: number } | null => {
    if (!startDateStr) return null
    const [sy, sm, sd] = String(startDateStr).split('-').map(Number)
    const pd = paymentDay ?? sd
    const offset = pd < sd ? 1 : 0
    let last: { ms: number; str: string } | null = null
    for (let i = 0; i < 600; i++) {
      const tot = (sm - 1) + i + offset
      const y = sy + Math.floor(tot / 12)
      const m = ((tot % 12) + 12) % 12
      const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
      const day = Math.min(pd, dim)
      const ms = Date.UTC(y, m, day)
      if (ms > cutoffMs) break
      last = { ms, str: `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` }
    }
    if (!last) return null
    return { due: last.str, daysUntil: Math.round((last.ms - todayMs) / 86_400_000) }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contactCandidates = (allMonthlyActive ?? []).map((mr: any) => {
    const cyc = currentCycleDue(mr.start_date, mr.payment_day)
    if (!cyc) return null
    return { ...mr, nextDueDate: cyc.due, daysUntil: cyc.daysUntil }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }).filter(Boolean) as any[]

  // ตัดตัวที่เก็บเงินรอบนั้นแล้ว (มี record status=paid ตรง due_date)
  const candIds = contactCandidates.map(m => m.id)
  let paidPairs = new Set<string>()
  if (candIds.length > 0) {
    const { data: paid } = await supabase
      .from('monthly_payments')
      .select('monthly_rental_id, due_date')
      .eq('status', 'paid')
      .is('voided_at', null)
      .in('monthly_rental_id', candIds)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paidPairs = new Set((paid ?? []).map((p: any) => `${p.monthly_rental_id}|${p.due_date}`))
  }

  const monthlyContactAlerts = contactCandidates
    .filter(m => !paidPairs.has(`${m.id}|${m.nextDueDate}`))
    .sort((a, b) => a.daysUntil - b.daysUntil)

  return (
    <JobsClient
      sendJobs={sendJobs ?? []}
      overdueRentals={overdueRentals ?? []}
      dueSoonRentals={dueSoonRentals ?? []}
      activeRentals={activeRentals ?? []}
      repairs={repairs ?? []}
      overdueRoutines={overdueRoutines}
      docsDue={docsDue ?? []}
      monthlyContactAlerts={monthlyContactAlerts}
      allMonthlyRentals={allMonthlyRentals}
    />
  )
}
