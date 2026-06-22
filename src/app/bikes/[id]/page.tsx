import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppLayout from '@/components/AppLayout'

export const dynamic = 'force-dynamic'

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  available:   { label: 'ว่าง',     color: '#16a34a', bg: '#f0fdf4' },
  rented:      { label: 'เช่าอยู่', color: '#2563eb', bg: '#eff6ff' },
  maintenance: { label: 'ซ่อม',     color: '#dc2626', bg: '#fff5f5' },
  monthly:     { label: 'รายเดือน', color: '#7c3aed', bg: '#faf5ff' },
}

export default async function BikeDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: bike } = await supabase.from('bikes').select('*').eq('id', params.id).single()
  if (!bike) notFound()

  const { data: activeRental } = await supabase
    .from('rentals')
    .select('id, start_datetime, expected_end_datetime, daily_rate, customers(name, phone)')
    .eq('bike_id', params.id)
    .in('status', ['active', 'extended', 'monthly'])
    .maybeSingle()

  const { data: rentalHistory } = await supabase
    .from('rentals')
    .select('id, start_datetime, expected_end_datetime, status, customers(name)')
    .eq('bike_id', params.id)
    .order('start_datetime', { ascending: false })
    .limit(5)

  const cfg = statusConfig[bike.status] ?? statusConfig.available

  return (
    <AppLayout title={bike.license_plate} subtitle={`${bike.brand} ${bike.model}`} backHref="/bikes" headerStyle="dark">

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(160deg, #0f172a, #1e3a8a)',
        padding: '20px 16px', color: '#fff',
        display: 'flex', alignItems: 'center', gap: '16px',
      }}>
        <div style={{ fontSize: '56px' }}>🏍️</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '24px', fontWeight: 900 }}>{bike.license_plate}</div>
          <div style={{ fontSize: '14px', opacity: 0.8, marginTop: '2px' }}>{bike.brand} {bike.model} {bike.year ? `• ปี ${bike.year}` : ''}</div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
              {cfg.label}
            </span>
            {bike.color && <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '4px 10px', borderRadius: '20px', fontSize: '12px' }}>🎨 {bike.color}</span>}
            <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '4px 10px', borderRadius: '20px', fontSize: '12px' }}>
              ฿{Number(bike.daily_rate).toLocaleString()}/วัน
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding: '12px' }}>

        {/* Active rental */}
        {activeRental && (
          <div style={{ background: '#eff6ff', borderRadius: '12px', padding: '14px', marginBottom: '12px', border: '1.5px solid #bfdbfe' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8', marginBottom: '8px' }}>🛵 กำลังเช่าอยู่</div>
            {(() => {
              const cust = activeRental.customers as { name: string; phone: string } | null
              const end = new Date(activeRental.expected_end_datetime)
              const diffHrs = Math.round((end.getTime() - Date.now()) / 36e5)
              return (
                <>
                  <InfoRow label="ลูกค้า" value={cust?.name ?? '-'} />
                  <InfoRow label="โทร" value={cust?.phone ?? '-'} />
                  <InfoRow label="กำหนดคืน" value={end.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} />
                  <InfoRow label="เหลือ" value={diffHrs < 0 ? `เกิน ${Math.abs(diffHrs)} ชม.` : `อีก ${diffHrs} ชม.`} last />
                  <Link href={`/rentals/${activeRental.id}`} style={{
                    display: 'block', marginTop: '10px', textAlign: 'center',
                    background: '#2563eb', color: '#fff', padding: '10px', borderRadius: '8px',
                    textDecoration: 'none', fontWeight: 700, fontSize: '14px',
                  }}>
                    ดูรายละเอียดการเช่า →
                  </Link>
                </>
              )
            })()}
          </div>
        )}

        {/* ข้อมูลรถ */}
        <div style={cardStyle}>
          <SectionTitle>ข้อมูลรถ</SectionTitle>
          <InfoRow label="ทะเบียน" value={bike.license_plate} />
          <InfoRow label="ยี่ห้อ / รุ่น" value={`${bike.brand} ${bike.model}`} />
          <InfoRow label="สี" value={bike.color ?? '-'} />
          <InfoRow label="ปี" value={bike.year ? String(bike.year) : '-'} />
          <InfoRow label="สถานะ" value={cfg.label} />
          <InfoRow label="ราคา/วัน" value={`฿${Number(bike.daily_rate).toLocaleString()}`} />
          <InfoRow label="ราคา/เดือน" value={bike.monthly_rate ? `฿${Number(bike.monthly_rate).toLocaleString()}` : '-'} last />
        </div>

        {/* ประวัติการเช่า */}
        {rentalHistory && rentalHistory.length > 0 && (
          <div style={cardStyle}>
            <SectionTitle>ประวัติการเช่า</SectionTitle>
            {rentalHistory.map((r, i) => {
              const cust = r.customers as { name: string } | null
              const start = new Date(r.start_datetime).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
              const end = new Date(r.expected_end_datetime).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
              return (
                <div key={r.id} style={{
                  padding: '10px 0', fontSize: '13px',
                  borderBottom: i < rentalHistory.length - 1 ? '1px solid #f3f4f6' : 'none',
                }}>
                  <div style={{ fontWeight: 600, color: '#111827' }}>{cust?.name ?? 'ไม่ระบุ'}</div>
                  <div style={{ color: '#6b7280', marginTop: '2px' }}>{start} → {end}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* Actions */}
        {bike.status === 'available' && (
          <Link href={`/rentals/new?bike_id=${bike.id}`} style={{
            display: 'block', textAlign: 'center',
            background: '#2563eb', color: '#fff', padding: '14px', borderRadius: '10px',
            textDecoration: 'none', fontWeight: 700, fontSize: '15px', marginBottom: '8px',
          }}>
            🛵 สร้างการเช่าสำหรับรถคันนี้
          </Link>
        )}
      </div>
    </AppLayout>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: '12px', padding: '14px',
  marginBottom: '12px', border: '1px solid #e5e7eb',
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>{children}</div>
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0', borderBottom: last ? 'none' : '1px solid #f3f4f6', fontSize: '14px',
    }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ fontWeight: 600, color: '#111827', textAlign: 'right' }}>{value}</span>
    </div>
  )
}
