import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffOwnBranchId } from '@/lib/staffBranch'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok',
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// params.bikeId here actually holds the bookingId (same slug level)
export default async function BookingConfirmPage({ params }: { params: { bikeId: string } }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const BRANCH_ID = await getStaffOwnBranchId(staffId)
  const supabase = createAdminClient()

  const [{ data: booking }, { data: settings }, { data: shop }, { data: branchReceipt }] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, bikes(license_plate, brand, model, color, year)')
      .eq('id', params.bikeId)
      .single(),
    supabase
      .from('branch_settings')
      .select('contact_phone, contact_line')
      .eq('branch_id', BRANCH_ID)
      .maybeSingle(),
    supabase
      .from('shop_settings')
      .select('shop_name, address, phone, logo_url')
      .limit(1)
      .maybeSingle(),
    // สาขาตั้งชื่อร้าน/ที่อยู่/เบอร์/โลโก้ ในใบเสร็จเองได้ — ใบจองใช้ข้อมูลเดียวกันนี้
    supabase
      .from('branch_settings')
      .select('receipt_shop_name, receipt_address, receipt_phone, receipt_logo_url')
      .eq('branch_id', BRANCH_ID)
      .maybeSingle(),
  ])

  if (!booking) redirect('/staff/home')

  const resolvedShop = {
    shop_name: branchReceipt?.receipt_shop_name || shop?.shop_name || 'Kuma Rental',
    address: branchReceipt?.receipt_address || shop?.address,
    phone: branchReceipt?.receipt_phone || shop?.phone,
    logo_url: branchReceipt?.receipt_logo_url || shop?.logo_url,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bike = (booking as any).bikes
  // For model-based bookings, bike may be null — use requested fields
  const displayBrand = bike?.brand ?? booking.requested_brand ?? ''
  const displayModel = bike?.model ?? booking.requested_model ?? ''

  return (
    <div className="app-wrap">

      <div className="app-header" style={{ background: '#111827' }}>
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div>
          <h1>ยืนยันการจอง</h1>
          <div className="sub">แคปหน้าจอส่งให้ลูกค้าได้เลย</div>
        </div>
      </div>

      <div className="section-pad" style={{ paddingTop: '12px' }}>

        <div className="card" style={{ padding: 0, overflow: 'hidden', fontSize: '13px' }}>

          {/* Header bar */}
          <div style={{
            background: '#111827', color: '#fff', padding: '20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          }}>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '1px' }}>BOOKING</div>
              <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '2px' }}>ใบยืนยันการจอง</div>
            </div>
            {resolvedShop.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolvedShop.logo_url} alt={resolvedShop.shop_name} style={{
                width: '68px', height: '68px', objectFit: 'contain',
                background: '#fff', borderRadius: '8px', padding: '4px',
              }} />
            ) : (
              <div style={{
                width: '52px', height: '52px', border: '1px dashed rgba(255,255,255,.4)',
                borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', color: 'rgba(255,255,255,.6)',
              }}>
                LOGO
              </div>
            )}
          </div>

          <div style={{ padding: '20px' }}>

            {/* Branch + booking meta */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', fontSize: '12px', lineHeight: 1.9 }}>
              <div>
                <div style={{ fontWeight: 700, color: '#111827' }}>{resolvedShop.shop_name}</div>
                {resolvedShop.phone && <div style={{ color: '#6b7280' }}>{resolvedShop.phone}</div>}
                {resolvedShop.address && <div style={{ color: '#6b7280' }}>{resolvedShop.address}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div><span style={{ color: '#6b7280' }}>เลขที่การจอง: </span><strong>#{booking.booking_ref}</strong></div>
                <div><span style={{ color: '#6b7280' }}>วันที่จอง: </span><strong>{new Date(booking.created_at).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' })}</strong></div>
              </div>
            </div>

            <div style={{ borderTop: '2px solid #111827', marginBottom: '12px' }} />

            {/* Bike */}
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#111827', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.5px' }}>รถที่จอง</div>
            <div style={{ marginBottom: '16px', fontSize: '13px', lineHeight: 1.8 }}>
              <div style={{ fontWeight: 700 }}>{displayBrand} {displayModel}</div>
              {bike ? (
                <div style={{ color: '#6b7280', fontSize: '12px' }}>
                  ทะเบียน {bike.license_plate}
                  {bike.color ? ` • ${bike.color}` : ''}
                  {bike.year ? ` • ปี ${bike.year}` : ''}
                </div>
              ) : (
                <div style={{ color: '#6b7280', fontSize: '12px' }}>รุ่นตามที่มี — กำหนดคันจริงก่อนส่งรถ</div>
              )}
            </div>

            {/* Schedule table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', borderBottom: '1px solid #d1d5db' }}>
                  <th style={{ padding: '8px 6px', textAlign: 'left' }}>กำหนดการ</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right' }}>วันที่ / เวลา</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '8px 6px', color: '#6b7280' }}>รับรถ</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>{fmtDate(booking.start_datetime)} · {fmtTime(booking.start_datetime)} น.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '8px 6px', color: '#6b7280' }}>คืนรถ</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>{fmtDate(booking.end_datetime)} · {fmtTime(booking.end_datetime)} น.</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 6px', color: '#6b7280' }}>ระยะเวลา</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700 }}>{booking.total_days} วัน</td>
                </tr>
              </tbody>
            </table>

            {/* Customer */}
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#111827', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.5px' }}>ข้อมูลผู้จอง</div>
            <div style={{ marginBottom: '16px', fontSize: '12px', lineHeight: 1.9 }}>
              <div><span style={{ color: '#6b7280' }}>ชื่อ: </span>{booking.customer_name}</div>
              <div><span style={{ color: '#6b7280' }}>เบอร์โทร: </span>{booking.customer_phone}</div>
              {booking.customer_hotel && <div><span style={{ color: '#6b7280' }}>ที่พัก: </span>{booking.customer_hotel}</div>}
            </div>

            <div style={{ marginBottom: '16px', fontSize: '12px' }}>
              <span style={{ color: '#6b7280' }}>วิธีรับรถ: </span>
              {booking.delivery_type === 'offsite'
                ? `ส่งนอกสถานที่ — ${booking.delivery_address || 'ไม่ระบุที่อยู่'}`
                : 'รับหน้าร้าน'}
            </div>

            {booking.notes && (
              <div style={{ marginBottom: '16px', fontSize: '12px' }}>
                <span style={{ color: '#6b7280' }}>หมายเหตุ: </span>{booking.notes}
              </div>
            )}

            {/* Footer */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.7 }}>
                {settings?.contact_phone && <div>โทร: {settings.contact_phone}</div>}
                {settings?.contact_line && <div>LINE: {settings.contact_line}</div>}
              </div>
              <div style={{ fontSize: '12px', padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: '8px', color: '#111827' }}>
                ยืนยันแล้ว
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', gap: '10px', marginBottom: '80px' }}>
          <Link href="/staff/home" style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#f1f5f9', color: '#475569', textAlign: 'center', textDecoration: 'none', fontWeight: 700, fontSize: '14px' }}>
            กลับหน้าหลัก
          </Link>
          <Link href="/staff/search" style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#111827', color: '#fff', textAlign: 'center', textDecoration: 'none', fontWeight: 700, fontSize: '14px' }}>
            ค้นหาเพิ่ม
          </Link>
        </div>

      </div>
    </div>
  )
}
