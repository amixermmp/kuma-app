import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import BikeSelectClient from '@/components/staff/BikeSelectClient'

export const dynamic = 'force-dynamic'

export default async function BrokenSelectPage() {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()
  const { data: bikes } = await supabase
    .from('bikes')
    .select('id, license_plate, brand, model, status')
    .neq('status', 'repair')
    .order('license_plate')

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: '#dc2626' }}>
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div>
          <h1>แจ้งรถเสีย</h1>
          <div className="sub">เลือกรถที่มีปัญหา</div>
        </div>
      </div>

      {(!bikes || bikes.length === 0) ? (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: '#9ca3af', fontSize: '14px' }}>
          ไม่มีรถที่พร้อมแจ้งซ่อม
        </div>
      ) : (
        <BikeSelectClient bikes={bikes} hrefTemplate="/staff/broken/{id}" />
      )}
    </div>
  )
}
