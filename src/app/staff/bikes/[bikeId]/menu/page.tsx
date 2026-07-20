import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import UnlockButton from './UnlockButton'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  available: 'ว่าง',
  rented: 'กำลังถูกเช่า',
  locked: '🔒 ล็อค',
  repair: 'อยู่ระหว่างซ่อม',
  maintenance: 'อยู่ระหว่างซ่อม',
}
const STATUS_COLOR: Record<string, string> = {
  available: '#16a34a',
  rented: '#374151',
  locked: '#dc2626',
  repair: '#dc2626',
  maintenance: '#dc2626',
}

export default async function BikeMenuPage({ params }: { params: { bikeId: string } }) {
  const cookieStore = await cookies()
  const staffName = cookieStore.get('kuma_staff_name')?.value ?? 'Staff'

  const supabase = createAdminClient()
  const [{ data: bike }, { data: docs }, { data: routines }, { data: activeRental }, { data: activeMonthly }] = await Promise.all([
    supabase
      .from('bikes')
      .select('id, license_plate, brand, model, status, odometer, color, year, fuel_level')
      .eq('id', params.bikeId)
      .single(),
    supabase
      .from('bike_documents')
      .select('doc_type, expiry_date, doc_photo_url')
      .eq('bike_id', params.bikeId)
      .in('doc_type', ['tax', 'pob', 'registration']),
    supabase
      .from('bike_routines')
      .select('id, task_name, interval_km, interval_days, last_done_date, last_done_km, next_due_km, next_due_date')
      .eq('bike_id', params.bikeId),
    supabase
      .from('rentals')
      .select('id')
      .eq('bike_id', params.bikeId)
      .in('status', ['active', 'extended'])
      .maybeSingle(),
    supabase
      .from('monthly_rentals')
      .select('id, customers(name)')
      .eq('bike_id', params.bikeId)
      .eq('status', 'active')
      .maybeSingle(),
  ])

  if (!bike) notFound()

  const today = new Date().toISOString().split('T')[0]
  const taxDoc = (docs ?? []).find(d => d.doc_type === 'tax')
  const pobDoc = (docs ?? []).find(d => d.doc_type === 'pob')
  const regDoc = (docs ?? []).find(d => d.doc_type === 'registration')

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  function isExpired(iso: string) { return iso < today }
  function isNearExpiry(iso: string) {
    const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
    return days >= 0 && days <= 30
  }

  // แถวสถานะเอกสาร (ยกสไตล์จากหน้า owner)
  function docRow(icon: string, name: string, expiry: string | null | undefined, hasPhoto: boolean, isLast = false) {
    const b = expiry
      ? isExpired(expiry) ? { bg: '#fef2f2', c: '#dc2626', t: '🚨 หมดแล้ว' }
        : isNearExpiry(expiry) ? { bg: '#fff7ed', c: '#c2410c', t: '⚠️ ใกล้หมด' }
        : { bg: '#dcfce7', c: '#16a34a', t: '✅ ปกติ' }
      : hasPhoto ? { bg: '#dcfce7', c: '#16a34a', t: '✅ มีแล้ว' } : { bg: '#f3f4f6', c: '#9ca3af', t: '— ไม่มี' }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: isLast ? 'none' : '1px solid #f1f5f9' }}>
        <span style={{ fontSize: '20px' }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{name}</div>
          {expiry && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>หมดอายุ {fmtDate(expiry)}</div>}
        </div>
        <span style={{ fontSize: '11px', fontWeight: 700, color: b.c, background: b.bg, borderRadius: '20px', padding: '3px 10px', whiteSpace: 'nowrap' }}>{b.t}</span>
      </div>
    )
  }

  const rentalId = activeRental?.id ?? null
  const monthlyRentalId = activeMonthly?.id ?? null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monthlyCustomerName = (activeMonthly?.customers as any)?.name ?? null
  const isMonthlyRented = monthlyRentalId !== null

  // Monthly rental overrides the raw bike.status display
  const statusColor = isMonthlyRented ? '#7c3aed' : (STATUS_COLOR[bike.status] ?? '#6b7280')
  const statusLabel = isMonthlyRented ? '🔵 รายเดือน' : (STATUS_LABEL[bike.status] ?? bike.status)
  // เช็คจากสัญญาจริง (rentalId) ไม่ใช่แค่ status field — กัน status ค้างผิดแล้วปุ่มส่งรถยังกดได้
  const isAvailable = bike.status === 'available' && !isMonthlyRented && rentalId === null
  // ปุ่มคืน/ต่อเวลา ต้องมีสัญญา active จริงเท่านั้น (กันปุ่มติดแต่กดแล้วไม่ไปไหน)
  const isRented = (bike.status === 'rented' || bike.status === 'locked') && !monthlyRentalId && rentalId !== null
  // ล็อคค้าง: สถานะ locked แต่ไม่มีสัญญาใดๆ — ให้ปลดล็อคได้
  const isStuckLocked = bike.status === 'locked' && !rentalId && !monthlyRentalId

  const fuelLevel = bike.fuel_level ?? 0
  const fuelDots = Array.from({ length: 8 }, (_, i) => i < fuelLevel ? '●' : '○').join('')

  return (
    <div className="app-wrap">

      {/* Header */}
      <div className="app-header" style={{ background: '#1e293b' }}>
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div>
          <h1>เมนูพนักงาน</h1>
          <div className="sub">{staffName} • {bike.license_plate} {bike.brand} {bike.model}</div>
        </div>
      </div>

      {/* Bike status card */}
      <div style={{
        background: '#fff', padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: '14px',
        borderBottom: '1px solid #e5e7eb',
      }}>
        <span style={{ fontSize: '36px' }}>🛵</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>
            {bike.license_plate} — {bike.brand} {bike.model}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>
            ไมล์: {Number(bike.odometer).toLocaleString()} กม.
            {bike.fuel_level != null && (
              <span style={{ marginLeft: '8px', color: '#16a34a', letterSpacing: '2px' }}>
                น้ำมัน: {fuelDots}
              </span>
            )}
          </div>
        </div>
        <div style={{
          background: `${statusColor}18`, color: statusColor,
          border: `1px solid ${statusColor}44`,
          borderRadius: '20px', padding: '4px 12px',
          fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap',
        }}>
          {statusLabel}
        </div>
      </div>

      {/* Menu */}
      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* รถล็อคค้างโดยไม่มีสัญญา — ปลดล็อคได้ */}
        {isStuckLocked && <UnlockButton bikeId={bike.id} />}

        {/* ส่งรถให้ลูกค้า */}
        <Link
          href={isAvailable ? `/staff/send/${bike.id}` : '#'}
          style={{
            display: 'flex', alignItems: 'center', gap: '16px',
            background: isAvailable ? '#111827' : '#e2e8f0',
            borderRadius: '14px', padding: '18px 20px',
            textDecoration: 'none', opacity: isAvailable ? 1 : 0.5,
            pointerEvents: isAvailable ? 'auto' : 'none',
          }}
        >
          <span style={{ fontSize: '36px' }}>➡️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: isAvailable ? '#fff' : '#64748b' }}>
              ส่งรถให้ลูกค้า
            </div>
            <div style={{ fontSize: '12px', color: isAvailable ? '#e5e7eb' : '#94a3b8', marginTop: '2px' }}>
              บันทึกการเช่าใหม่ — ลูกค้ารับรถ
            </div>
          </div>
        </Link>

        {/* รับรถคืน */}
        <Link
          href={isRented && rentalId ? `/staff/return/${rentalId}` : '#'}
          style={{
            display: 'flex', alignItems: 'center', gap: '16px',
            background: isRented ? '#15803d' : '#e2e8f0',
            borderRadius: '14px', padding: '18px 20px',
            textDecoration: 'none', opacity: isRented ? 1 : 0.5,
            pointerEvents: isRented ? 'auto' : 'none',
          }}
        >
          <span style={{ fontSize: '36px' }}>⬅️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: isRented ? '#fff' : '#64748b' }}>
              รับรถคืน
            </div>
            <div style={{ fontSize: '12px', color: isRented ? '#bbf7d0' : '#94a3b8', marginTop: '2px' }}>
              ตรวจรับ — ปิดการเช่า
            </div>
          </div>
        </Link>

        {/* ค้นหา & ลงคิวจอง */}
        <Link
          href={`/staff/search`}
          style={{
            display: 'flex', alignItems: 'center', gap: '16px',
            background: '#fff', border: '2px solid #111827',
            borderRadius: '14px', padding: '18px 20px',
            textDecoration: 'none',
          }}
        >
          <span style={{ fontSize: '36px' }}>🔍</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: '#111827' }}>
              ค้นหา & ลงคิวจอง
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
              เลือกวันเวลา — ดูรถว่าง — จองล่วงหน้า
            </div>
          </div>
        </Link>

        {/* Monthly rental buttons */}
        {isMonthlyRented && monthlyRentalId && (
          <>
            <Link
              href={`/staff/collect/${monthlyRentalId}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                background: '#7c3aed', borderRadius: '14px', padding: '18px 20px',
                textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: '36px' }}>💰</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '16px', color: '#fff' }}>เก็บค่าเช่ารายเดือน</div>
                <div style={{ fontSize: '12px', color: '#e9d5ff', marginTop: '2px' }}>
                  {monthlyCustomerName ?? 'ผู้เช่า'} — รายเดือน
                </div>
              </div>
            </Link>
            <Link
              href={`/staff/monthly/end/${monthlyRentalId}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                background: '#fff', border: '2px solid #dc2626',
                borderRadius: '14px', padding: '18px 20px',
                textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: '36px' }}>🚫</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '16px', color: '#dc2626' }}>สิ้นสุดสัญญา</div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>คืนรถ — ปลดล็อครถ</div>
              </div>
            </Link>
            <Link
              href={`/staff/line/monthly/${monthlyRentalId}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                background: '#f0fdf4', border: '2px solid #06c755',
                borderRadius: '14px', padding: '18px 20px',
                textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: '36px' }}>💬</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '16px', color: '#047857' }}>ผูกไลน์ลูกค้า</div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>แจ้งเตือนค่าเช่ารายเดือนอัตโนมัติ</div>
              </div>
            </Link>
          </>
        )}

        {/* เมนูรอง */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>

          {/* ต่อเวลา */}
          <Link
            href={isRented && rentalId ? `/staff/extend/${rentalId}` : '#'}
            style={{
              background: isRented ? '#fffbeb' : '#f8fafc',
              border: `2px solid ${isRented ? '#f59e0b' : '#e2e8f0'}`,
              borderRadius: '14px', padding: '16px',
              textDecoration: 'none', opacity: isRented ? 1 : 0.5,
              pointerEvents: isRented ? 'auto' : 'none',
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '6px' }}>⏱️</div>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#92400e' }}>ต่อเวลา</div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>ขยายวันเช่า</div>
          </Link>

          {/* ผูกไลน์ลูกค้า */}
          <Link
            href={isRented && rentalId ? `/staff/line/${rentalId}` : '#'}
            style={{
              background: isRented ? '#f0fdf4' : '#f8fafc',
              border: `2px solid ${isRented ? '#06c755' : '#e2e8f0'}`,
              borderRadius: '14px', padding: '16px',
              textDecoration: 'none', opacity: isRented ? 1 : 0.5,
              pointerEvents: isRented ? 'auto' : 'none',
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '6px' }}>💬</div>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#047857' }}>ผูกไลน์ลูกค้า</div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>แจ้งเตือนอัตโนมัติ</div>
          </Link>

          {/* แจ้งรถเสีย */}
          <Link
            href={`/staff/broken/${bike.id}`}
            style={{
              background: '#fff5f5', border: '2px solid #fca5a5',
              borderRadius: '14px', padding: '16px',
              textDecoration: 'none',
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '6px' }}>🛵💥</div>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#991b1b' }}>แจ้งรถเสีย</div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>รายงานปัญหา</div>
          </Link>

        </div>

        {/* สถานะเอกสาร */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ flex: 1, fontSize: '14px', fontWeight: 700, color: '#111827' }}>📄 สถานะเอกสาร</span>
            <Link href={`/staff/docs?bikeId=${bike.id}`} style={{
              fontSize: '12px', fontWeight: 700, color: '#1d4ed8', background: '#eff6ff',
              border: '1px solid #bfdbfe', borderRadius: '8px', padding: '6px 12px', textDecoration: 'none',
            }}>✏️ ทำรายการ</Link>
          </div>
          {docRow('🛡️', 'พ.ร.บ. รถจักรยานยนต์', pobDoc?.expiry_date, !!pobDoc?.doc_photo_url)}
          {docRow('💰', 'ภาษีประจำปี', taxDoc?.expiry_date, !!taxDoc?.doc_photo_url)}
          {docRow('📘', 'สำเนาหน้าเล่มทะเบียน', null, !!regDoc?.doc_photo_url, true)}
        </div>

        {/* งานรูทีน */}
        <div style={{ background: '#fff', border: '1px solid #fed7aa', borderTop: '3px solid #ea580c', borderRadius: '14px', padding: '14px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '10px' }}>🔧 งานรูทีน</div>
          {(routines ?? []).length === 0 && (
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>ยังไม่มีงานรูทีน</div>
          )}
          {(routines ?? []).map((r, i) => {
            const daysLeft = r.next_due_date ? Math.ceil((new Date(r.next_due_date).getTime() - Date.now()) / 86_400_000) : null
            const kmLeft = r.next_due_km != null ? r.next_due_km - bike.odometer : null
            const isLast = i === (routines ?? []).length - 1
            return (
              <div key={r.id} style={{ borderBottom: isLast ? 'none' : '1px solid #f1f5f9', paddingBottom: isLast ? 0 : '12px', marginBottom: isLast ? 0 : '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{r.task_name}</span>
                  <Link href={`/staff/routine?id=${r.id}`} style={{
                    fontSize: '12px', fontWeight: 700, color: '#c2410c', background: '#fff7ed',
                    border: '1px solid #fed7aa', borderRadius: '8px', padding: '6px 12px', textDecoration: 'none', whiteSpace: 'nowrap',
                  }}>✅ ทำรายการ</Link>
                </div>
                {(daysLeft != null || kmLeft != null) && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {daysLeft != null && (
                      <span style={{ fontSize: '11px', borderRadius: '6px', padding: '2px 8px',
                        background: daysLeft <= 0 ? '#fef2f2' : '#eff6ff', color: daysLeft <= 0 ? '#dc2626' : '#1d4ed8' }}>
                        {daysLeft <= 0 ? `🚨 เลยกำหนด ${Math.abs(daysLeft)} วัน` : `📅 อีก ${daysLeft} วัน`}
                      </span>
                    )}
                    {kmLeft != null && (
                      <span style={{ fontSize: '11px', borderRadius: '6px', padding: '2px 8px',
                        background: kmLeft <= 0 ? '#fef2f2' : '#f0fdf4', color: kmLeft <= 0 ? '#dc2626' : '#16a34a' }}>
                        {kmLeft <= 0 ? `🚨 เลยกำหนด ${Math.abs(kmLeft).toLocaleString()} กม.` : `🛣️ อีก ${kmLeft.toLocaleString()} กม.`}
                      </span>
                    )}
                  </div>
                )}
                <div style={{ fontSize: '11px', color: '#6b7280', display: 'flex', flexWrap: 'wrap', gap: '2px 16px' }}>
                  {r.interval_km ? <span>ทุก {r.interval_km.toLocaleString()} กม.</span> : null}
                  {r.interval_days ? <span>ทุก {r.interval_days} วัน</span> : null}
                  {r.last_done_date ? <span>ทำล่าสุด: {fmtDate(r.last_done_date)}</span> : null}
                  {r.next_due_date ? <span>ครบกำหนด: {fmtDate(r.next_due_date)}</span> : null}
                </div>
              </div>
            )
          })}
        </div>

      </div>

    </div>
  )
}
