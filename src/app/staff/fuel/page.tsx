import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds } from '@/lib/staffBranch'
import FuelSections from './FuelSections'

export const dynamic = 'force-dynamic'

export default async function StaffFuelPage() {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()
  const allowedBranchIds = await getStaffBranchIds(staffId)

  // เฉพาะรถ "ว่าง" (จอดอยู่ในร้านจริง) เท่านั้นที่เช็คน้ำมันได้ — คันที่ถูกเช่าอยู่ไม่ได้อยู่ในร้าน
  let bikeQuery = supabase
    .from('bikes')
    .select('id, license_plate, brand, model, branch_id, fuel_level')
    .eq('status', 'available')
    .order('license_plate', { ascending: true })

  if (allowedBranchIds) {
    bikeQuery = bikeQuery.in('branch_id', allowedBranchIds)
  }

  const { data: bikes } = await bikeQuery

  return (
    <div className="app-wrap">
      <div className="app-header">
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div>
          <h1>ภาพรวมน้ำมัน</h1>
          <div className="sub">รถว่างในร้าน {bikes?.length ?? 0} คัน</div>
        </div>
      </div>

      <FuelSections bikes={bikes ?? []} />
    </div>
  )
}
