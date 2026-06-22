import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppLayout from '@/components/AppLayout'

export const dynamic = 'force-dynamic'

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  available:   { label: 'ว่าง',     color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', dot: '#16a34a' },
  rented:      { label: 'เช่าอยู่', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', dot: '#2563eb' },
  maintenance: { label: 'ซ่อม',     color: '#dc2626', bg: '#fff5f5', border: '#fecaca', dot: '#dc2626' },
  monthly:     { label: 'รายเดือน', color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe', dot: '#7c3aed' },
}

export default async function BikesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: bikes } = await supabase
    .from('bikes')
    .select('*')
    .order('status')
    .order('license_plate')

  const addBtn = (
    <Link href="/bikes/new" style={{
      color: '#fff', fontWeight: 700, fontSize: '13px', textDecoration: 'none',
      background: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '8px',
    }}>
      + เพิ่มรถ
    </Link>
  )

  return (
    <AppLayout title="รถทั้งหมด" subtitle={`${bikes?.length ?? 0} คันในระบบ`} action={addBtn} headerStyle="blue">

      {/* Filter chips */}
      <div style={{
        background: '#fff', padding: '10px 12px',
        display: 'flex', gap: '6px', overflowX: 'auto',
        borderBottom: '1px solid #e5e7eb',
      }}>
        {Object.entries(statusConfig).map(([key, cfg]) => (
          <div key={key} style={{
            padding: '5px 12px', borderRadius: '20px',
            border: `1.5px solid ${cfg.border}`,
            background: cfg.bg,
            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            whiteSpace: 'nowrap', color: cfg.color, flexShrink: 0,
          }}>
            {cfg.label} {bikes?.filter(b => b.status === key).length ?? 0}
          </div>
        ))}
      </div>

      {/* Fleet grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '12px' }}>
        {bikes?.map(bike => {
          const cfg = statusConfig[bike.status] ?? statusConfig.available
          return (
            <Link key={bike.id} href={`/bikes/${bike.id}`} style={{
              display: 'block', background: cfg.bg,
              borderRadius: '12px', border: `1.5px solid ${cfg.border}`,
              padding: '12px', textDecoration: 'none', position: 'relative',
            }}>
              {/* Status dot */}
              <div style={{
                position: 'absolute', top: '10px', right: '10px',
                width: '10px', height: '10px', borderRadius: '50%',
                background: cfg.dot,
              }} />

              <div style={{ fontSize: '32px', textAlign: 'center', marginBottom: '8px' }}>🏍️</div>

              <div style={{ fontSize: '13px', fontWeight: 800, color: '#111827' }}>{bike.license_plate}</div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                {bike.brand} {bike.model}
              </div>

              <div style={{
                display: 'inline-block', marginTop: '8px',
                padding: '3px 8px', borderRadius: '20px',
                fontSize: '11px', fontWeight: 700,
                background: cfg.color + '20', color: cfg.color,
              }}>
                {cfg.label}
              </div>

              <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginTop: '6px' }}>
                ฿{Number(bike.daily_rate).toLocaleString()}/วัน
              </div>
            </Link>
          )
        })}
      </div>

      {(!bikes || bikes.length === 0) && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>🏍️</p>
          <p style={{ fontSize: '15px' }}>ยังไม่มีรถในระบบ</p>
          <Link href="/bikes/new" style={{
            display: 'inline-block', marginTop: '16px',
            background: '#2563eb', color: '#fff',
            padding: '10px 24px', borderRadius: '8px',
            textDecoration: 'none', fontWeight: 600,
          }}>
            + เพิ่มรถคันแรก
          </Link>
        </div>
      )}
    </AppLayout>
  )
}
