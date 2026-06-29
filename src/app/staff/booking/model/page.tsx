import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
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

  return (
    <BookingModelForm
      brand={brand}
      model={model}
      dailyRate={parseInt(rate)}
      from={from}
      to={to}
      staffId={staffId}
    />
  )
}
