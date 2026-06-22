import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppLayout from '@/components/AppLayout'
import ReturnRentalButton from './ReturnRentalButton'

export const dynamic = 'force-dynamic'

export default async function RentalDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rental } = await supabase
    .from('rentals')
    .select('*, bikes(license_plate, brand, model, color, year), customers(name, phone, id_card)')
    .eq('id', params.id)
    .single()

  if (!rental) notFound()

  const bike = rental.bikes as unknown as { license_plate: string; brand: string; model: string; color?: string; year?: number } | null
  const cust = rental.customers as unknown as { name: string; phone: string; id_card?: string } | null

  const now = new Date()
  const start = new Date(rental.start_datetime)
  const end = new Date(rental.expected_end_datetime)
  const diffHrs = Math.round((end.getTime() - now.getTime()) / 36e5)
  const overdue = rental.status === 'overdue' || diffHrs < 0
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))
  const total = days * Number(rental.daily_rate)

  const statusColor = overdue ? '#dc2626' : rental.status === 'active' ? '#2563eb' : '#16a34a'
  const statusLabel = overdue ? 'เกินกำหนด' : rental.status === 'active' ? 'กำลังเช่า' : rental.status === 'extended' ? 'ต่อสัญญา' : rental.status

  return (
    <AppLayout title="รายละเอียดการเช่า" subtitle={`${bike?.license_plate} — ${cust?.name}`} backHref="/rentals" headerStyle="blue">

      {/* Status banner */}
      <div style={{
        padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 700,
        background: overdue ? '#fef2f2' : '#eff6ff',
        color: statusColor, borderBottom: `2px solid ${statusColor}30`,
      }}>
        {overdue
          ? `🔴 เกินกำหนด ${Math.floor(Math.abs(diffHrs) / 24)} วัน ${Math.abs(diffHrs) % 24} ชม.`
          : `🔵 ${statusLabel} — อีก ${diffHrs < 24 ? `${diffHrs} ชม.` : `${Math.floor(diffHrs / 24)} วัน`}`}
      </div>

      <div style={{ padding: '12px' }}>

        {/* ข้อมูลรถ */}
        <div style={cardStyle}>
          <SectionTitle>🏍️ รถ</SectionTitle>
          <InfoRow label="ทะเบียน" value={bike?.license_plate ?? '-'} />
          <InfoRow label="ยี่ห้อ / รุ่น" value={`${bike?.brand} ${bike?.model}`} />
          {bike?.color && <InfoRow label="สี" value={bike.color} />}
          <InfoRow label="เริ่มเช่า" value={start.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
          <InfoRow label="กำหนดคืน" value={end.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} last />
        </div>

        {/* ข้อมูลลูกค้า */}
        <div style={cardStyle}>
          <SectionTitle>👤 ลูกค้า</SectionTitle>
          <InfoRow label="ชื่อ" value={cust?.name ?? '-'} />
          <InfoRow label="โทร" value={cust?.phone ?? '-'} />
          {cust?.id_card && <InfoRow label="บัตร" value={cust.id_card} last />}
        </div>

        {/* ราคา */}
        <div style={{
          background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
          borderRadius: '12px', padding: '16px', color: '#fff',
          textAlign: 'center', marginBottom: '12px',
        }}>
          <div style={{ fontSize: '13px', opacity: 0.85 }}>ยอดรวมค่าเช่า</div>
          <div style={{ fontSize: '36px', fontWeight: 800, marginTop: '4px' }}>฿{total.toLocaleString()}</div>
          <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
            ฿{Number(rental.daily_rate).toLocaleString()}/วัน × {days} วัน
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '8px' }}>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>มัดจำ</div>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>฿{Number(rental.deposit ?? 0).toLocaleString()}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '8px' }}>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>รับแล้ว</div>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>฿{Number(rental.paid_amount ?? 0).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {rental.notes && (
          <div style={{ background: '#fffbeb', borderRadius: '10px', padding: '12px', marginBottom: '12px', border: '1px solid #fde68a', fontSize: '13px', color: '#92400e' }}>
            📝 {rental.notes}
          </div>
        )}

        {/* Actions */}
        {['active', 'extended', 'overdue'].includes(rental.status) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <ReturnRentalButton rentalId={rental.id} bikeId={rental.bike_id} />
            <Link href={`/rentals/${rental.id}/extend`} style={{
              display: 'block', textAlign: 'center',
              background: '#fff', color: '#2563eb',
              border: '2px solid #2563eb', padding: '13px', borderRadius: '10px',
              textDecoration: 'none', fontWeight: 700, fontSize: '15px',
            }}>
              ⏱ ต่อเวลา
            </Link>
          </div>
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
      <span style={{ fontWeight: 600, color: '#111827', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  )
}
