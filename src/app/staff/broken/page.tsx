import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  available: 'ว่าง',
  rented: 'ถูกเช่า',
  repair: 'ซ่อมอยู่',
}
const STATUS_COLOR: Record<string, string> = {
  available: '#16a34a',
  rented: '#2563eb',
  repair: '#dc2626',
}

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

      <div style={{ padding: '12px' }}>
        {(!bikes || bikes.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
            ไม่มีรถที่พร้อมแจ้งซ่อม
          </div>
        ) : bikes.map(bike => (
          <Link key={bike.id} href={`/staff/broken/${bike.id}`} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            background: '#fff', borderRadius: '12px', padding: '14px',
            marginBottom: '10px', textDecoration: 'none', color: 'inherit',
            border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,.06)',
          }}>
            <span style={{ fontSize: '28px' }}>🛵</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>
                {bike.license_plate}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                {bike.brand} {bike.model}
              </div>
            </div>
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '3px 10px',
              borderRadius: '20px', background: `${STATUS_COLOR[bike.status]}20`,
              color: STATUS_COLOR[bike.status],
            }}>
              {STATUS_LABEL[bike.status] ?? bike.status}
            </span>
            <span style={{ color: '#9ca3af', fontSize: '20px' }}>›</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
