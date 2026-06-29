'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type AvailableBike = {
  id: string
  license_plate: string
  brand: string
  model: string
  color: string | null
  year: number | null
  daily_rate: number
  monthly_rate: number | null
  deposit_amount: number
  odometer: number
  available: boolean
}

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  booking: any
  assignedBike: AvailableBike | null
  availableBikes: AvailableBike[]
  staffId: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric',
  })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function AssignBikeClient({ booking, assignedBike, availableBikes, staffId }: Props) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(assignedBike?.id ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const targetBrand = booking.requested_brand ?? assignedBike?.brand ?? ''
  const targetModel = booking.requested_model ?? assignedBike?.model ?? ''

  const available = availableBikes.filter(b => b.available)
  const busy = availableBikes.filter(b => !b.available)
  const selectedBike = availableBikes.find(b => b.id === selectedId)

  const handleConfirm = async () => {
    if (!selectedId) { setError('กรุณาเลือกรถก่อน'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/staff/booking/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, bikeId: selectedId, staffId }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error); return }
      router.push(`/staff/send/${selectedId}?bookingId=${booking.id}`)
    } catch { setError('เกิดข้อผิดพลาด') }
    finally { setLoading(false) }
  }

  return (
    <div className="app-wrap">

      <div className="app-header" style={{ background: '#0891b2' }}>
        <Link href="/staff/jobs" className="app-header-back">←</Link>
        <div>
          <h1>เลือกรถส่งลูกค้า</h1>
          <div className="sub">{targetBrand} {targetModel}</div>
        </div>
      </div>

      <div className="section-pad">

        {/* Booking summary */}
        <div style={{
          background: 'linear-gradient(135deg,#0891b2,#0e7490)',
          borderRadius: '14px', padding: '14px 16px', marginBottom: '12px', color: '#fff',
        }}>
          <div style={{ fontSize: '13px', opacity: 0.8, marginBottom: '2px' }}>
            #{booking.booking_ref}
          </div>
          <div style={{ fontSize: '16px', fontWeight: 800 }}>{booking.customer_name}</div>
          <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '2px' }}>{booking.customer_phone}</div>
          <div style={{ marginTop: '10px', fontSize: '12px', opacity: 0.8 }}>
            📅 {fmtDate(booking.start_datetime)} {fmtTime(booking.start_datetime)} น.
            {' '}→{' '}
            {fmtDate(booking.end_datetime)} {fmtTime(booking.end_datetime)} น.
          </div>
          <div style={{ marginTop: '6px', display: 'flex', gap: '8px' }}>
            <span style={{ background: 'rgba(255,255,255,.2)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
              {booking.total_days} วัน
            </span>
            <span style={{ background: 'rgba(255,255,255,.2)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
              🛵 {targetBrand} {targetModel}
            </span>
          </div>
        </div>

        {/* Available bikes */}
        {available.length === 0 ? (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px',
            padding: '20px', textAlign: 'center', color: '#dc2626', fontSize: '14px', marginBottom: '12px',
          }}>
            😔 ไม่มี {targetBrand} {targetModel} ว่างในช่วงเวลานี้<br />
            <span style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px', display: 'block' }}>
              ลองเลือกรถรุ่นอื่นหรือติดต่อลูกค้า
            </span>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' }}>
              เลือกรถที่จะส่ง ({available.length} คันว่าง)
            </div>
            {available.map(bike => {
              const selected = selectedId === bike.id
              return (
                <div
                  key={bike.id}
                  onClick={() => setSelectedId(bike.id)}
                  style={{
                    background: selected ? '#f0f9ff' : '#fff',
                    border: `2px solid ${selected ? '#0891b2' : '#e5e7eb'}`,
                    borderRadius: '12px', marginBottom: '8px', padding: '12px 14px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                    transition: 'all .15s',
                  }}
                >
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${selected ? '#0891b2' : '#d1d5db'}`,
                    background: selected ? '#0891b2' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <div style={{ fontSize: '28px' }}>🛵</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>
                      {bike.brand} {bike.model}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                      ทะเบียน {bike.license_plate}
                      {bike.color ? ` • ${bike.color}` : ''}
                      {bike.year ? ` • ปี ${bike.year}` : ''}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                      📍 {bike.odometer.toLocaleString()} กม.
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0891b2' }}>
                      ฿{bike.daily_rate.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>/วัน</div>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* Busy bikes (greyed out, not selectable) */}
        {busy.length > 0 && (
          <>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', marginTop: '8px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>
              ไม่ว่างในช่วงเวลานี้
            </div>
            {busy.map(bike => (
              <div key={bike.id} style={{
                background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px',
                marginBottom: '6px', padding: '10px 14px', opacity: 0.5,
                display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <div style={{ fontSize: '24px', filter: 'grayscale(1)' }}>🛵</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#6b7280' }}>
                    {bike.brand} {bike.model} • {bike.license_plate}
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>🔴 ไม่ว่างในช่วงเวลานี้</div>
                </div>
              </div>
            ))}
          </>
        )}

        {selectedBike && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px',
            padding: '10px 14px', marginTop: '8px', fontSize: '13px', color: '#16a34a',
          }}>
            ✅ เลือกแล้ว: {selectedBike.brand} {selectedBike.model} ทะเบียน {selectedBike.license_plate}
          </div>
        )}

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px',
            padding: '12px', color: '#dc2626', fontSize: '14px', marginTop: '8px',
          }}>
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={loading || !selectedId}
          style={{
            width: '100%', padding: '16px', border: 'none', borderRadius: '12px',
            background: selectedId ? '#0891b2' : '#e5e7eb',
            color: selectedId ? '#fff' : '#9ca3af',
            fontSize: '16px', fontWeight: 700, cursor: selectedId ? 'pointer' : 'default',
            fontFamily: 'inherit', opacity: loading ? 0.7 : 1, marginTop: '16px', marginBottom: '24px',
          }}
        >
          {loading ? '⏳ กำลังดำเนินการ...' : '🛵 ยืนยัน — ไปหน้าส่งรถ →'}
        </button>

      </div>
    </div>
  )
}
