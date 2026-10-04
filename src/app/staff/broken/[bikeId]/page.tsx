import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import BrokenForm from './BrokenForm'

export const dynamic = 'force-dynamic'

export default async function BrokenPage({ params }: { params: { bikeId: string } }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()
  const { data: bike } = await supabase
    .from('bikes')
    .select('id, license_plate, brand, model, status')
    .eq('id', params.bikeId)
    .single()

  if (!bike) redirect('/staff/broken')

  // กันแจ้งซ้ำ — ถ้ารถคันนี้มีงานซ่อมเปิดค้างอยู่แล้ว (เข้าตรงผ่าน URL เก่าข้าม picker มา) พาไปหน้างานซ่อมเดิมแทน
  const { data: openRepair } = await supabase
    .from('repairs')
    .select('id')
    .eq('bike_id', params.bikeId)
    .eq('status', 'in_progress')
    .maybeSingle()
  if (openRepair) redirect(`/staff/repair/${openRepair.id}`)

  // รถที่กำลังถูกเช่า — ซ่อมใหญ่ไม่ได้ ต้องสลับรถให้ลูกค้าก่อน (พาไปหน้าสลับรถของสัญญานั้น)
  const [{ data: dailyRental }, { data: monthlyRental }] = await Promise.all([
    supabase.from('rentals').select('id').eq('bike_id', params.bikeId).in('status', ['active', 'extended']).limit(1).maybeSingle(),
    supabase.from('monthly_rentals').select('id').eq('bike_id', params.bikeId).eq('status', 'active').limit(1).maybeSingle(),
  ])
  const swapHref = dailyRental ? `/staff/swap/daily/${dailyRental.id}` : monthlyRental ? `/staff/swap/monthly/${monthlyRental.id}` : null

  return <BrokenForm bike={bike} staffId={staffId} swapHref={swapHref} />
}
