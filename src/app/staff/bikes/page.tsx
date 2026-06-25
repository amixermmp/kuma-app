import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  available: { label: 'ว่าง',     bg: '#f0fdf4', color: '#16a34a' },
  rented:    { label: 'เช่าอยู่', bg: '#fef2f2', color: '#dc2626' },
  repair:    { label: 'ซ่อม',     bg: '#fffbeb', color: '#d97706' },
  inactive:  { label: 'ปิดใช้',   bg: '#f3f4f6', color: '#6b7280' },
}

export default async function StaffBikesPage() {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()

  // หา branch_id ของ staff คนนี้
  const { data: staffRow } = await supabase
    .from('staff')
    .select('branch_id')
    .eq('id', staffId)
    .single()

  if (!staffRow?.branch_id) redirect('/staff/home')

  const branchId = staffRow.branch_id
  const now = new Date().toISOString()

  // ดึงรถทั้งหมดของสาขา + เช็ค bookings ที่ active อยู่
  const [{ data: bikes }, { data: activeBookings }] = await Promise.all([
    supabase
      .from('bikes')
      .select('id, license_plate, brand, model, color, year, odometer, fuel_level, status, daily_rate')
      .eq('branch_id', branchId)
      .order('license_plate', { ascending: true }),

    supabase
      .from('bookings')
      .select('bike_id')
      .eq('branch_id', branchId)
      .eq('status', 'confirmed')
      .gt('end_datetime', now),
  ])

  const bookedBikeIds = new Set((activeBookings ?? []).map(b => b.bike_id))

  const available = (bikes ?? []).filter(b => b.status === 'available' && !bookedBikeIds.has(b.id))
  const booked    = (bikes ?? []).filter(b => b.status === 'available' && bookedBikeIds.has(b.id))
  const rented    = (bikes ?? []).filter(b => b.status === 'rented')
  const repair    = (bikes ?? []).filter(b => b.status === 'repair')
  const other     = (bikes ?? []).filter(b => !['available','rented','repair'].includes(b.status))

  const allSorted = [...rented, ...booked, ...repair, ...available, ...other]

  return (
    <div className="app-wrap">

      <div className="app-header" style={{ background: '#1e40af' }}>
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div>
          <h1>รายการรถ</h1>
          <div className="sub">รถทั้งหมด {bikes?.length ?? 0} คัน • ว่าง {available.length} คัน</div>
        </div>
      </div>

      {/* Summary chips */}
      <div style={{
        background: '#fff', padding: '10px 12px',
        display: 'flex', gap: '8px', overflowX: 'auto',
        borderBottom: '1px solid #e5e7eb',
      }}>
        {[
          { label: 'ทั้งหมด', count: (bikes ?? []).length, bg: '#eff6ff', color: '#1d4ed8' },
          { label: 'ว่าง',    count: available.length,     bg: '#f0fdf4', color: '#16a34a' },
          { label: 'ติดจอง',  count: booked.length,        bg: '#faf5ff', color: '#7c3aed' },
          { label: 'เช่าอยู่', count: rented.length,       bg: '#fef2f2', color: '#dc2626' },
          { label: 'ซ่อม',    count: repair.length,        bg: '#fffbeb', color: '#d97706' },
        ].map(({ label, count, bg, color }) => (
          <div key={label} style={{
            flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: bg, color, border: `1px solid ${color}33`,
            borderRadius: '10px', padding: '6px 12px', minWidth: '52px',
          }}>
            <span style={{ fontSize: '16px', fontWeight: 800 }}>{count}</span>
            <span style={{ fontSize: '10px', fontWeight: 600 }}>{label}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 12px 80px' }}>
        {allSorted.map(bike => {
          const isBooked = bookedBikeIds.has(bike.id) && bike.status === 'available'
          const statusInfo = isBooked
            ? { label: '📅 ติดจอง', bg: '#faf5ff', color: '#7c3aed' }
            : STATUS_MAP[bike.status] ?? { label: bike.status, bg: '#f3f4f6', color: '#6b7280' }

          return (
            <Link
              key={bike.id}
              href={`/staff/bikes/${bike.id}/menu`}
              style={{ textDecoration: 'none', display: 'block', marginBottom: '10px' }}
            >
              <div style={{
                background: '#fff', borderRadius: '14px',
                boxShadow: '0 1px 4px rgba(0,0,0,.07)',
                overflow: 'hidden', display: 'flex',
                borderLeft: `5px solid ${isBooked ? '#7c3aed' : bike.status === 'rented' ? '#dc2626' : bike.status === 'repair' ? '#d97706' : '#16a34a'}`,
              }}>
                <div style={{ flex: 1, padding: '13px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#111827' }}>
                      {bike.brand} {bike.model}
                    </div>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                      background: statusInfo.bg, color: statusInfo.color,
                    }}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    ทะเบียน {bike.license_plate}
                    {bike.color ? ` • ${bike.color}` : ''}
                    {bike.year ? ` • ปี ${bike.year}` : ''}
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px', display: 'flex', gap: '10px' }}>
                    <span>📍 {bike.odometer.toLocaleString()} กม.</span>
                    <span>฿{bike.daily_rate.toLocaleString()}/วัน</span>
                  </div>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', padding: '0 14px',
                  color: '#d1d5db', fontSize: '18px',
                }}>›</div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
