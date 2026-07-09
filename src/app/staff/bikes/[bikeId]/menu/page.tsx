import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'

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
      .select('doc_type, expiry_date')
      .eq('bike_id', params.bikeId)
      .in('doc_type', ['tax', 'pob']),
    supabase
      .from('bike_routines')
      .select('task_name, last_done_date, next_due_km, next_due_date')
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
  const oilRoutine      = (routines ?? []).find(r => r.task_name === 'เปลี่ยนน้ำมันเครื่อง')
  const gearOilRoutine  = (routines ?? []).find(r => r.task_name === 'เปลี่ยนน้ำมันเฟืองท้าย')
  const taxDoc          = (docs ?? []).find(d => d.doc_type === 'tax')
  const pobDoc          = (docs ?? []).find(d => d.doc_type === 'pob')
  const lastOilDate     = oilRoutine?.last_done_date ?? null
  const lastGearDate    = gearOilRoutine?.last_done_date ?? null
  const taxExpiry       = taxDoc?.expiry_date ?? null
  const pobExpiry       = pobDoc?.expiry_date ?? null

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  function isExpired(iso: string) { return iso < today }
  function isNearExpiry(iso: string) {
    const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
    return days >= 0 && days <= 30
  }
  const overdueCount = [
    ...(docs ?? []).filter(d => d.expiry_date && d.expiry_date < today),
    ...(routines ?? []).filter(r =>
      (r.next_due_km != null && r.next_due_km <= bike.odometer) ||
      (r.next_due_date != null && r.next_due_date < today)
    ),
  ].length

  const rentalId = activeRental?.id ?? null
  const monthlyRentalId = activeMonthly?.id ?? null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monthlyCustomerName = (activeMonthly?.customers as any)?.name ?? null
  const isMonthlyRented = monthlyRentalId !== null

  // Monthly rental overrides the raw bike.status display
  const statusColor = isMonthlyRented ? '#7c3aed' : (STATUS_COLOR[bike.status] ?? '#6b7280')
  const statusLabel = isMonthlyRented ? '🔵 รายเดือน' : (STATUS_LABEL[bike.status] ?? bike.status)
  const isAvailable = bike.status === 'available' && !isMonthlyRented
  const isRented = (bike.status === 'rented' || bike.status === 'locked') && !monthlyRentalId

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
          {(lastOilDate || lastGearDate || taxExpiry || pobExpiry) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {lastOilDate && (
                <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', borderRadius: '6px', padding: '2px 8px' }}>
                  🛢️ น้ำมันเครื่อง {fmtDate(lastOilDate)}
                </span>
              )}
              {lastGearDate && (
                <span style={{ fontSize: '11px', background: '#fef3c7', color: '#78350f', borderRadius: '6px', padding: '2px 8px' }}>
                  ⚙️ เฟืองท้าย {fmtDate(lastGearDate)}
                </span>
              )}
              {taxExpiry && (
                <span style={{ fontSize: '11px', borderRadius: '6px', padding: '2px 8px',
                  background: isExpired(taxExpiry) ? '#fef2f2' : isNearExpiry(taxExpiry) ? '#fff7ed' : '#f0fdf4',
                  color: isExpired(taxExpiry) ? '#dc2626' : isNearExpiry(taxExpiry) ? '#c2410c' : '#15803d',
                }}>
                  📋 ภาษี {isExpired(taxExpiry) ? '⚠️ หมดแล้ว' : fmtDate(taxExpiry)}
                </span>
              )}
              {pobExpiry && (
                <span style={{ fontSize: '11px', borderRadius: '6px', padding: '2px 8px',
                  background: isExpired(pobExpiry) ? '#fef2f2' : isNearExpiry(pobExpiry) ? '#fff7ed' : '#f0fdf4',
                  color: isExpired(pobExpiry) ? '#dc2626' : isNearExpiry(pobExpiry) ? '#c2410c' : '#15803d',
                }}>
                  🛡️ พรบ {isExpired(pobExpiry) ? '⚠️ หมดแล้ว' : fmtDate(pobExpiry)}
                </span>
              )}
            </div>
          )}
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
            <div style={{ font