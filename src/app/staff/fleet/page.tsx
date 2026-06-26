import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import FleetClient from './FleetClient'

export const dynamic = 'force-dynamic'

export default async function StaffFleetPage() {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()

  // ดึง branch ของ staff
  const { data: staffRow } = await supabase
    .from('staff')
    .select('branch_id, branches(name)')
    .eq('id', staffId)
    .single()

  if (!staffRow?.branch_id) redirect('/staff/home')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const branchName = (staffRow as any).branches?.name ?? 'สาขา'

  // ดึงรถในสาขาเดียวกัน (ยกเว้น retired)
  const { data: bikes } = await supabase
    .from('bikes')
    .select('id, license_plate, brand, model, color, year, status, daily_rate, photo_url')
    .eq('branch_id', staffRow.branch_id)
    .neq('status', 'retired')
    .order('license_plate')

  const list = bikes ?? []

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
