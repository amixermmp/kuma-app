import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppLayout from '@/components/AppLayout'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // ดึงข้อมูลทั้งหมดพร้อมกัน
  const [
    { data: bikesData },
    { data: activeRentalsData },
    { data: monthRentalsData },
    { data: recentRentals },
  ] = await Promise.all([
    supabase.from('bikes').select('id, status'),
    supabase.from('rentals')
      .select('id, status, expected_end_datetime')
      .in('status', ['active', 'extended', 'overdue', 'monthly']),
    supabase.from('rentals')
      .select('id, paid_amount, status, start_datetime, expected_end_datetime, bikes(license_plate, brand, model), customers(name)')
      .gte('start_datetime', monthStart),
    supabase.from('rentals')
      .select('id, status, start_datetime, expected_end_datetime, paid_amount, bikes(license_plate, brand, model), customers(name)')
      .order('start_datetime', { ascending: false })
      .limit(5),
  ])

  // คำนวณ KPI
  const totalBikes    = bikesData?.length ?? 0
  const availCount    = bikesData?.filter(b => b.status === 'available').length ?? 0
  const rentedCount   = bikesData?.filter(b => b.status === 'rented' || b.status === 'monthly').length ?? 0
  const repairCount   = bikesData?.filter(b => b.status === 'maintenance').length ?? 0
  const utilRate      = totalBikes > 0 ? Math.round((rentedCount / totalBikes) * 100) : 0

  const overdueCount  = activeRentalsData?.filter(r => {
    return r.status === 'overdue' || new Date(r.expected_end_datetime) < now
  }).length ?? 0

  const monthRevenue  = monthRentalsData?.reduce((s, r) => s + Number(r.paid_amount ?? 0), 0) ?? 0
  const monthRentalCount = monthRentalsData?.length ?? 0

  return (
    <AppLayout
      title="Dashboard"
      subtitle={'ภาพรวมธุรกิจ — ' + now.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
      headerStyle="blue"
    >

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '12px 12px 0' }}>
        <KpiCard
          icon="💰" accent="#16a34a"
          value={'฿' + monthRevenue.toLocaleString()}
          label="รายได้เดือนนี้"
          delta="รวมทุกรายการ"
          deltaUp
        />
        <KpiCard
          icon="📋" accent="#2563eb"
          value={String(monthRentalCount)}
          label="รายการเช่าเดือนนี้"
          delta={'active ' + (activeRentalsData?.length ?? 0) + ' รายการ'}
          deltaUp
        />
        <KpiCard
          icon="🛵" accent="#7c3aed"
          value={utilRate + '%'}
          label="อัตราการใช้งานรถ"
          delta={'เช่า ' + rentedCount + ' / ทั้งหมด ' + totalBikes + ' คัน'}
          deltaUp={utilRate >= 50}
        />
        <KpiCard
          icon={overdueCount ? '🚨' : '📌'} accent={overdueCount ? '#dc2626' : '#16a34a'}
          value={String(overdueCount)}
          label="เกินกำหนดคืน"
          delta={overdueCount ? 'ต้องดำเนินการด่วน' : 'ทุกอย่างปกติ'}
          deltaUp={!overdueCount}
        />
      </div>

      {/* สถานะรถ */}
      <div style={{ margin: '12px 12px 0', background: '#fff', borderRadius: '12px', padding: '14px', border: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '10px' }}>
          สถานะรถทั้งหมด ({totalBikes} คัน)
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {[
            { count: availCount,  label: 'ว่าง',    color: '#16a34a', bg: '#f0fdf4' },
            { count: rentedCount, label: 'เช่าอยู่', color: '#2563eb', bg: '#eff6ff' },
            { count: repairCount, label: 'ซ่อม',     color: '#dc2626', bg: '#fef2f2' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 800, color: s.color }}>{s.count}</div>
              <div style={{ fontSize: '11px', color: s.color }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Utilization Rate</div>
        <div style={{ background: '#e5e7eb', borderRadius: '6px', height: '10px', overflow: 'hidden' }}>
          <div style={{
            background: 'linear-gradient(90deg, #16a34a, #34d399)',
            height: '100%', width: Math.min(utilRate, 100) + '%', borderRadius: '6px',
          }} />
        </div>
        <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 700, marginTop: '4px' }}>
          {utilRate}% {utilRate >= 70 ? '— ดีมาก' : utilRate >= 50 ? '— ปานกลาง' : '— ต่ำ'}
        </div>
      </div>

      {/* เมนูด่วน */}
      <div style={{ padding: '12px 12px 0' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '10px' }}>⚡ เมนูด่วน</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {([
            { href: '/rentals/new', icon: '🛵', label: 'เช่าใหม่',   desc: 'สร้างรายการเช่า',   color: '#2563eb', bg: '#eff6ff' },
            { href: '/rentals',     icon: '📋', label: 'การเช่า',    desc: 'ดูรายการเช่าทั้งหมด', color: '#16a34a', bg: '#f0fdf4' },
            { href: '/bikes/new',   icon: '➕', label: 'เพิ่มรถ',    desc: 'เพิ่มรถเข้าระบบ',   color: '#7c3aed', bg: '#faf5ff' },
            { href: '/customers/new', icon: '👤', label: 'เพิ่มลูกค้า', desc: 'บันทึกลูกค้าใหม่', color: '#d97706', bg: '#fffbeb' },
          ] as const).map(item => (
            <Link key={item.href} href={item.href} style={{
              display: 'block', background: item.bg, borderRadius: '12px', padding: '14px 12px',
              textDecoration: 'none', border: '1px solid ' + item.color + '25',
            }}>
              <div style={{ fontSize: '24px', marginBottom: '6px' }}>{item.icon}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: item.color }}>{item.label}</div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{item.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* รายการล่าสุด */}
      <div style={{ margin: '12px 12px 16px', background: '#fff', borderRadius: '12px', padding: '14px', border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>รายการล่าสุด</span>
          <Link href="/rentals" style={{ fontSize: '12px', color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>ดูทั้งหมด →</Link>
        </div>

        {recentRentals && recentRentals.length > 0 ? recentRentals.map((r, i) => {
          const bike = r.bikes as unknown as { license_plate: string; brand: string; model: string } | null
          const cust = r.customers as unknown as { name: string } | null
          const isActive = ['active', 'extended', 'monthly'].includes(r.status)
          const isOverdue = r.status === 'overdue'
          const icon = isOverdue ? '🚨' : isActive ? '📤' : '📥'
          const amtColor = isActive ? '#2563eb' : '#16a34a'

          return (
            <Link key={r.id} href={'/rentals/' + r.id} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 0',
              borderBottom: i < recentRentals.length - 1 ? '1px solid #f3f4f6' : 'none',
              textDecoration: 'none', color: 'inherit',
            }}>
              <div style={{ fontSize: '24px', flexShrink: 0 }}>{icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                  {isActive ? 'ส่งรถ' : 'รับรถคืน'} — {cust?.name ?? '-'}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '1px' }}>
                  {bike?.license_plate} • {new Date(r.start_datetime).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: amtColor, flexShrink: 0 }}>
                ฿{Number(r.paid_amount ?? 0).toLocaleString()}
              </div>
            </Link>
          )
        }) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: '13px' }}>
            ยังไม่มีรายการเช่า
          </div>
        )}
      </div>

    </AppLayout>
  )
}

function KpiCard({ icon, value, label, accent, delta, deltaUp }: {
  icon: string; value: string; label: string; accent: string; delta: string; deltaUp?: boolean
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '14px',
      border: '1px solid #e5e7eb', borderTop: '3px solid ' + accent,
    }}>
      <div style={{ fontSize: '22px', marginBottom: '6px' }}>{icon}</div>
      <div style={{ fontSize: '22px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>{label}</div>
      <div style={{ fontSize: '11px', fontWeight: 700, color: deltaUp ? accent : '#dc2626', marginTop: '4px' }}>
        {deltaUp ? '▲' : '▼'} {delta}
      </div>
    </div>
  )
}
