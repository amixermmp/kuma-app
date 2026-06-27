import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds } from '@/lib/staffBranch'
import Link from 'next/link'
import FleetClient from './FleetClient'

export const dynamic = 'force-dynamic'

export default async function StaffFleetPage() {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()

  const allowedBranchIds = await getStaffBranchIds(staffId)

  // ดึงรถตามสาขาที่อนุญาต
  let bikeQuery = supabase
    .from('bikes')
    .select('id, license_plate, brand, model, color, year, status, daily_rate, photo_url')
    .neq('status', 'retired')
    .order('license_plate')

  if (allowedBranchIds) {
    bikeQuery = bikeQuery.in('branch_id', allowedBranchIds)
  }

  const { data: bikes } = await bikeQuery
  const list = bikes ?? []

  // ชื่อสาขาสำหรับ header
  let branchName = 'ทุกสาขา'
  if (allowedBranchIds) {
    const { data: branches } = await supabase.from('branches').select('name').in('id', allowedBranchIds)
    branchName = branches?.map(b => b.name).join(', ') ?? 'สาขา'
  }

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a8a)' }}>
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div style={{ flex: 1 }}>
          <h1>รวมรถ</h1>
          <div className="sub">{branchName} • {list.length} คัน</div>
        </div>
      </div>

      <FleetClient bikes={list} />
    </div>
  )
}
