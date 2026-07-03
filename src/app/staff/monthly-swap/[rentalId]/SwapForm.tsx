'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Rental = {
  id: string
  monthly_rate: number
  payment_day: number
  swap_log: { date: string; from_plate: string; to_plate: string; type: string; reason: string | null }[]
  bikes: { id: string; license_plate: string; brand: string; model: string }
  customers: { name: string; phone: string | null }
}

type AvailableBike = {
  id: string
  license_plate: string
  brand: string
  model: string
  daily_rate: number
}

type Props = {
  rental: Rental
  availableBikes: AvailableBike[]
}

export default function SwapForm({ rental, availableBikes }: Props) {
  const router = useRouter()
  const [swapType, setSwapType] = useState<'temp' | 'permanent'>('temp')
  const [selectedBikeId, setSelectedBikeId] = useState<string>('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selectedBike = availableBikes.find(b => b.id === selectedBikeId)

  const handleSubmit = async () => {
    if (!selectedBikeId) { setError('กรุณาเลือกรถคันใหม่'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/staff/monthly/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rentalId: rental.id,
          newBikeId: selectedBikeId,
          swapType,
          reason: reason.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'เกิดข้อผิดพลาด'); return }
      router.push('/staff/jobs')
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  const bike = rental.bikes
  const customer = rental.customers
  const swapLog = Array.isArray(rental.swap_log) ? rental.swap_log : []

  return (
    <div className="app-wrap">

      {/* Header */}
      <div className="app-header" style={{ background: '#111827' }}>
        <Link href="/staff/jobs" className="app-header-back">←</Link>
        <div>
          <h1>สลับรถรายเดือน</h1>
          <div className="sub">{bike.license_plate} {bike.brand} {bike.model}</div>
        </div>
      </div>

      <div className="section-pad">

        {/* ข้อมูลปัจจุบัน */}
        <div className="card" style={{ borderTop: '3px solid #7c3aed' }}>
          <div className="card-title">สัญญาปัจจุบัน</div>
          <div className="info-row">
            <span className="info-key">ลูกค้า</span>
            <span className="info-val">{customer.name}</span>
          </div>
          {customer.phone && (
            <div className="info-row">
              <span className="info-key">เบอร์โทร</span>
              <span className="info-val">{customer.phone}</span>
            </div>
          )}
          <div className="info-row">
            <span className="info-key">รถปัจจุบัน</span>
            <span className="info-val">{bike.license_plate} {bike.brand} {bike.model}</span>
          </div>
          <div className="info-row">
            <span className="info-key">ชำระทุกวันที่</span>
            <span className="info-val">{rental.payment_day} ทุกเดือน</span>
          </div>
          <div className="info-row" style={{ borderBottom: 'none' }}>
            <span className="info-key">ค่าเช่า</span>
            <span className="info-val">฿{Number(rental.monthly_rate).toLocaleString()}/เดือน</span>
          </div>
        </div>

        {/* ประเภทการสลับ */}
        <div className="card">
          <div className="card-title">ประเภทการสลับ</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button onClick={() => setSwapType('temp')} style={{
              flex: 1, padding: '12px 8px', borderRadius: '10px',
              border: `2px solid ${swapType === 'temp' ? '#185FA5' : '#e5e7eb'}`,
              background: swapType === 'temp' ? '#E6F1FB' : '#fff',
              color: swapType === 'temp' ? '#185FA5' : '#6b7280',
              fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              🔧 ซ่อม (ชั่วคราว)
            </button>
            <button onClick={() => setSwapType('permanent')} style={{
              flex: 1, padding: '12px 8px', borderRadius: '10px',
              border: `2px solid ${swapType === 'permanent' ? '#3B6D11' : '#e5e7eb'}`,
              background: swapType === 'permanent' ? '#EAF3DE' : '#fff',
              color: swapType === 'permanent' ? '#3B6D11' : '#6b7280',
              fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              🔄 เปลี่ยนถาวร
            </button>
          </div>
          <div style={{
            background: swapType === 'temp' ? '#E6F1FB' : '#EAF3DE',
            borderRadius: '8px', padding: '10px 12px',
            fontSize: '12px', color: swapType === 'temp' ? '#185FA5' : '#3B6D11',
          }}>
            {swapType === 'temp'
              ? 'รถคันเก่าจะเปลี่ยนเป็น ซ่อม — สามารถสลับกลับได้เมื่อซ่อมเสร็จ'
              : 'รถคันเก่าจะเปลี่ยนเป็น ว่าง — ลูกค้าใช้คันใหม่ต่อไป'}
          </div>
        </div>

        {/* เลือกรถคันใหม่ */}
        <div className="card">
          <div className="card-title">รถที่ว่าง (เลือกให้ลูกค้า)</div>
          {availableBikes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: '13px' }}>
              ไม่มีรถว่างในสาขานี้
            </div>
          ) : (
            availableBikes.map(b => (
              <div
                key={b.id}
                onClick={() => setSelectedBikeId(b.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px', borderRadius: '10px', marginBottom: '6px', cursor: 'pointer',
                  border: `2px solid ${selectedBikeId === b.id ? '#7c3aed' : '#e5e7eb'}`,
                  background: selectedBikeId === b.id ? '#faf5ff' : '#fff',
                }}
              >
                <div style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: '#16a34a', flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{b.license_plate}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{b.brand} {b.model}</div>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                  ฿{Number(b.daily_rate).toLocaleString()}/วัน
                </div>
              </div>
            ))
          )}
        </div>

        {/* สรุปการสลับ */}
        {selectedBike && (
          <div className="card">
            <div className="card-title">สรุปการสลับ</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                flex: 1, background: '#f9fafb', borderRadius: '8px',
                padding: '10px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>คืน</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{bike.license_plate}</div>
                <div style={{ fontSize: '11px', color: swapType === 'temp' ? '#dc2626' : '#16a34a', marginTop: '2px' }}>
                  → {swapType === 'temp' ? 'ซ่อม' : 'ว่าง'}
                </div>
              </div>
              <div style={{ fontSize: '20px', color: '#9ca3af' }}>⇄</div>
              <div style={{
                flex: 1, background: '#f0fdf4', borderRadius: '8px',
                padding: '10px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>ให้ลูกค้า</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{selectedBike.license_plate}</div>
                <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '2px' }}>→ เช่าอยู่</div>
              </div>
            </div>
          </div>
        )}

        {/* หมายเหตุ */}
        <div className="card">
          <div className="card-title">หมายเหตุ (ไม่บังคับ)</div>
          <input
            className="field-input"
            type="text"
            placeholder="เช่น ส่งซ่อมที่ร้านไมตี้"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>

        {/* ประวัติการสลับ */}
        {swapLog.length > 0 && (
          <div className="card">
            <div className="card-title">ประวัติการสลับ</div>
            {swapLog.map((log, i) => (
              <div key={i} style={{
                display: 'flex', gap: '10px', alignItems: 'flex-start',
                padding: '8px 0',
                borderBottom: i < swapLog.length - 1 ? '1px solid #f1f5f9' : 'none',
              }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50', marginTop: '5px', flexShrink: 0,
                  background: log.type === 'temp' ? '#185FA5' : '#3B6D11',
                }} />
                <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.5 }}>
                  <span style={{ color: '#111827', fontWeight: 600 }}>{log.date}</span>
                  {' — '}{log.type === 'temp' ? 'ซ่อมชั่วคราว' : 'เปลี่ยนถาวร'}
                  <br />
                  {log.from_plate} → {log.to_plate}
                  {log.reason ? ` • ${log.reason}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '10px', padding: '12px', color: '#dc2626',
            fontSize: '14px', marginBottom: '12px',
          }}>
            ⚠️ {error}
          </div>
        )}

        <button
          className="btn"
          onClick={handleSubmit}
          disabled={loading || !selectedBikeId}
          style={{
            width: '100%',
            background: !selectedBikeId ? '#e5e7eb' : '#7c3aed',
            color: !selectedBikeId ? '#9ca3af' : '#fff',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '⏳ กำลังบันทึก...' : '🔄 ยืนยันสลับรถ'}
        </button>

      </div>
    </div>
  )
}
