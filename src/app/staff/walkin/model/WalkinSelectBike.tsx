'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Bike = {
  id: string
  license_plate: string
  brand: string
  model: string
  color: string | null
  year: number | null
  daily_rate: number
  odometer: number
  available: boolean
}

type Props = {
  brand: string
  model: string
  from: string // datetime-local Bangkok format
  to: string
  totalDays: number
  bikes: Bike[]
}

function fmtDateShort(local: string) {
  const [date, time] = local.split('T')
  const d = new Date(date + 'T' + (time ?? '00:00') + ':00+07:00')
  return d.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' }) +
    ' ' + d.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }) + ' น.'
}

export default function WalkinSelectBike({ brand, model, from, to, totalDays, bikes }: Props) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const available = bikes.filter(b => b.available)
  const busy = bikes.filter(b => !b.available)
  const selectedBike = bikes.find(b => b.id === selectedId)

  const handleConfirm = () => {
    if (!selectedId) return
    router.push(`/staff/send/${selectedId}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
  }

  return (
    <div className="app-wrap">

      <div className="app-header" style={{ background: '#16a34a' }}>
        <Link href="/staff/search" className="app-header-back">←</Link>
        <div>
          <h1>เลือกรถ — Walk-in</h1>
          <div className="sub">{brand} {model}</div>
        </div>
      </div>

      <div className="section-pad">

        {/* Date summary */}
        <div style={{
          background: 'linear-gradient(135deg,#16a34a,#15803d)',
          borderRadius: '14px', padding: '14px 16px', marginBottom: '12px', color: '#fff',
        }}>
          <div style={{ fontSize: '16px', fontWeight: 800 }}>🛵 Walk-in — {brand} {model}</div>
          <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '6px' }}>
            📅 {fmtDateShort(from)} → {fmtDateShort(to)}
          </div>
          <div style={{ marginTop: '8px' }}>
            <span style={{ background: 'rgba(255,255,255,.2)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
              {totalDays} วัน
            </span>
          </div>
        </div>

        {/* Available bikes */}
        {available.length === 0 ? (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px',
            padding: '20px', textAlign: 'center', color: '#dc2626', fontSize: '14px', marginBottom: '12px',
          }}>
            😔 ไม่มี {brand} {model} ว่างในช่วงเวลานี้
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
                    background: selected ? '#f0fdf4' : '#fff',
                    border: `2px solid ${selected ? '#16a34a' : '#e5e7eb'}`,
                    borderRadius: '12px', marginBottom: '8px', padding: '12px 14px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                    transition: 'all .15s',
                  }}
                >
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${selected ? '#16a34a' : '#d1d5db'}`,
                    background: selected ? '#16a34a' : '#fff',
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
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#16a34a' }}>
                      ฿{bike.daily_rate.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>/วัน</div>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* Busy bikes — เลือกได้ผ่าน Fast lane เท่านั้น (ระบบจะเตือนให้ยืนยันตอนกดส่งจริง) */}
        {busy.length > 0 && (
          <>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', marginTop: '8px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>
              ไม่ว่างในช่วงเวลานี้ — เลือกได้ด้วย Fast lane
            </div>
            {busy.map(bike => {
              const selected = selectedId === bike.id
              return (
                <div
                  key={bike.id}
                  onClick={() => setSelectedId(bike.id)}
                  style={{
                    background: selected ? '#eff6ff' : '#f9fafb',
                    border: `2px solid ${selected ? '#2563eb' : '#e5e7eb'}`,
                    borderRadius: '12px', marginBottom: '6px', padding: '10px 14px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
                  }}
                >
                  <div style={{ fontSize: '24px' }}>🛵</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#374151' }}>
                      {bike.brand} {bike.model} • {bike.license_plate}
                    </div>
                    <div style={{ fontSize: '11px', color: '#dc2626' }}>🔴 ไม่ว่าง — ต้องใช้ Fast lane ยืนยันตอนส่งรถ</div>
                  </div>
                  {selected && <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb' }}>⚡ เลือกแล้ว</span>}
                </div>
              )
            })}
          </>
        )}

        {selectedBike && (
          <div style={{
            background: selectedBike.available ? '#f0fdf4' : '#eff6ff',
            border: `1px solid ${selectedBike.available ? '#bbf7d0' : '#bfdbfe'}`,
            borderRadius: '10px', padding: '10px 14px', marginTop: '8px', fontSize: '13px',
            color: selectedBike.available ? '#16a34a' : '#2563eb',
          }}>
            {selectedBike.available ? '✅' : '⚡'} เลือกแล้ว: {selectedBike.license_plate}
            {!selectedBike.available && ' (ต้องยืนยัน Fast lane ตอนกดส่งรถ)'}
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={!selectedId}
          style={{
            width: '100%', padding: '16px', border: 'none', borderRadius: '12px',
            background: selectedId ? '#16a34a' : '#e5e7eb',
            color: selectedId ? '#fff' : '#9ca3af',
            fontSize: '16px', fontWeight: 700, cursor: selectedId ? 'pointer' : 'default',
            fontFamily: 'inherit', marginTop: '16px', marginBottom: '24px',
          }}
        >
          🛵 ยืนยัน — ไปหน้าส่งรถ →
        </button>

      </div>
    </div>
  )
}
