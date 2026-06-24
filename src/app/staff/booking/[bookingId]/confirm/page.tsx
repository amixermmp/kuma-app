import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const BRANCH_ID = '00000000-0000-0000-0000-000000000001'

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

export default async function BookingConfirmPage({ params }: { params: { bookingId: string } }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()

  const [{ data: booking }, { data: settings }] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, bikes(license_plate, brand, model, color, year)')
      .eq('id', params.bookingId)
      .single(),
    supabase
      .from('branch_settings')
      .select('contact_phone, contact_line')
      .eq('branch_id', BRANCH_ID)
      .maybeSingle(),
  ])

  if (!booking) redirect('/staff/home')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bike = (booking as any).bikes

  return (
    <div className="app-wrap" style={{ background: '#f0f9ff' }}>

      {/* Header */}
      <div className="app-header" style={{ background: '#0891b2' }}>
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div>
          <h1>ยืนยันการจอง</h1>
          <div className="sub">แคปหน้าจอส่งให้ลูกค้าได้เลย</div>
        </div>
      </div>

      {/* Hint */}
      <div style={{
        background: '#0891b2', padding: '10px 16px',
        fontSize: '13px', color: 'rgba(255,255,255,.9)', fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        📸 แคปหน้าจอด้านล่างส่งให้ลูกค้าเพื่อยืนยันการจอง
      </div>

      <div style={{ padding: '12px' }}>

        {/* ══ TICKET (ส่วนที่แคป) ══ */}
        <div style={{
          background: '#fff', borderRadius: '20px',
          boxShadow: '0 4px 24px rgba(0,0,0,.12)',
          overflow: 'hidden',
        }}>

          {/* Ticket header */}
          <div style={{
            background: 'linear-gradient(135deg,#0891b2,#0e7490)',
            padding: '20px 20px 16px', color: '#fff',
          }}>
            <div style={{ fontSize: '11px', opacity: 0.8, letterSpacing: '2px', marginBottom: '4px' }}>
              KUMA BIKES — ใบยืนยันการจอง
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '1px' }}>
              #{booking.booking_ref}
            </div>
            <div style={{
              marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: 'rgba(255,255,255,.2)', borderRadius: '20px', padding: '4px 12px',
              fontSize: '13px', fontWeight: 700,
            }}>
              ✅ ยืนยันการจองแล้ว
            </div>
          </div>

          {/* Dashed divider */}
          <div style={{
            borderTop: '2px dashed #e0f2fe', margin: '0 16px',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', left: '-28px', top: '-12px',
              width: '24px', height: '24px', borderRadius: '50%', background: '#f0f9ff',
            }} />
            <div style={{
              position: 'absolute', right: '-28px', top: '-12px',
              width: '24px', height: '24px', borderRadius: '50%', background: '#f0f9ff',
            }} />
          </div>

          {/* Bike info */}
          <div style={{
            padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px',
            borderBottom: '1px solid #f0f9ff',
          }}>
            <div style={{ fontSize: '44px' }}>🛵</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '18px', color: '#0c4a6e' }}>
                {bike.brand} {bike.model}
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
                ทะเบียน {bike.license_plate}
                {bike.color ? ` • ${bike.color}` : ''}
                {bike.year ? ` • ปี ${bike.year}` : ''}
              </div>
            </div>
          </div>

          {/* Date range */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f9ff' }}>
            <div style={{ display: 'flex', gap: '0', alignItems: 'stretch' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, marginBottom: '4px' }}>
                  📅 รับรถ
                </div>
                <div style={{ fontWeight: 800, fontSize: '15px', color: '#0c4a6e' }}>
                  {fmtDate(booking.start_datetime)}
                </div>
                <div style={{ fontSize: '13px', color: '#0891b2', fontWeight: 600 }}>
                  {fmtTime(booking.start_datetime)} น.
                </div>
              </div>
              <div style={{
                width: '1px', background: '#e0f2fe', margin: '0 16px', flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, marginBottom: '4px' }}>
                  🏁 คืนรถ
                </div>
                <div style={{ fontWeight: 800, fontSize: '15px', color: '#0c4a6e' }}>
                  {fmtDate(booking.end_datetime)}
                </div>
                <div style={{ fontSize: '13px', color: '#0891b2', fontWeight: 600 }}>
                  {fmtTime(booking.end_datetime)} น.
                </div>
              </div>
            </div>
            <div style={{
              marginTop: '12px', background: '#f0f9ff', borderRadius: '8px',
              padding: '8px 12px', textAlign: 'center',
              fontSize: '13px', color: '#0891b2', fontWeight: 600,
            }}>
              ⏱ {booking.total_days} วัน
            </div>
          </div>

          {/* Customer */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f9ff' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, marginBottom: '8px' }}>
              👤 ข้อมูลผู้จอง
            </div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#111827' }}>{booking.customer_name}</div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>{booking.customer_phone}</div>
            {booking.customer_hotel && (
              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>🏨 {booking.customer_hotel}</div>
            )}
          </div>

          {/* Price */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f9ff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>
                ฿{booking.daily_rate.toLocaleString()} × {booking.total_days} วัน
              </span>
              <span style={{ fontSize: '13px', color: '#111827', fontWeight: 600 }}>
                ฿{(booking.daily_rate * booking.total_days).toLocaleString()}
              </span>
            </div>
            {booking.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: '#16a34a' }}>ส่วนลด</span>
                <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>
                  -฿{Number(booking.discount).toLocaleString()}
                </span>
              </div>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              borderTop: '1px solid #f0f9ff', paddingTop: '10px', marginTop: '6px',
            }}>
              <span style={{ fontWeight: 700, fontSize: '15px', color: '#111827' }}>ยอดรวม</span>
              <span style={{ fontWeight: 800, fontSize: '20px', color: '#0891b2' }}>
                ฿{Number(booking.total_amount).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Notes */}
          {booking.notes && (
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f9ff' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600, marginBottom: '4px' }}>หมายเหตุ</div>
              <div style={{ fontSize: '13px', color: '#374151' }}>{booking.notes}</div>
            </div>
          )}

          {/* Footer */}
          <div style={{
            padding: '14px 20px', background: '#f0f9ff',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
              KUMA Bikes
            </div>
            {settings?.contact_phone && (
              <div style={{ fontSize: '13px', color: '#0891b2', fontWeight: 600 }}>
                📞 {settings.contact_phone}
              </div>
            )}
            {settings?.contact_line && (
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                💬 LINE: {settings.contact_line}
              </div>
            )}
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px' }}>
              จอง {new Date(booking.created_at).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>

        </div>

        {/* Action buttons (ไม่ถูกแคป) */}
        <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
          <Link href="/staff/home" style={{
            flex: 1, padding: '14px', borderRadius: '12px',
            background: '#f1f5f9', color: '#475569',
            textAlign: 'center', textDecoration: 'none',
            fontWeight: 700, fontSize: '14px',
          }}>
            ← กลับหน้าหลัก
          </Link>
          <Link href="/staff/search" style={{
            flex: 1, padding: '14px', borderRadius: '12px',
            background: '#0891b2', color: '#fff',
            textAlign: 'center', textDecoration: 'none',
            fontWeight: 700, fontSize: '14px',
          }}>
            🔍 ค้นหาเพิ่ม
          </Link>
        </div>

      </div>
    </div>
  )
}
