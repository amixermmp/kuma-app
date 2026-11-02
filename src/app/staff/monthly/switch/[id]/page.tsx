import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadSwitchContext } from '@/lib/dailySwitchServer'
import SwitchToDailyClient from './SwitchToDailyClient'

export const dynamic = 'force-dynamic'

export default async function SwitchToDailyPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const { id } = await params
  const supabase = createAdminClient()

  const ctx = await loadSwitchContext(supabase, id)
  if (!ctx) redirect('/staff/home')

  return (
    <SwitchToDailyClient
      ctx={{
        monthlyId: ctx.monthlyId,
        customer: ctx.customer,
        isThaiId: ctx.isThaiId,
        bike: ctx.bike,
        today: ctx.today,
        dealStart: ctx.dealStart,
        lateDays: ctx.lateDays,
        blockReason: ctx.blockReason,
        pickupDefault: ctx.pickupDefault,
        promoPayDays: ctx.promoPayDays,
        heldDeposit: ctx.heldDeposit,
        hasAccommodationProof: ctx.hasAccommodationProof,
        hasStudentIdPhoto: ctx.hasStudentIdPhoto,
        student: ctx.student,
      }}
    />
  )
}
