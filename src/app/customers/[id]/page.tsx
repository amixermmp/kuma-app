import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppLayout from '@/components/AppLayout'

export const dynamic = 'force-dynamic'

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: customer } = await supabase.from('customers').select('*').eq('id', params.id).single()
  if (!customer) notFound()

  const { data: rentals } = await supabase
    .from('rentals')
    .select('id, start_datetime, expected_end_datetime, status, daily_rate, bikes(license_plate, brand, model)')
    .eq('customer_id', params.id)
    .order('start_datetime', { ascending: false })
    .limit(10)

  const activeRental = rentals?.find(r => ['active', 'extended', 'overdue', 'monthly'].includes(r.status))

  return (
    <AppLayout title={customer.name} subtitle={customer.phone} backHref="/customers" headerStyle="blue">

      {/* Avatar hero */}
      <div style={{
        background: customer.is_blacklisted
          ? 'linear-gradient(135deg, #b91c1c, #dc2626)'
          : 'linear-gradient(135deg, #1d4ed8, #2563eb)',
        padding: '20px 16px', color: '#fff',
        display: 'flex', alignItems: 'center', gap: '16px',
      }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '28px', fontWeight: 700, flexShrink: 0,
        }}>
          {customer.name.charAt(0)}
        </div>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 800 }}>{customer.name}</div>
          <div style={{ fontSize: '14px', opacity: 0.8, marginTop: '2px' }}>📞 {customer.phone}</div>
          {customer.is_blacklisted && (
            <div style={{ marginTop: '6px', background: 'rgba(255,255,255,0.2)', display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
              ⛔ แบล็คลิสต์
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '12px' }}>

        {/* Active rental alert */}
        {activeRental && (
          <Link href={`/rentals/${activeRental.id}`} style={{
            display: 'block', background: '#eff6ff', borderRadius: '12px',
            padding: '14px', marginBottom: '12px', border: '1.5px solid #bfdbfe',
            textDecoration: 'none',
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8', marginBottom: '4px' }}>🛵 กำลังเช่าอยู่</div>
            {(() => {
              const bike = activeRental.bikes as unknown as { license_plate: string; brand: string; model: string } | null
              const end = new Date(activeRental.expected_end_datetime)
              return (
                <div style={{ fontSize: '14px', color: '#111827' }}>
                  {bike?.license_plate} — {bike?.brand} {bike?.model}
                  <span style={{ color: '#6b7280', fontSize: '12px' }}> • คืน {end.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                </div>
              )
            })()}
          </Link>
        )}

        {/* ข้อมูลลูกค้า */}
        <div style={cardStyle}>
          <SectionTitle>ข้อมูลลูกค้า</SectionTitle>
          <InfoRow label="ชื่อ" value={customer.name} />
          <InfoRow label="โทร" value={customer.phone} />
          <InfoRow label="บัตร" value={customer.id_card ?? '-'} />
          <InfoRow label="ที่อยู่" value={customer.address ?? '-'} />
          <InfoRow label="สมัครเมื่อ" value={new Date(customer.created_at).toLocaleDateString('th-TH')} last />
        </div>

        {/* ประวัติการเช่า */}
        {rentals && rentals.length > 0 && (
          <div style={cardStyle}>
            <SectionTitle>ประวัติการเช่า ({rentals.length} รายการ)</SectionTitle>
            {rentals.map((r, i) => {
              const bike = r.bikes as unknown as { license_plate: string; brand: string; model: string } | null
              const start = new Date(r.start_datetime).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
              const end = new Date(r.expected_end_datetime).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
              const isActive = ['active', 'extended', 'overdue'].includes(r.status)
              return (
                <Link key={r.id} href={`/rentals/${r.id}`} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 0',
                  borderBottom: i < rentals.length - 1 ? '1px solid #f3f4f6' : 'none',
                  textDecoration: 'none',
                }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: isActive ? '#2563eb' : '#d1d5db' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{bike?.license_plate} — {bike?.brand} {bike?.model}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '1px' }}>{start} → {end}</div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>
                    ฿{Number(r.daily_rate).toLocaleString()}/วัน
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* New rental */}
        <Link href={`/rentals/new?customer_id=${customer.id}`} style={{
          display: 'block', textAlign: 'center',
          background: '#2563eb', color: '#fff', padding: '14px', borderRadius: '10px',
          textDecoration: 'none', fontWeight: 700, fontSize: '15px',
        }}>
          🛵 สร้างการเช่าให้ลูกค้าคนนี้
        </Link>
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
      <span style={{ fontWeight: 600, color: '#111827', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  )
}
