'use client'

import { useState, useCallback } from 'react'
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
  deposit_amount: number
  odometer: number
}

type Promotion = {
  id: string
  code: string
  description: string | null
  discount_type: string
  discount_value: number
}

type Props = {
  bike: Bike
  staffId: string
  promotions: Promotion[]
  preFrom: string | null
  preTo: string | null
}

const SOURCES = [
  { key: 'line', label: '💬 LINE' },
  { key: 'facebook', label: '📘 Facebook' },
  { key: 'phone', label: '📱 โทรศัพท์' },
  { key: 'walkin', label: '🚶 Walk-in' },
]

function daysBetween(from: string, to: string) {
  return Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000))
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short',
  })
}

export default function BookingForm({ bike, staffId, promotions, preFrom, preTo }: Props) {
  const router = useRouter()

  const [from, setFrom] = useState(preFrom ?? '')
  const [to, setTo] = useState(preTo ?? '')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerHotel, setCustomerHotel] = useState('')
  const [source, setSource] = useState('line')
  const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const totalDays = from && to ? daysBetween(from, to) : 0
  const selectedPromo = promotions.find(p => p.id === selectedPromoId)
  const discount = selectedPromo
    ? selectedPromo.discount_type === 'percent'
      ? (bike.daily_rate * totalDays) * (selectedPromo.discount_value / 100)
      : selectedPromo.discount_value
    : 0
  const totalAmount = Math.max(0, bike.daily_rate * totalDays - discount)

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
    if (!customerName.trim()) { setError('กรุณาใส่ชื่อลูกค้า'); return }
    if (!customerPhone.trim()) { setError('กรุณาใส่เบอร์โทร'); return }
    if (!from || !to) { setError('กรุณาเลือกวันเวลา'); return }
    if (new Date(to) <= new Date(from)) { setError('วันคืนต้องหลังวันเช่า'); return }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/staff/booking/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bikeId: bike.id,
          staffId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerHotel: customerHotel.trim() || null,
          startDatetime: from,
          endDatetime: to,
          totalDays,
          dailyRate: bike.daily_rate,
          totalAmount,
          discount,
          source,
          promoId: selectedPromoId,
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

      {/* Header */}
      <div className="app-header" style={{ background: '#0891b2' }}>
        <Link href="/staff/search" className="app-header-back">←</Link>
        <div>
          <h1>จองคิว</h1>
          <div className="sub">กรอกข้อมูลการจอง</div>
        </div>
      </div>

      <div className="section-pad">

        {/* Bike summary */}
        <div style={{
          background: 'linear-gradient(135deg,#0891b2,#0e7490)',
          borderRadius: '14px', padding: '14px 16px', margin: '0 0 12px',
          color: '#fff', display: 'flex', alignItems: 'center', gap: '14px',
        }}>
          <div style={{ fontSize: '44px' }}>🛵</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '17px', fontWeight: 800 }}>{bike.brand} {bike.model}</div>
            <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '2px' }}>
              ทะเบียน {bike.license_plate}
              {bike.color ? ` • ${bike.color}` : ''}
              {bike.year ? ` • ปี ${bike.year}` : ''}
            </div>
            {from && to && (
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ background: 'rgba(255,255,255,.2)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
                  {fmtDateShort(from)} – {fmtDateShort(to)}
                </span>
                <span style={{ background: 'rgba(255,255,255,.2)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
                  {totalDays} วัน
                </span>
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '22px', fontWeight: 800 }}>฿{totalAmount.toLocaleString()}</div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>฿{bike.daily_rate.toLocaleString()}/วัน</div>
          </div>
        </div>

        {/* Date (if not pre-filled) */}
        {(!preFrom || !preTo) && (
          <div className="card">
            <div className="card-title">ช่วงเวลา</div>
            <div className="field-row">
              <label className="field-label">📅 วันเริ่มเช่า *</label>
              <input className="field-input" type="datetime-local"
                value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="field-row" style={{ marginBottom: 0 }}>
              <label className="field-label">📅 วันที่คืนรถ *</label>
              <input className="field-input" type="datetime-local"
                value={to} onChange={e => setTo(e.target.value)} />
            </div>
          </div>
        )}

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
                fontSize: '13px', cursor: 'pointer', fontWeight: 600,
                background: source === s.key ? '#0891b2' : '#fff',
                color: source === s.key ? '#fff' : '#6b7280',
                borderColor: source === s.key ? '#0891b2' : '#e5e7eb',
              }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Promotions */}
        {promotions.length > 0 && (
          <div className="card">
            <div className="card-title">โปรโมชั่น (ถ้ามี)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button onClick={() => setSelectedPromoId(null)} style={{
                padding: '8px 16px', borderRadius: '20px', border: '1.5px solid',
                fontSize: '13px', cursor: 'pointer', fontWeight: 600,
                background: !selectedPromoId ? '#0891b2' : '#fff',
                color: !selectedPromoId ? '#fff' : '#6b7280',
                borderColor: !selectedPromoId ? '#0891b2' : '#e5e7eb',
              }}>ราคาปกติ</button>
              {promotions.map(p => (
                <button key={p.id} onClick={() => setSelectedPromoId(p.id)} style={{
                  padding: '8px 16px', borderRadius: '20px', border: '1.5px solid',
                  fontSize: '13px', cursor: 'pointer', fontWeight: 600,
                  background: selectedPromoId === p.id ? '#0891b2' : '#fff',
                  color: selectedPromoId === p.id ? '#fff' : '#6b7280',
                  borderColor: selectedPromoId === p.id ? '#0891b2' : '#e5e7eb',
                }}>{p.description ?? p.code}</button>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="card">
          <div className="card-title">หมายเหตุ</div>
          <textarea className="field-input" rows={2}
            placeholder="เช่น ลูกค้าขอรถสีดำ, ต้องการ GPS..."
            value={notes} onChange={e => setNotes(e.target.value)}
            style={{ resize: 'none' }}
          />
        </div>

        {/* Price summary */}
        <div className="price-box" style={{ background: 'linear-gradient(135deg,#0891b2,#0e7490)' }}>
          <div className="price-label">ยอดรวมการจอง</div>
          <div className="price-amount">฿{totalAmount.toLocaleString()}</div>
          <div className="price-detail">
            {bike.brand} {bike.model} • {totalDays} วัน
            {discount > 0 ? ` • ลด ฿${discount.toLocaleString()}` : ''}
          </div>
        </div>

        <div style={{
          background: '#f0fdfa', border: '1px solid #99f6e4',
          borderRadius: '10px', padding: '12px 14px', marginBottom: '12px',
          fontSize: '13px', color: '#0f766e',
        }}>
          📌 เมื่อกดยืนยัน รถคันนี้จะถูก <strong>จองล่วงหน้า</strong> และจะขึ้นใน Job Tasks เป็น <strong>งานส่งรถ 🛵➡️</strong> ในวันที่กำหนดอัตโนมัติ
        </div>

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
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', padding: '16px', border: 'none', borderRadius: '12px',
            background: '#0891b2', color: '#fff',
            fontSize: '16px', fontWeight: 700, cursor: 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '⏳ กำลังบันทึก...' : '📅 ยืนยันการจอง'}
        </button>

      </div>
    </div>
  )
}
