import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppLayout from '@/components/AppLayout'

export const dynamic = 'force-dynamic'

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  available:   { label: '🟢 ว่าง',     color: '#16a34a', bg: '#f0fdf4' },
  rented:      { label: '🔵 เช่าอยู่', color: '#2563eb', bg: '#eff6ff' },
  maintenance: { label: '🔴 ซ่อม',     color: '#dc2626', bg: '#fff5f5' },
  monthly:     { label: '🟣 รายเดือน', color: '#7c3aed', bg: '#faf5ff' },
}

function docStatus(expiry: string | null): { label: string; color: string; bg: string } {
  if (!expiry) return { label: '— ไม่มีข้อมูล', color: '#6b7280', bg: '#f9fafb' }
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000)
  if (days < 0) return { label: `หมดแล้ว ${Math.abs(days)} วัน`, color: '#dc2626', bg: '#fef2f2' }
  if (days <= 30) return { label: `🚨 ${days} วัน`, color: '#dc2626', bg: '#fef2f2' }
  if (days <= 90) return { label: `⚠️ ${days} วัน`, color: '#d97706', bg: '#fffbeb' }
  return { label: '✅ ปกติ', color: '#16a34a', bg: '#f0fdf4' }
}

function fmtDate(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function BikeDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: bike } = await supabase
    .from('bikes')
    .select('*, branches(name)')
    .eq('id', params.id)
    .single()
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
  const branch = bike.branches as { name: string } | null
  const totalRentals = rentalHistory?.length ?? 0

  // คำนวณ oil change warning
  const odometerVal = bike.odometer ?? 0
  const lastOilKm = bike.last_oil_change_km ?? 0
  const oilChangeKm = bike.oil_change_km ?? 3000
  const kmSinceOil = odometerVal - lastOilKm
  const oilDue = kmSinceOil >= oilChangeKm * 0.9

  return (
    <AppLayout title={bike.license_plate} subtitle={`${bike.brand} ${bike.model}`} backHref="/bikes" headerStyle="dark">

      {/* Hero */}
      <div style={{ position: 'relative' }}>
        {bike.photo_url ? (
          <div style={{ width: '100%', height: '220px', position: 'relative', overflow: 'hidden' }}>
            <img src={bike.photo_url} alt={bike.license_plate}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ) : (
          <div style={{
            width: '100%', height: '180px', background: 'linear-gradient(160deg,#0f172a,#1e3a8a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
            color: 'rgba(255,255,255,0.4)',
          }}>
            <div style={{ fontSize: '64px' }}>🛵</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>ยังไม่มีรูปภาพ</div>
          </div>
        )}
        <div style={{ background: 'linear-gradient(160deg,#0f172a,#1e3a8a)', padding: '16px', color: '#fff' }}>
          <div style={{ fontSize: '24px', fontWeight: 900 }}>{bike.license_plate}</div>
          <div style={{ fontSize: '14px', opacity: 0.8, marginTop: '2px' }}>
            {bike.brand} {bike.model}{bike.year ? ` • ปี ${bike.year}` : ''}{bike.color ? ` • ${bike.color}` : ''}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <span style={heroBadge}>{cfg.label}</span>
            {branch && <span style={heroBadge}>🏢 {branch.name}</span>}
            <span style={heroBadge}>฿{Number(bike.daily_rate).toLocaleString()}/วัน</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '12px' }}>

        {/* Active rental */}
        {activeRental && (() => {
          const cust = activeRental.customers as unknown as { name: string; phone: string } | null
          const end = new Date(activeRental.expected_end_datetime)
          const diffHrs = Math.round((end.getTime() - Date.now()) / 36e5)
          return (
            <div style={{ background: '#eff6ff', borderRadius: '12px', padding: '14px', marginBottom: '12px', border: '1.5px solid #bfdbfe' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8', marginBottom: '8px' }}>🛵 กำลังเช่าอยู่</div>
              <InfoRow label="ลูกค้า" value={cust?.name ?? '-'} />
              <InfoRow label="โทร" value={cust?.phone ?? '-'} />
              <InfoRow label="กำหนดคืน" value={end.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} />
              <InfoRow label="เหลือ" value={diffHrs < 0 ? `เกิน ${Math.abs(diffHrs)} ชม.` : `อีก ${diffHrs} ชม.`} last />
              <Link href={'/rentals/' + activeRental.id} style={{
                display: 'block', marginTop: '10px', textAlign: 'center',
                background: '#2563eb', color: '#fff', padding: '10px', borderRadius: '8px',
                textDecoration: 'none', fontWeight: 700, fontSize: '14px',
              }}>
                ดูรายละเอียดการเช่า →
              </Link>
            </div>
          )
        })()}

        {/* ข้อมูลรถ */}
        <div style={cardStyle}>
          <SectionTitle>ข้อมูลรถ</SectionTitle>
          <InfoRow label="ยี่ห้อ / รุ่น" value={bike.brand + ' ' + bike.model} />
          <InfoRow label="ปีรถ" value={bike.year ? String(bike.year) : '-'} />
          <InfoRow label="สี" value={bike.color ?? '-'} />
          <InfoRow label="เลขไมล์ปัจจุบัน" value={odometerVal.toLocaleString() + ' กม.'} />
          <InfoRow label="เปลี่ยนน้ำมันทุก" value={(bike.oil_change_km ?? 3000).toLocaleString() + ' กม. / ' + (bike.oil_change_days ?? 90) + ' วัน'} />
          <InfoRow label="ราคา/วัน" value={'฿' + Number(bike.daily_rate).toLocaleString()} last />
        </div>

        {/* Oil change warning */}
        {oilDue && (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: '12px', padding: '12px', marginBottom: '12px', fontSize: '13px', color: '#92400e' }}>
            🛢️ ใกล้ถึงกำหนดเปลี่ยนน้ำมัน — ไมล์ปัจจุบัน {odometerVal.toLocaleString()} กม.
          </div>
        )}

        {/* สถานะเอกสาร */}
        <div style={cardStyle}>
          <SectionTitle>📄 สถานะเอกสาร</SectionTitle>
          {[
            { icon: '🛡️', name: 'พ.ร.บ. รถจักรยานยนต์', expiry: bike.compulsory_expiry },
            { icon: '📋', name: 'ประกันภัย', expiry: bike.insurance_expiry },
            { icon: '💰', name: 'ภาษีประจำปี', expiry: bike.tax_expiry },
          ].map((doc, i, arr) => {
            const st = docStatus(doc.expiry)
            return (
              <div key={doc.name} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none',
              }}>
                <div style={{ fontSize: '22px', flexShrink: 0 }}>{doc.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{doc.name}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '1px' }}>
                    {doc.expiry ? 'หมดอายุ: ' + fmtDate(doc.expiry) : 'ไม่มีข้อมูล'}
                  </div>
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                  background: st.bg, color: st.color, whiteSpace: 'nowrap',
                }}>
                  {st.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* สถิติ */}
        <div style={cardStyle}>
          <SectionTitle>📊 สถิติการใช้งาน</SectionTitle>
          <InfoRow label="จำนวนครั้งที่เช่า (5 ล่าสุด)" value={totalRentals + ' ครั้ง'} last />
        </div>

        {/* ประวัติการเช่า */}
        {rentalHistory && rentalHistory.length > 0 && (
          <div style={cardStyle}>
            <SectionTitle>ประวัติการเช่า</SectionTitle>
            {rentalHistory.map((r, i) => {
              const cust = r.customers as unknown as { name: string } | null
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

        {/* Action */}
        {bike.status === 'available' && (
          <Link href={'/rentals/new?bike_id=' + bike.id} style={{
            display: 'block', textAlign: 'center',
            background: '#2563eb', color: '#fff', padding: '14px', borderRadius: '10px',
            textDecoration: 'none', fontWeight: 700, fontSize: '15px', marginBottom: '12px',
          }}>
            🛵 สร้างการเช่าสำหรับรถคันนี้
          </Link>
        )}

        {/* Danger Zone */}
        <div style={{ ...cardStyle, border: '1.5px solid #fecaca' }}>
          <SectionTitle>⚠️ Danger Zone</SectionTitle>
          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
            การเลิกใช้งานรถจะซ่อนรถจากระบบการเช่า แต่ยังเก็บประวัติและรายได้ไว้ครบถ้วน
          </div>
          <RetireButton bikeId={bike.id} />
        </div>

      </div>
    </AppLayout>
  )
}

// Inline server action component placeholder — ใช้ link ไปหน้า edit แทน
function RetireButton({ bikeId }: { bikeId: string }) {
  return (
    <Link href={'/bikes/' + bikeId + '/retire'} style={{
      display: 'block', textAlign: 'center',
      background: '#fff', color: '#dc2626', border: '2px solid #dc2626',
      padding: '12px', borderRadius: '8px', textDecoration: 'none',
      fontWeight: 700, fontSize: '14px',
    }}>
      🚫 เลิกใช้งานรถคันนี้
    </Link>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: '12px', padding: '14px',
  marginBottom: '12px', border: '1px solid #e5e7eb',
}

const heroBadge: React.CSSProperties = {
  background: 'rgba(255,255,255,0.15)', color: '#fff',
  padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
      {children}
    </div>
  )
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
