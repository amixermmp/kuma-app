import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppLayout from '@/components/AppLayout'

export const dynamic = 'force-dynamic'

export default async function RentalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rentals } = await supabase
    .from('rentals')
    .select('id, status, start_datetime, expected_end_datetime, daily_rate, paid_amount, bikes(license_plate, brand, model), customers(name, phone)')
    .in('status', ['active', 'extended', 'overdue'])
    .order('expected_end_datetime', { ascending: true })

  const now = new Date()

  const addBtn = (
    <Link href="/rentals/new" style={{
      color: '#fff', fontWeight: 700, fontSize: '13px', textDecoration: 'none',
      background: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '8px',
    }}>
      + เช่าใหม่
    </Link>
  )

  const overdueList = rentals?.filter(r => {
    const end = new Date(r.expected_end_datetime)
    return r.status === 'overdue' || end < now
  }) ?? []
  const activeList = rentals?.filter(r => {
    const end = new Date(r.expected_end_datetime)
    return r.status !== 'overdue' && end >= now
  }) ?? []

  return (
    <AppLayout title="การเช่าปัจจุบัน" subtitle={`${rentals?.length ?? 0} รายการ active`} action={addBtn} headerStyle="blue">

      {overdueList.length > 0 && (
        <div style={{ padding: '10px 12px 0' }}>
          <div style={{
            fontSize: '12px', fontWeight: 700, color: '#b91c1c',
            borderLeft: '4px solid #dc2626', paddingLeft: '8px',
            marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            🚨 เกินกำหนด ({overdueList.length})
          </div>
          {overdueList.map(r => <RentalCard key={r.id} r={r} now={now} />)}
        </div>
      )}

      {activeList.length > 0 && (
        <div style={{ padding: overdueList.length > 0 ? '10px 12px 0' : '10px 12px 0' }}>
          {overdueList.length > 0 && (
            <div style={{
              fontSize: '12px', fontWeight: 700, color: '#1d4ed8',
              borderLeft: '4px solid #2563eb', paddingLeft: '8px',
              marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              🔵 รอคืนรถ ({activeList.length})
            </div>
          )}
          {activeList.map(r => <RentalCard key={r.id} r={r} now={now} />)}
        </div>
      )}

      {(!rentals || rentals.length === 0) && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>📋</p>
          <p style={{ fontSize: '15px' }}>ไม่มีการเช่าที่ active อยู่</p>
          <Link href="/rentals/new" style={{
            display: 'inline-block', marginTop: '16px',
            background: '#2563eb', color: '#fff',
            padding: '10px 24px', borderRadius: '8px',
            textDecoration: 'none', fontWeight: 600,
          }}>
            + สร้างการเช่าใหม่
          </Link>
        </div>
      )}
    </AppLayout>
  )
}

function RentalCard({ r, now }: { r: any; now: Date }) {
  const end = new Date(r.expected_end_datetime)
  const diffHrs = Math.round((end.getTime() - now.getTime()) / 36e5)
  const overdue = r.status === 'overdue' || diffHrs < 0
  const bike = r.bikes as { license_plate: string; brand: string; model: string } | null
  const cust = r.customers as { name: string; phone: string } | null

  const accentColor = overdue ? '#dc2626' : diffHrs < 12 ? '#d97706' : '#2563eb'
  const badgeBg = overdue ? '#fef2f2' : diffHrs < 12 ? '#fffbeb' : '#eff6ff'
  const badgeColor = overdue ? '#dc2626' : diffHrs < 12 ? '#d97706' : '#2563eb'

  const timeText = overdue
    ? `🔴 เกิน ${Math.floor(Math.abs(diffHrs) / 24)}ว ${Math.abs(diffHrs) % 24}ชม.`
    : diffHrs < 12 ? `⚠️ อีก ${diffHrs}ชม.`
    : `📅 อีก ${Math.floor(diffHrs / 24)}วัน`

  return (
    <Link href={`/rentals/${r.id}`} style={{
      display: 'block', background: '#fff', borderRadius: '12px',
      marginBottom: '8px', textDecoration: 'none', color: 'inherit',
      border: '1px solid #e5e7eb', overflow: 'hidden',
      boxShadow: overdue ? '0 2px 10px rgba(220,38,38,0.15)' : '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* Left accent bar */}
      <div style={{ display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: '4px', background: accentColor, flexShrink: 0 }} />
        <div style={{ flex: 1, padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827', flex: 1 }}>
              {bike?.license_plate} — {bike?.brand} {bike?.model}
            </span>
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '3px 8px',
              borderRadius: '20px', background: badgeBg, color: badgeColor, whiteSpace: 'nowrap',
            }}>
              {timeText}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
            👤 {cust?.name} • {cust?.phone}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #f3f4f6' }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              คืน: {end.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>
              ฿{Number(r.daily_rate).toLocaleString()}/วัน
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
