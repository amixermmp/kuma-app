import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
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

  // เรทรายเดือนของรุ่นนี้ — ใช้คิด cap รายเดือนให้ตรงกับหน้าส่งรถ
  const admin = createAdminClient()
  const { data: bikeRow } = await admin
    .from('bikes')
    .select('monthly_rate')
    .eq('brand', brand)
    .eq('model', model)
    .not('monthly_rate', 'is', null)
    .limit(1)
    .maybeSingle()

  return (
    <BookingModelForm
      brand={brand}
      model={model}
      dailyRate={parseInt(rate)}
      monthlyRate={bikeRow?.monthly_rate ?? parseInt(rate) * 30}
      from={from}
      to={to}
      staffId={staffId}
    />
  )
}
