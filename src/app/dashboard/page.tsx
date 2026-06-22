import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppLayout from '@/components/AppLayout'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { count: activeRentals },
    { count: availableBikes },
    { count: overdueRentals },
    { count: activeMonthly },
  ] = await Promise.all([
    supabase.from('rentals').select('*', { count: 'exact', head: true }).in('status', ['active', 'extended']),
    supabase.from('bikes').select('*', { count: 'exact', head: true }).eq('status', 'available'),
    supabase.from('rentals').select('*', { count: 'exact', head: true }).eq('status', 'overdue'),
    supabase.from('monthly_rentals').select('*', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  const { data: upcoming } = await supabase
    .from('rentals')
    .select('id, status, expected_end_datetime, bikes(license_plate, brand, model), customers(name, phone)')
    .in('status', ['active', 'extended', 'overdue'])
    .order('expected_end_datetime', { ascending: true })
    .limit(5)

  const now = new Date()

  return (
    <AppLayout title="🏍️ Kuma App">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        <StatCard icon="🏍️" label="เช่าอยู่" value={activeRentals ?? 0} color="#f59e0b" href="/rentals" />
        <StatCard icon="✅" label="รถว่าง" value={availableBikes ?? 0} color="#10b981" href="/bikes" />
        <StatCard icon="⚠️" label="เกินกำหนด" value={overdueRentals ?? 0} color="#ef4444" href="/rentals" />
        <StatCard icon="📅" label="รายเดือน" value={activeMonthly ?? 0} color="#6366f1" href="/monthly" />
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <Link href="/rentals/new" style={actionBtn('#f59e0b')}>+ เช่าใหม่</Link>
        <Link href="/bikes/new" style={actionBtn('#374151')}>+ เพิ่มรถ</Link>
      </div>

      {upcoming && upcoming.length > 0 && (
        <>
          <p style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>
            ต้องคืนเร็วๆ นี้
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {upcoming.map(r => {
              const end = new Date(r.expected_end_datetime)
              const diffHrs = Math.round((end.getTime() - now.getTime()) / 36e5)
              const overdue = r.status === 'overdue' || diffHrs < 0
              const bike = r.bikes as unknown as { license_plate: string; brand: string; model: string } | null
              const cust = r.customers as unknown as { name: string; phone: string } | null
              return (
                <Link key={r.id} href={'/rentals/' + r.id} style={{
                  display: 'block', background: '#fff', borderRadius: '12px',
                  padding: '12px 14px', textDecoration: 'none', color: 'inherit',
                  borderLeft: '4px solid ' + (overdue ? '#ef4444' : '#f59e0b'),
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '14px' }}>
                        {bike?.license_plate}{' '}
                        <span style={{ fontWeight: 400, color: '#6b7280' }}>{bike?.brand} {bike?.model}</span>
                      </p>
                      <p style={{ fontSize: '13px', color: '#4b5563', marginTop: '2px' }}>{cust?.name} · {cust?.phone}</p>
                    </div>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px',
                      background: overdue ? '#fef2f2' : '#fef3c7',
                      color: overdue ? '#ef4444' : '#d97706', whiteSpace: 'nowrap',
                    }}>
                      {overdue ? 'เกิน ' + Math.floor(Math.abs(diffHrs)/24) + 'วัน'
                        : diffHrs < 24 ? diffHrs + 'ชม.' : Math.floor(diffHrs/24) + 'วัน'}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}

      {!upcoming?.length && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
          <p style={{ fontSize: '40px', marginBottom: '8px' }}>🎉</p>
          <p>ไม่มีการเช่าที่ active อยู่</p>
          <Link href="/rentals/new" style={{ color: '#f59e0b', fontWeight: 600, display: 'inline-block', marginTop: '12px' }}>
            + สร้างการเช่าแรก
          </Link>
        </div>
      )}
    </AppLayout>
  )
}

function StatCard({ icon, label, value, color, href }: {
  icon: string; label: string; value: number; color: string; href: string
}) {
  return (
    <Link href={href} style={{
      display: 'block', background: '#fff', borderRadius: '14px',
      padding: '14px', textDecoration: 'none', color: 'inherit',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>{label}</span>
      </div>
      <p style={{ fontSize: '30px', fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
    </Link>
  )
}

function actionBtn(bg: string): React.CSSProperties {
  return {
    flex: 1, display: 'block', textAlign: 'center',
    padding: '11px', background: bg, color: '#fff',
    borderRadius: '10px', textDecoration: 'none', fontWeight: 600, fontSize: '14px',
  }
}
