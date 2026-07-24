'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { bangkokToUTC, utcToBangkokLocal } from '@/lib/time'
import { calcRentQuote, calendarDays } from '@/lib/pricing'

type BookingInfo = {
  id: string
  bookingRef: string
  bikeLabel: string
  customerName: string
  customerPhone: string
  customerHotel: string
  notes: string
  startDatetime: string
  endDatetime: string
  dailyRate: number
}

export default function EditBookingForm({ booking, monthlyRate }: { booking: BookingInfo; monthlyRate: number }) {
  const router = useRouter()

  const [from, setFrom] = useState(utcToBangkokLocal(booking.startDatetime))
  const [to, setTo] = useState(utcToBangkokLocal(booking.endDatetime))
  const [customerName, setCustomerName]   = useState(booking.customerName)
  const [customerPhone, setCustomerPhone] = useState(booking.customerPhone)
  const [customerHotel, setCustomerHotel] = useState(booking.customerHotel)
  const [notes, setNotes]                 = useState(booking.notes)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [success, setSuccess]             = useState(false)

  const validDates = from && to && new Date(to) > new Date(from)
  const totalDays   = validDates ? calendarDays(new Date(from), new Date(to)) : 0
  const quote       = validDates ? calcRentQuote(new Date(from), totalDays, booking.dailyRate, monthlyRate) : null
  const totalAmount = quote?.total ?? 0

  const handleSubmit = async () => {
    if (!validDates) { setError('วันที่คืนต้องอยู่หลังวันเริ่มเช่า'); return }
    if (!customerName.trim())  { setError('กรุณาใส่ชื่อลูกค้า'); return }
    if (!customerPhone.trim()) { setError('กรุณาใส่เบอร์โทร'); return }
    setLoading(true); setError('')
    try {
      const sendPayload = (overrideConflict: boolean) => fetch('/api/staff/booking/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          startDatetime: bangkokToUTC(from),
          endDatetime: bangkokToUTC(to),
          totalDays,
          totalAmount,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerHotel: customerHotel.trim() || null,
          notes: notes.trim() || null,
          overrideConflict,
        }),
      })
      let res = await sendPayload(false)
      let data = await res.json()
      // ชนคิว — เสนอ Fast lane ให้ยืนยันแก้ไขทำต่อได้ (คิวเดิมจะยังไม่ถูกยกเลิก จะไปโผล่ในคิวมีปัญหาแทน)
      if (!res.ok && data.conflict) {
        const ok = confirm(`⚡ ${data.error}\n\nยืนยันใช้ Fast lane แก้ไขต่อไหม?`)
        if (!ok) { return }
        res = await sendPayload(true)
        data = await res.json()
      }
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      setSuccess(true)
    } catch {
      setError('เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  if (success) return (
    <div className="app-wrap">
      <div style={{ padding: '40px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>แก้ไขคิวจองแล้ว!</div>
        <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>#{booking.bookingRef}</div>
        <button onClick={() => router.push('/staff/send-queue')} className="btn btn-primary" style={{ display: 'inline-block' }}>
          ← กลับหน้าคิวจอง
        </button>
      </div>
    </div>
  )

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: '#111827' }}>
        <Link href="/staff/send-queue" className="app-header-back">←</Link>
        <div>
          <h1>แก้ไขคิวจอง</h1>
          <div className="sub">#{booking.bookingRef}</div>
        </div>
      </div>

      <div className="section-pad">

        <div style={{
          background: 'linear-gradient(135deg,#111827,#1e293b)',
          borderRadius: '14px', padding: '14px 16px', marginBottom: '12px',
          color: '#fff', display: 'flex', alignItems: 'center', gap: '14px',
        }}>
          <div style={{ fontSize: '44px' }}>🛵</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '17px', fontWeight: 800 }}>{booking.bikeLabel}</div>
            {validDates && (
              <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ background: 'rgba(255,255,255,.2)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
                  {totalDays} วัน
                </span>
                <span style={{ background: 'rgba(22,163,74,.35)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
                  ฿{totalAmount.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-title">ช่วงเวลาที่ต้องการ</div>
          <div className="field-row">
            <label className="field-label">📅 วันเริ่มเช่า</label>
            <input className="field-input" type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">📅 วันที่คืนรถ</label>
            <input className="field-input" type="datetime-local" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>

        <div className="card">
          <div className="card-title">ข้อมูลลูกค้า</div>
          <div className="field-row">
            <label className="field-label">เบอร์โทรศัพท์ *</label>
            <input className="field-input" type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
          </div>
          <div className="field-row">
            <label className="field-label">ชื่อ - นามสกุล *</label>
            <input className="field-input" type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} />
          </div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">โรงแรม / ที่พัก</label>
            <input className="field-input" type="text" value={customerHotel} onChange={e => setCustomerHotel(e.target.value)} />
          </div>
        </div>

        <div className="card">
          <div className="card-title">หมายเหตุ</div>
          <textarea className="field-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'none' }} />
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px',
            padding: '12px', color: '#dc2626', fontSize: '14px', marginBottom: '12px',
          }}>
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', padding: '16px', border: 'none', borderRadius: '12px',
            background: '#111827', color: '#fff', fontSize: '16px', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            opacity: loading ? 0.7 : 1, marginBottom: '24px',
          }}
        >
          {loading ? '⏳ กำลังบันทึก...' : '💾 บันทึกการแก้ไข'}
        </button>

      </div>
    </div>
  )
}
