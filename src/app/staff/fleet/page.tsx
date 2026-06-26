import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  available: 'ว่าง',
  rented:    'เช่าอยู่',
  repair:    'ซ่อม',
  retired:   'เลิกใช้',
}
const STATUS_COLOR: Record<string, string> = {
  available: '#16a34a',
  rented:    '#2563eb',
  repair:    '#dc2626',
  retired:   '#9ca3af',
}

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

      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '80px' }}>
        {list.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af', fontSize: '14px' }}>
            ไม่มีรถในสาขานี้
          </div>
        )}
        {list.map(bike => {
          const color = STATUS_COLOR[bike.status] ?? '#6b7280'
          const label = STATUS_LABEL[bike.status] ?? bike.status
          return (
            <Link key={bike.id} href={`/bike/${bike.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: '#fff', borderRadius: '14px', padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: '14px',
                boxShadow: '0 1px 4px rgba(0,0,0,.07)',
                border: `1.5px solid ${color}22`,
              }}>
                {/* Status dot */}
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />

                {/* Icon or photo */}
                {bike.photo_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={bike.photo_url} alt="" style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0 }} />
                  : <div style={{ fontSize: '36px', flexShrink: 0 }}>🛵</div>
                }

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '15px', color: '#111827' }}>
                    {bike.license_plate}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
                    {bike.brand} {bike.model}
                    {bike.color ? ` • ${bike.color}` : ''}
                    {bike.year ? ` • ปี ${bike.year + 543}` : ''}
                  </div>
                </div>

                {/* Status badge + rate */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    display: 'inline-block', fontSize: '11px', fontWeight: 700,
                    padding: '3px 10px', borderRadius: '20px',
                    background: `${color}15`, color,
                    marginBottom: '4px',
                  }}>
                    {label}
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>฿{bike.daily_rate}/วัน</div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
