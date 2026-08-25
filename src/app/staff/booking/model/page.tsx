import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPromoPayDays, getBranchModelPricing } from '@/lib/bikeCatalog'
import { getStaffOwnBranchId } from '@/lib/staffBranch'
import BookingModelForm from './BookingModelForm'

export const dynamic = 'force-dynamic'

export default async function BookingModelPage({
  searchParams,
}: {
  searchParams: { brand?: string; model?: string; rate?: string; from?: string; to?: string }
}) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const { brand, model, rate, from, to } = searchParams
  if (!brand || !model || !rate || !from || !to) redirect('/staff/search')

  // เรทรายเดือนมาตรฐานของรุ่นนี้ที่สาขานี้ — ใช้คิด cap รายเดือนให้ตรงกับหน้าส่งรถ
  const admin = createAdminClient()
  const staffBranchId = await getStaffOwnBranchId(staffId)
  const [standard, promoPayDays] = await Promise.all([
    getBranchModelPricing(admin, staffBranchId ?? '', brand, model),
    getPromoPayDays(admin, brand, model, staffBranchId),
  ])

  return (
    <BookingModelForm
      brand={brand}
      model={model}
      dailyRate={parseInt(rate)}
      monthlyRate={standard.monthlyRate ?? parseInt(rate) * 30}
      from={from}
      to={to}
      staffId={staffId}
      promoPayDays={promoPayDays}
    />
  )
}
