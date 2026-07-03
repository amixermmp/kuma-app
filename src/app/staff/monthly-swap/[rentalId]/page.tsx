import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds } from '@/lib/staffBranch'
import SwapForm from './SwapForm'

export const dynamic = 'force-dynamic'

export default async function MonthlySwapPage({ params }: { params: Promise<{ rentalId: string }> }) {
  const { rentalId } = await params
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()

  const { data: rental, error } = await supabase
    .from('monthly_rentals')
    .select('id, monthly_rate, payment_day, branch_id, swap_log, bikes(id, license_plate, brand, model), customers(name, phone)')
    .eq('id', rentalId)
    .eq('status', 'active')
    .single()

  if (error || !rental) notFound()

  // Get available bikes in same branch, excluding current bike
  const { data: availableBikes } = await supabase
    .from('bikes')
    .select('id, license_plate, brand, model, daily_rate')
    .eq('branch_id', rental.branch_id)
    .eq('status', 'available')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .neq('id', (rental.bikes as any)?.id ?? '')
    .order('license_plate')

  // Verify staff has access to this branch
  const allowedBranchIds = await getStaffBranchIds(staffId)
  if (allowedBranchIds !== null && !allowedBranchIds.includes(rental.branch_id)) notFound()

  return (
    <SwapForm
      rental={{
        ...rental,
        swap_log: Array.isArray(rental.swap_log) ? rental.swap_log : [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bikes: rental.bikes as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        customers: rental.customers as any,
      }}
      availableBikes={availableBikes ?? []}
    />
  )
}
