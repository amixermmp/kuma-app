'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BookingConflictModal from '@/components/staff/BookingConflictModal'

type Rental = {
  id: string
  bike_id: string
  bikes: { id: string; license_plate: string; brand: string; model: string }
  customers: { name: string; phone: string | null }
  label: string
  swap_log?: { date: string; from_plate: string; to_plate: string; type: string; reason: string | null }[]
}

type AvailableBike = {
  id: string
  license_plate: string
  brand: string
  model: string
  daily_rate: number
}

type PendingBooking = {
  id: string
  booking_ref: string
  customer_name: string
  customer_phone: string | null
  start_datetime: string
  end_datetime: string
  total_days: number
  daily_rate: number
}

type Props = {
  rentalType: 'daily' | 'monthly'
  rental: Rental
  availableBikes: AvailableBike[]
  pendingBookings: PendingBooking[]
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function SwapForm({ rentalType, rental, availableBikes, pendingBookings }: Props) {
  const router = useRouter()
  const [swapType, setSwapType] = useState<'temp' | 'permanent'>('temp')
  const [selectedBikeId, setSelectedBikeId] = useState('')
  const [reason, setReason] = useState('')
  // queue: set of booking IDs to reassign
  const [reassignIds, setReassignIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [conflicts, setConflicts] = useState<any[]>([])

  // When swapType changes: permanent → check all queue items; temp → uncheck all
  useEffect(() => {
    if (swapType === 'permanent') {
      setReassignIds(new Set(pendingBookings.map(b => b.id)))
    } else {
      setReassignIds(new Set())
    }
  }, [swapType, pendingBookings])

  const toggleReassign = (id: string) => {
    setReassignIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedBike = availableBikes.find(b => b.id === selectedBikeId)
  const bike = rental.bikes
  const customer = rental.customers
  const swapLog = rental.swap_log ?? []
  const typeLabel = rentalType === 'monthly' ? 'รายเดือน' : 'รายวัน'

  const handleSubmit = async () => {
    if (!selectedBikeId) { setError('กรุณาเลือกรถคันใหม่'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/staff/rental/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rentalType,
          rentalId: rental.id,
          newBikeId: selectedBikeId,
          swapType,
          reason: reason.trim() || null,
          reassignBookingIds: Array.from(reassignIds),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'เกิดข้อผิดพลาด'); return }
      const nextHref = swapType === 'temp' ? `/staff/broken/${rental.bike_id}` : '/staff/jobs'
      if (data.conflicts?.length > 0) { setConflicts(data.conflicts); return }
      // temp swap → เด้งไปแจ้งซ่อมรถคันเก่าทันที
      router.push(nextHref)
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-wrap">

      {/* Header */}
      <div className="app-header" style={{ background: '#111827' }}>
        <Link href="/staff/jobs" className="app-header-back">←</Link>
        <div>
          <h1>สลับรถ{typeLabel}</h1>
          <div className="sub">{bike.license_plate} {bike.brand} {bike.model}</div>
        </div>
      </div>

      <div className="section-pad">

        {/* ข้อมูลปัจจุบัน */}
        <div className="card" style={{ borderTop: '3px solid #7c3aed' }}>
          <div className="card-title">สัญญาปัจจุบัน ({typeLabel})</div>
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
          <div className="info-row" style={{ borderBottom: 'none' }}>
            <span className="info-key">ค่าเช่า</span>
            <span className="info-val">{rental.label}</span>
          </div>
        </div>

        {/* ประเภทการสลับ */}
        <div className="card">
          <div className="card-title">ประเภทการสลับ</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button onClick={() => setSwapType('temp')} style={{
              flex: 1, padding: '12px 8px', borderRadius: '10px',
              border: `2px solid ${swapType === 'temp' ? '#dc2626' : '#e5e7eb'}`,
              background: swapType === 'temp' ? '#fef2f2' : '#fff',
              color: swapType === 'temp' ? '#dc2626' : '#6b7280',
              fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              🔧 ซ่อม (ชั่วคราว)
            </button>
            <button onClick={() => setSwapType('permanent')} style={{
              flex: 1, padding: '12px 8px', borderRadius: '10px',
              border: `2px solid ${swapType === 'permanent' ? '#16a34a' : '#e5e7eb'}`,
              background: swapType === 'permanent' ? '#f0fdf4' : '#fff',
              color: swapType === 'permanent' ? '#16a34a' : '#6b7280',
              fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              🔄 เปลี่ยนถาวร
            </button>
          </div>
          <div style={{
            background: swapType === 'temp' ? '#fef2f2' : '#f0fdf4',
            borderRadius: '8px', padding: '10px 12px',
            fontSize: '12px', color: swapType === 'temp' ? '#dc2626' : '#16a34a',
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
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
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
              <div style={{ flex: 1, background: '#f9fafb', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>คืน</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{bike.license_plate}</div>
                <div style={{ fontSize: '11px', color: swapType === 'temp' ? '#dc2626' : '#16a34a', marginTop: '2px' }}>
                  → {swapType === 'temp' ? 'ซ่อม' : 'ว่าง'}
                </div>
              </div>
              <div style={{ fontSize: '20px', color: '#9ca3af' }}>⇄</div>
              <div style={{ flex: 1, background: '#f0fdf4', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>ให้ลูกค้า</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{selectedBike.license_plate}</div>
                <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '2px' }}>→ เช่าอยู่</div>
              </div>
            </div>
          </div>
        )}

        {/* คิวการจองที่รอ (queue) */}
        {pendingBookings.length > 0 && (
          <div className="card" style={{ borderTop: '3px solid #d97706' }}>
            <div className="card-title">
              📋 คิวการจองรออยู่ ({pendingBookings.length} รายการ)
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '10px' }}>
              {swapType === 'permanent'
                ? 'สลับถาวร — ระบบเลือกสลับคิวให้อัตโนมัติ สามารถยกเลิกเลือกได้'
                : 'สลับชั่วคราว — เลือกว่าจะโยกคิวไปรถคันใหม่หรือไม่'}
            </div>
            {pendingBookings.map(bk => {
              const checked = reassignIds.has(bk.id)
              return (
                <div
                  key={bk.id}
                  onClick={() => toggleReassign(bk.id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                    padding: '10px 12px', borderRadius: '10px', marginBottom: '6px',
                    border: `2px solid ${checked ? '#d97706' : '#e5e7eb'}`,
                    background: checked ? '#fffbeb' : '#f9fafb',
                    cursor: 'pointer',
                  }}
                >
                  {/* Checkbox */}
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0, marginTop: '1px',
                    border: `2px solid ${checked ? '#d97706' : '#d1d5db'}`,
                    background: checked ? '#d97706' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {checked && <span style={{ color: '#fff', fontSize: '12px', fontWeight: 900 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                      {bk.customer_name}
                      {bk.customer_phone && <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 400 }}> • {bk.customer_phone}</span>}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                      📅 {fmtDate(bk.start_datetime)} → {fmtDate(bk.end_datetime)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>
                      {bk.total_days} วัน · ฿{Number(bk.daily_rate).toLocaleString()}/วัน · #{bk.booking_ref}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px',
                    background: checked ? '#d97706' : '#e5e7eb',
                    color: checked ? '#fff' : '#6b7280',
                    flexShrink: 0, alignSelf: 'center',
                  }}>
                    {checked ? 'สลับด้วย' : 'ปล่อยไว้'}
                  </div>
                </div>
              )
            })}
            {reassignIds.size > 0 && selectedBike && (
              <div style={{ fontSize: '12px', color: '#d97706', marginTop: '4px', fontWeight: 600 }}>
                ⚠️ คิว {reassignIds.size} รายการจะถูกโยกไปที่ {selectedBike.license_plate}
              </div>
            )}
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

        {/* ประวัติการสลับ (monthly เท่านั้น) */}
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
                  width: '8px', height: '8px', borderRadius: '50%', marginTop: '5px', flexShrink: 0,
                  background: log.type === 'temp' ? '#dc2626' : '#16a34a',
                }} />
                <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.5 }}>
                  <span style={{ color: '#111827', fontWeight: 600 }}>{log.date}</span>
                  {' — '}{log.type === 'temp' ? 'ซ่อมชั่วคราว' : 'เปลี่ยนถาวร'}
                  <br />{log.from_plate} → {log.to_plate}
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

      <BookingConflictModal
        conflicts={conflicts}
        onAcknowledge={() => {
          router.push(swapType === 'temp' ? `/staff/broken/${rental.bike_id}` : '/staff/jobs')
          router.refresh()
        }}
      />
    </div>
  )
}
