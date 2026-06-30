'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Props = {
  brand: string
  model: string
  dailyRate: number
  from: string
  to: string
  staffId: string
}

const SOURCES = [
  { key: 'line',     label: '💬 LINE' },
  { key: 'facebook', label: '📘 Facebook' },
  { key: 'phone',    label: '📱 โทรศัพท์' },
  { key: 'walkin',   label: '🚶 Walk-in' },
]

function daysBetween(from: string, to: string) {
  return Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000))
}

// datetime-local values have no timezone — treat as Bangkok (+07:00) and convert to UTC ISO
function bangkokToUTC(localStr: string) {
  const s = localStr.length === 16 ? localStr + ':00' : localStr
  return new Date(s + '+07:00').toISOString()
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short',
  })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function BookingModelForm({ brand, model, dailyRate, from, to, staffId }: Props) {
  const router = useRouter()

  const [customerName, setCustomerName]   = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerHotel, setCustomerHotel] = useState('')
  const [source, setSource]               = useState('line')
  const [notes, setNotes]                 = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')

  const totalDays   = daysBetween(from, to)
  const totalAmount = dailyRate * totalDays

  const lookupCustomer = useCallback(async (phone: string) => {
    if (phone.replace(/\D/g, '').length < 9) return
    try {
      const res = await fetch(`/api/staff/customer/lookup?phone=${encodeURIComponent(phone)}`)
      const { customer } = await res.json()
      if (customer) {
        setCustomerName(customer.name)
        setCustomerHotel(customer.workplace ?? '')
      }
    } catch { /* silent */ }
  }, [])

  const handleSubmit = async () => {
    if (!customerName.trim())  { setError('กรุณาใส่ชื่อลูกค้า'); return }
    if (!customerPhone.trim()) { setError('กรุณาใส่เบอร์โทร'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/staff/booking/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId,
          requestedBrand: brand,
          requestedModel: model,
          requestedDailyRate: dailyRate,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerHotel: customerHotel.trim() || null,
          startDatetime: bangkokToUTC(from),
          endDatetime: bangkokToUTC(to),
          totalDays,
          dailyRate,
          totalAmount,
          discount: 0,
          source,
          notes: notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      router.push(`/staff/booking/${data.bookingId}/confirm`)
    } catch {
      setError('เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-wrap">

      <div className="app-header" style={{ background: '#0891b2' }}>
        <Link href="/staff/search" className="app-header-back">←</Link>
        <div>
          <h1>จองคิว</h1>
          <div className="sub">กรอกข้อมูลผู้จอง</div>
        </div>
      </div>

      <div className="section-pad">

        {/* Bike model card */}
        <div style={{
          background: 'linear-gradient(135deg,#0891b2,#0e7490)',
          borderRadius: '14px', padding: '14px 16px', marginBottom: '12px',
          color: '#fff', display: 'flex', alignItems: 'center', gap: '14px',
        }}>
          <div style={{ fontSize: '44px' }}>🛵</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '17px', fontWeight: 800 }}>{brand} {model}</div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '3px' }}>
              {fmtDateShort(from)} {fmtTime(from)} → {fmtDateShort(to)} {fmtTime(to)}
            </div>
            <div style={{ marginTop: '8px' }}>
              <span style={{ background: 'rgba(255,255,255,.2)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
                {totalDays} วัน
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '22px', fontWeight: 800 }}>฿{totalAmount.toLocaleString()}</div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>฿{dailyRate.toLocaleString()}/วัน</div>
          </div>
        </div>

        {/* Note about bike assignment */}
        <div style={{
          background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px',
          padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: '#1d4ed8',
        }}>
          📋 รถคันที่ใช้จริงจะถูกกำหนดโดย Staff ก่อนส่งรถ
        </div>

        {/* Customer */}
        <div className="card">
          <div className="card-title">ข้อมูลลูกค้า</div>
          <div className="field-row">
            <label className="field-label">เบอร์โทรศัพท์ *</label>
            <input className="field-input" type="tel" placeholder="081-234-5678"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              onBlur={e => lookupCustomer(e.target.value)}
            />
          </div>
          <div className="field-row">
            <label className="field-label">ชื่อ - นามสกุล *</label>
            <input className="field-input" type="text" placeholder="สมชาย ดีใจ"
              value={customerName} onChange={e => setCustomerName(e.target.value)} />
          </div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">โรงแรม / ที่พัก</label>
            <input className="field-input" type="text" placeholder="Nap Park Hotel"
              value={customerHotel} onChange={e => setCustomerHotel(e.target.value)} />
          </div>
        </div>

        {/* Source */}
        <div className="card">
          <div className="card-title">ช่องทางที่ลูกค้าติดต่อมา</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {SOURCES.map(s => (
              <button key={s.key} onClick={() => setSource(s.key)} style={{
                padding: '8px 16px', borderRadius: '20px', border: '1.5px solid',
                fontSize: '13px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
                background: source === s.key ? '#0891b2' : '#fff',
                color: source === s.key ? '#fff' : '#6b7280',
                borderColor: source === s.key ? '#0891b2' : '#e5e7eb',
              }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <div className="card-title">หมายเหตุ</div>
          <textarea className="field-input" rows={2}
            placeholder="เช่น ลูกค้าขอรถสีแดง, ต้องการ GPS..."
            value={notes} onChange={e => setNotes(e.target.value)}
            style={{ resize: 'none' }}
          />
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
            background: '#0891b2', color: '#fff', fontSize: '16px', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            opacity: loading ? 0.7 : 1, marginBottom: '24px',
          }}
        >
          {loading ? '⏳ กำลังบันทึก...' : '📅 ยืนยันการจอง'}
        </button>

      </div>
    </div>
  )
}
