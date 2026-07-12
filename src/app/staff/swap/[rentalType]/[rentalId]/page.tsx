import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds } from '@/lib/staffBranch'
import SwapForm from './SwapForm'

export const dynamic = 'force-dynamic'

export default async function SwapPage({
  params,
}: {
  params: Promise<{ rentalType: string; rentalId: string }>
}) {
  const { rentalType, rentalId } = await params
  if (rentalType !== 'daily' && rentalType !== 'monthly') notFound()

  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()
  const allowedBranchIds = await getStaffBranchIds(staffId)

  // ── Load rental ─────────────────────────────────────────────────────────────
  let rental: {
    id: string
    bike_id: string
    branch_id: string
    bikes: { id: string; license_plate: string; brand: string; model: string; branch_id: string }
    customers: { name: string; phone: string | null }
    label: string            // "฿X/วัน" or "฿X/เดือน"
    swap_log?: { date: string; from_plate: string; to_plate: string; type: string; reason: string | null }[]
  }

  if (rentalType === 'monthly') {
    const { data, error } = await supabase
      .from('monthly_rentals')
      .select('id, bike_id, branch_id, monthly_rate, payment_day, swap_log, bikes(id, license_plate, brand, model, branch_id), customers(name, phone)')
      .eq('id', rentalId)
      .eq('status', 'active')
      .single()

    if (error || !data) notFound()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rental = { ...data, bikes: data.bikes as any, customers: data.customers as any, label: `฿${Number(data.monthly_rate).toLocaleString()}/เดือน`, swap_log: Array.isArray(data.swap_log) ? data.swap_log : [] }
  } else {
    const { data, error } = await supabase
      .from('rentals')
      .select('id, bike_id, branch_id, daily_rate, total_days, expected_end_datetime, bikes(id, license_plate, brand, model, branch_id), customers(name, phone)')
      .eq('id', rentalId)
      .in('status', ['active', 'extended'])
      .single()

    if (error || !data) notFound()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rental = { ...data, bikes: data.bikes as any, customers: data.customers as any, label: `฿${Number(data.daily_rate).toLocaleString()}/วัน` }
  }

  // Check branch access — ยึดสาขาที่ "รถ" อยู่จริง (ตรงกับที่ Job Tasks ใช้โชว์การ์ด)
  // กันเคส branch ของสัญญาไม่ตรงกับรถ (เช่น เคยสลับรถข้ามสาขา)
  const bikeBranchId = rental.bikes.branch_id ?? rental.branch_id
  if (allowedBranchIds !== null && !allowedBranchIds.includes(bikeBranchId)) notFound()

  const currentBikeId = rental.bikes.id

  // ── Available bikes (สาขาเดียวกับรถ, ไม่ใช่คันปัจจุบัน) ──────────────────────
  const { data: availableBikes } = await supabase
    .from('bikes')
    .select('id, license_plate, brand, model, daily_rate')
    .eq('branch_id', bikeBranchId)
    .eq('status', 'available')
    .neq('id', currentBikeId)
    .order('license_plate')

  // ── Pending bookings on old bike (queue) ────────────────────────────────────
  const nowIso = new Date().toISOString()
  const { data: pendingBookings } = await supabase
    .from('bookings')
    .select('id, booking_ref, customer_name, customer_phone, start_datetime, end_datetime, total_days, daily_rate')
    .eq('bike_id', currentBikeId)
    .eq('status', 'confirmed')
    .gte('start_datetime', nowIso)
    .order('start_datetime', { ascending: true })

  return (
    <SwapForm
      rentalType={rentalType as 'daily' | 'monthly'}
      rental={rental}
      availableBikes={availableBikes ?? []}
      pendingBookings={pendingBookings ?? []}
    />
  )
}
