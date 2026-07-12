'use client'

import { useState, useCallback } from 'react'
import { bangkokToUTC } from '@/lib/time'
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

function daysBetween(from: string, to: string) {
  return Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000))
}

function toLocalDatetime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function OwnerSendForm({ bike }: { bike: Bike }) {
  const router = useRouter()

  const now = new Date()
  const defaultEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const [from, setFrom] = useState(toLocalDatetime(now))
  const [to, setTo] = useState(toLocalDatetime(defaultEnd))
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerHotel, setCustomerHotel] = useState('')
  const [depositAmount, setDepositAmount] = useState(String(bike.deposit_amount || 0))
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const totalDays = from && to ? daysBetween(from, to) : 1
  const totalAmount = bike.daily_rate * totalDays

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
      const res = await fetch('/api/owner/rental/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bikeId: bike.id,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerHotel: customerHotel.trim() || null,
          startDatetime: bangkokToUTC(from),
          endDatetime: bangkokToUTC(to),
          dailyRate: bike.daily_rate,
          totalDays,
          totalAmount,
          depositAmount: parseFloat(depositAmount) || 0,
          paymentMethod,
          notes: notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      router.push(`/owner/bikes/${bike.id}`)
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: '#111827' }}>
        <Link href={`/owner/bikes/${bike.id}`} className="app-header-back">←</Link>
        <div>
          <h1>ส่งรถ</h1>
          <div className="sub">{bike.license_plate} — {bike.brand} {bike.model}</div>
        </div>
      </div>

      <div className="section-pad">

        {/* Bike summary */}
        <div style={{
          background: '#111827',
          borderRadius: '14px', padding: '14px 16px', marginBottom: '12px',
          color: '#fff', display: 'flex', alignItems: 'center', gap: '14px',
        }}>
          <div style={{ fontSize: '44px' }}>🛵</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '17px', fontWeight: 800 }}>{bike.brand} {bike.model}</div>
            <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '2px' }}>
              {bike.license_plate}{bike.color ? ` • ${bike.color}` : ''}{bike.year ? ` • ปี ${bike.year}` : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '22px', fontWeight: 800 }}>฿{totalAmount.toLocaleString()}</div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>฿{bike.daily_rate.toLocaleString()}/วัน × {totalDays} วัน</div>
          </div>
        </div>

        {/* วันเวลา */}
        <div className="card">
          <div className="card-title">📅 ช่วงเวลาเช่า</div>
          <div className="field-row">
            <label className="field-label">วันเริ่มเช่า *</label>
            <input className="field-input" type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">วันที่คืนรถ *</label>
            <input className="field-input" type="datetime-local" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>

        {/* ข้อมูลลูกค้า */}
        <div className="card">
          <div className="card-title">👤 ข้อมูลลูกค้า</div>
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

        {/* การเงิน */}
        <div className="card">
          <div className="card-title">💰 การเงิน</div>
          <div className="field-row">
            <label className="field-label">ค่ามัดจำ (บาท)</label>
            <input className="field-input" type="number" placeholder="500"
              value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
          </div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">วิธีชำระเงิน</label>
            <select className="field-input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option value="cash">💵 เงินสด</option>
              <option value="transfer">🏦 โอนเงิน</option>
              <option value="card">💳 บัตรเครดิต</option>
            </select>
          </div>
        </div>

        {/* หมายเหตุ */}
        <div className="card">
          <div className="card-title">หมายเหตุ</div>
          <textarea className="field-input" rows={2}
            placeholder="รายละเอียดเพิ่มเติม..."
            value={notes} onChange={e => setNotes(e.target.value)}
            style={{ resize: 'none' }}
          />
        </div>

        {/* สรุปราคา */}
        <div className="price-box">
          <div className="price-label">ยอดรวมการเช่า</div>
          <div className="price-amount">฿{totalAmount.toLocaleString()}</div>
          <div className="price-detail">{bike.brand} {bike.model} • {totalDays} วัน • ฿{bike.daily_rate.toLocaleString()}/วัน</div>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', color: '#dc2626', fontSize: '14px', marginBottom: '12px' }}>
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{ width: '100%', padding: '16px', border: 'none', borderRadius: '12px', background: '#e11d48', color: '#fff', fontSize: '16px', fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? '⏳ กำลังบันทึก...' : '✅ ยืนยันส่งรถ'}
        </button>

      </div>
    </div>
  )
}
