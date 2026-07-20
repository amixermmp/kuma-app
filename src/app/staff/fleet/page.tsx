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
    .order('status')
    .order('license_plate')

  if (allowedBranchIds) {
    bikeQuery = bikeQuery.in('branch_id', allowedBranchIds)
  }

  const { data: bikes } = await bikeQuery

  // Cross-check: ถ้ารถมี monthly_rental active อยู่ แต่ status ยังเป็น available → แก้ในหน้านี้
  // (และ patch ฐานข้อมูลไปด้วยเพื่อความถูกต้อง)
  const bikeIds = (bikes ?? []).map((b: any) => b.id) // eslint-disable-line @typescript-eslint/no-explicit-any
  let rentedByMonthly = new Set<string>()
  if (bikeIds.length > 0) {
    const { data: activeMonthly } = await supabase
      .from('monthly_rentals')
      .select('bike_id')
      .eq('status', 'active')
      .in('bike_id', bikeIds)
    if (activeMonthly && activeMonthly.length > 0) {
      rentedByMonthly = new Set(activeMonthly.map((r: any) => r.bike_id)) // eslint-disable-line @typescript-eslint/no-explicit-any
      // Auto-heal: อัพเดท status ให้ถูกต้องในฐานข้อมูล
      const staleIds = activeMonthly
        .map((r: any) => r.bike_id) // eslint-disable-line @typescript-eslint/no-explicit-any
        .filter((id: string) => bikes?.find((b: any) => b.id === id && b.status === 'available')) // eslint-disable-line @typescript-eslint/no-explicit-any
      if (staleIds.length > 0) {
        await supabase.from('bikes').update({ status: 'rented' }).in('id', staleIds)
      }
    }
  }

  const list = (bikes ?? []).map((b: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    ...b,
    status: rentedByMonthly.has(b.id) ? 'rented' : b.status,
  }))

  // ชื่อสาขาสำหรับ header
  let branchName = 'ทุกสาขา'
  if (allowedBranchIds) {
    const { data: branches } = await supabase.from('branches').select('name').in('id', allowedBranchIds)
    branchName = branches?.map(b => b.name).join(', ') ?? 'สาขา'
  }

  return (
    <div className="app-wrap" style={{ background: '#f8fafc' }}>
      <div style={{
        background: 'var(--red)', color: '#fff',
        padding: '16px', display: 'flex', alignItems: 'center', gap: '12px',
        borderRadius: '0 0 22px 22px',
      }}>
        <Link href="/staff/home" style={{
          background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff',
          width: '32px', height: '32px', borderRadius: '50%', fontSize: '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
        }}>←</Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '17px', fontWeight: 700 }}>รวมรถ</div>
          <div style={{ fontSize: '12px', opacity: .8, marginTop: '2px' }}>{branchName} • {list.length} คัน</div>
        </div>
      </div>

      <FleetClient bikes={list} />
    </div>
  )
}
