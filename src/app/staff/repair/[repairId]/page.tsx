import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import RepairDoneForm from './RepairDoneForm'

export const dynamic = 'force-dynamic'

export default async function RepairDonePage({ params }: { params: { repairId: string } }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()
  const { data: repair } = await supabase
    .from('repairs')
    .select('id, title, description, status, created_at, bikes(id, license_plate, brand, model)')
    .eq('id', params.repairId)
    .single()

  if (!repair || repair.status === 'done') redirect('/staff/jobs')

  // ตรวจว่ารถคันนี้ถูก temp swap ออกมาไหม (monthly_rental swap_log)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bikeId = (repair.bikes as any)?.id as string | undefined
  let isFromSwap = false
  if (bikeId) {
    const { data: monthlyWithSwap } = await supabase
      .from('monthly_rentals')
      .select('swap_log')
      .eq('status', 'active')
      .not('swap_log', 'is', null)
      .limit(100)

    isFromSwap = (monthlyWithSwap ?? []).some((mr: { swap_log: unknown }) => {
      const log = Array.isArray(mr.swap_log) ? mr.swap_log : []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return log.some((e: any) => e.from_bike_id === bikeId && e.type === 'temp')
    })
  }

  return <RepairDoneForm repair={repair as any} staffId={staffId} isFromSwap={isFromSwap} />
}
