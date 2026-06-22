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

  const [
    { count: activeRentals },
    { count: availableBikes },
    { count: overdueRentals },
    { count: monthlyRentals },
    { count: totalBikes },
    { data: upcomingReturns },
  ] = await Promise.all([
    supabase.from('rentals').select('*', { count: 'exact', head: true }).in('status', ['active', 'extended']),
    supabase.from('bikes').select('*', { count: 'exact', head: true }).eq('status', 'available'),
    supabase.from('rentals').select('*', { count: 'exact', head: true }).eq('status', 'overdue'),
    supabase.from('rentals').select('*', { count: 'exact', head: true }).eq('status', 'monthly'),
    supabase.from('bikes').select('*', { count: 'exact', head: true }),
    supabase.from('rentals')
      .select('id, expected_end_datetime, status, bikes(license_plate, brand, model), customers(name, phone)')
      .in('status', ['active', 'extended', 'overdue'])
      .order('expected_end_datetime', { ascending: true })
      .limit(5),
  ])

  const utilized = (activeRentals ?? 0) + (monthlyRentals ?? 0)
  const total = totalBikes ?? 1
  const utilRate = Math.round((utilized / total) * 100)

  return (
    <AppLayout
      title="Kuma Rental"
      subtitle={now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      headerStyle="blue"
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '12px' }}>
        <KpiCard icon="🛵" value={activeRentals ?? 0} label="เช่าอยู่ตอนนี้" accent="#16a34a" delta="กำลังดำเนินการ" deltaUp />
        <KpiCard icon="✅" value={availableBikes ?? 0} label="รถว่างพร้อมเช่า" accent="#2563eb" delta={"จาก " + (totalBikes ?? 0) + " คัน"} deltaUp />
        <KpiCard icon="📅" value={monthlyRentals ?? 0} label="เช่ารายเดือน" accent="#7c3aed" delta="สัญญาต่อเนื่อง" deltaUp />
        <KpiCard icon={overdueRentals ? '🚨' : '⏰'} value={overdueRentals ?? 0} label="เกินกำหนด"
          accent={overdueRentals ? '#dc2626' : '#16a34a'}
          delta={overdueRentals ? 'ต้องดำเนินการด่วน' : 'ทุกอย่างปกติ'} deltaUp={!overdueRentals} />
      </div>

      <div style={{ margin: '0 12px 12px', background: '#fff', borderRadius: '12px', padding: '14px', border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>Utilization Rate</span>
          <span style={{ fontSize: '15px', fontWeight: 800, color: utilRate >= 70 ? '#16a34a' : '#d97706' }}>{utilRate}%</span>
        </div>
        <div style={{ background: '#e5e7eb', borderRadius: '6px', height: '10px', overflow: 'hidden' }}>
          <div style={{ background: utilRate >= 70 ? 'linear-gradient(90deg,#16a34a,#34d399)' : 'linear-gradient(90deg,#d97706,#fbbf24)', height: '100%', width: Math.min(utilRate, 100) + '%', borderRadius: '6px' }} />
        </div>
        <div style={{ display: 'flex', gap: '14px', marginTop: '8px', fontSize: '12px' }}>
          <span style={{ color: '#16a34a', fontWeight: 600 }}>เช่า {utilized}</span>
          <span style={{ color: '#2563eb', fontWeight: 600 }}>ว่าง {availableBikes ?? 0}</span>
          <span style={{ color: '#6b7280', fontWeight: 600 }}>ทั้งหมด {total}</span>
        </div>
      </div>

      <div style={{ padding: '0 12px 12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '10px' }}>เมนูด่วน</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {([
            { href: '/rentals/new', icon: 'เช่าใหม่', label: 'เช่าใหม่', desc: 'สร้างรายการเช่า', color: '#2563eb', bg: '#eff6ff' },
            { href: '/rentals', icon: 'การเช่า', label: 'การเช่า', desc: 'ดูรายการเช่าทั้งหมด', color: '#16a34a', bg: '#f0fdf4' },
            { href: '/bikes/new', icon: 'เพิ่มรถ', label: 'เพิ่มรถ', desc: 'เพิ่มรถเข้าระบบ', color: '#7c3aed', bg: '#faf5ff' },
            { href: '/customers/new', icon: 'เพิ่มลูกค้า', label: 'เพิ่มลูกค้า', desc: 'บันทึกลูกค้าใหม่', color: '#d97706', bg: '#fffbeb' },
          ] as const).map(item => (
            <Link key={item.href} href={item.href} style={{ display: 'block', background: item.bg, borderRadius: '12px', padding: '14px 12px', textDecoration: 'none', border: '1.5px solid ' + item.color + '25' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: item.color }}>{item.label}</div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{item.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      <div style={{ margin: '0 12px 16px', background: '#fff', borderRadius: '12px', padding: '14px', border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>กำหนดคืนรถที่ใกล้ถึง</span>
          <Link href="/rentals" style={{ fontSize: '12px', color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>ดูทั้งหมด</Link>
        </div>
        {upcomingReturns && upcomingReturns.length > 0 ? upcomingReturns.map((r, i) => {
          const end = new Date(r.expected_end_datetime)
          const diffHrs = Math.round((end.getTime() - now.getTime()) / 36e5)
          const overdue = r.status === 'overdue' || diffHrs < 0
          const bike = r.bikes as { license_plate: string; brand: string; model: string } | null
          const cust = r.customers as { name: string; phone: string } | null
          return (
            <Link key={r.id} href={'/rentals/' + r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: i < (upcomingReturns.length - 1) ? '1px solid #f3f4f6' : 'none', textDecoration: 'none' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: overdue ? '#dc2626' : diffHrs < 12 ? '#d97706' : '#2563eb' }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: 0 }}>{bike?.license_plate} {bike?.brand} {bike?.model}</p>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{cust?.name}</p>
              </div>
              <p style={{ fontSize: '12px', fontWeight: 700, color: overdue ? '#dc2626' : '#374151', margin: 0 }}>
                {overdue ? 'เกิน ' + Math.floor(Math.abs(diffHrs) / 24) + 'ว' : 'อีก ' + Math.floor(diffHrs / 24) + 'วัน'}
              </p>
            </Link>
          )
        }) : <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: '13px' }}>ยังไม่มีรายการเช่า</div>}
      </div>
    </AppLayout>
  )
}

function KpiCard({ icon, value, label, accent, delta, deltaUp }: { icon: string; value: number; label: string; accent: string; delta: string; deltaUp?: boolean }) {
  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '14px', border: '1px solid #e5e7eb', borderTop: '3px solid ' + accent }}>
      <div style={{ fontSize: '22px', marginBottom: '6px' }}>{icon}</div>
      <div style={{ fontSize: '26px', fontWeight: 800, color: '#111827' }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{label}</div>
      <div style={{ fontSize: '11px', fontWeight: 700, color: deltaUp ? accent : '#dc2626', marginTop: '4px' }}>{deltaUp ? 'UP' : 'DOWN'} {delta}</div>
    </div>
  )
}
