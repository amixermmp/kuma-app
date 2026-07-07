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
  monthly_rate: number | null
  deposit_amount: number
  odometer: number
}

type Props = {
  bike: Bike
  staffId: string
  promotions: unknown[] // kept for API compat, not rendered
  preFrom: string | null
  preTo: string | null
}

const SOURCES = [
  { key: 'line',     label: '💬 LINE' },
  { key: 'facebook', label: '📘 Facebook' },
  { key: 'phone',    label: '📱 โทรศัพท์' },
  { key: 'walkin',   label: '🚶 Walk-in' },
]

// ── Pricing formula (same as SendCarForm) ─────────────────────────────────────
function calcDailySegment(days: number, ndr: number, mcr: number) {
  const calcDays = Math.floor(days / 7) * 5 + Math.min(days % 7, 5)
  return { calcDays, price: Math.min(calcDays * ndr, mcr) }
}

function calcShortPrice(totalDays: number, ndr: number) {
  const calcDays = Math.floor(totalDays / 7) * 5 + Math.min(totalDays % 7, 5)
  return { calcDays, total: calcDays * ndr }
}

type MonthSegment = { label: string; days: number; price: number }
type LongResult = {
  months: MonthSegment[]
  remainDays: number
  remainPrice: number
  calcRemainDays: number
  total: number
}

function calcLongPrice(start: Date, end: Date, ndr: number, mcr: number): LongResult | null {
  if (end <= start) return null
  let cursor = new Date(start)
  const months: MonthSegment[] = []
  let total = 0

  while (true) {
    const next = new Date(cursor)
    next.setMonth(next.getMonth() + 1)
    if (next >= end) break

    const rawDays = Math.round((next.getTime() - cursor.getTime()) / 86_400_000)
    const effectiveDays = Math.max(rawDays, 30)
    const label =
      cursor.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) +
      ' – ' +
      next.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })

    months.push({ label, days: effectiveDays, price: mcr })
    total += mcr
    cursor = effectiveDays > rawDays
      ? new Date(cursor.getTime() + effectiveDays * 86_400_000)
      : next
  }

  const remainDays = Math.round((end.getTime() - cursor.getTime()) / 86_400_000)
  let remainPrice = 0
  let calcRemainDays = 0
  if (remainDays > 0) {
    const seg = calcDailySegment(remainDays, ndr, mcr)
    calcRemainDays = seg.calcDays
    remainPrice = seg.price
    total += remainPrice
  }

  return { months, remainDays, remainPrice, calcRemainDays, total }
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short',
  })
}

export default function BookingForm({ bike, staffId, preFrom, preTo }: Props) {
  const router = useRouter()

  const [from, setFrom]                 = useState(preFrom ?? '')
  const [to, setTo]                     = useState(preTo ?? '')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerHotel, setCustomerHotel] = useState('')
  const [source, setSource]             = useState('line')
  const [studentPromo, setStudentPromo] = useState(false)
  const [notes, setNotes]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')

  // ── Derived ──────────────────────────────────────────────────────────────
  const startDt = from ? new Date(from) : null
  const endDt   = to   ? new Date(to)   : null
  const totalDays = startDt && endDt && endDt > startDt
    ? Math.ceil((endDt.getTime() - startDt.getTime()) / 86_400_000)
    : 0

  const ndr = studentPromo ? bike.daily_rate - 50 : bike.daily_rate
  const mcr = bike.monthly_rate ?? bike.daily_rate * 30
  const isLong = totalDays >= 30

  const longResult  = isLong && startDt && endDt ? calcLongPrice(startDt, endDt, ndr, mcr) : null
  const shortResult = !isLong && totalDays > 0 ? calcShortPrice(totalDays, ndr) : null

  const totalAmount = isLong ? (longResult?.total ?? 0) : (shortResult?.total ?? 0)

  // discount = diff from non-student price (for API record)
  const normalTotal = isLong
    ? (calcLongPrice(startDt!, endDt!, bike.daily_rate, mcr)?.total ?? 0)
    : calcShortPrice(totalDays, bike.daily_rate).total
  const discount = studentPromo ? Math.max(0, normalTotal - totalAmount) : 0

  const freeWeeks = Math.floor(totalDays / 7)

  // ── Customer lookup ──────────────────────────────────────────────────────
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

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!customerName.trim())  { setError('กรุณาใส่ชื่อลูกค้า'); return }
    if (!customerPhone.trim()) { setError('กรุณาใส่เบอร์โทร'); return }
    if (!from || !to)          { setError('กรุณาเลือกวันเวลา'); return }
    if (!endDt || !startDt || endDt <= startDt) { setError('วันคืนต้องหลังวันเช่า'); return }

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
          promoId: null,
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
      <div className="app-header" style={{ background: '#111827' }}>
        <Link href="/staff/search" className="app-header-back">←</Link>
        <div>
          <h1>จองคิว</h1>
          <div className="sub">กรอกข้อมูลการจอง</div>
        </div>
      </div>

      <div className="section-pad">

        {/* Bike summary */}
        <div style={{
          background: 'linear-gradient(135deg,#111827,#1e293b)',
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
            {from && to && totalDays > 0 && (
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
            <div style={{ fontSize: '22px', fontWeight: 800 }}>
              {totalDays > 0 ? `${totalDays} วัน` : '—'}
            </div>
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

        {/* โปรโมชั่น — student promo */}
        <div className="card">
          <div className="card-title">โปรโมชั่น</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setStudentPromo(false)} style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              border: `2px solid ${!studentPromo ? '#111827' : '#e5e7eb'}`,
              background: !studentPromo ? '#ecfeff' : '#fff',
              color: !studentPromo ? '#111827' : '#6b7280',
              fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
            }}>ราคาปกติ</button>
            <button onClick={() => setStudentPromo(true)} style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              border: `2px solid ${studentPromo ? '#7c3aed' : '#e5e7eb'}`,
              background: studentPromo ? '#f5f3ff' : '#fff',
              color: studentPromo ? '#7c3aed' : '#6b7280',
              fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
            }}>🎓 ราคานักศึกษา</button>
          </div>
          {studentPromo && (
            <div style={{ marginTop: '10px', background: '#f1f5f9', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#374151' }}>
              ลด ฿50/วัน จากราคารายวันปกติ — ไม่รวมค่าเช่ารายเดือน
            </div>
          )}
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
                fontSize: '13px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
                background: source === s.key ? '#111827' : '#fff',
                color: source === s.key ? '#fff' : '#6b7280',
                borderColor: source === s.key ? '#111827' : '#e5e7eb',
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
            placeholder="เช่น ลูกค้าขอรถสีดำ, ต้องการ GPS..."
            value={notes} onChange={e => setNotes(e.target.value)}
            style={{ resize: 'none' }}
          />
        </div>

        <div style={{
          background: '#f9fafb', border: '1px solid #99f6e4',
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
            background: '#111827', color: '#fff',
            fontSize: '16px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            opacity: loading ? 0.7 : 1, marginBottom: '24px',
          }}
        >
          {loading ? '⏳ กำลังบันทึก...' : '📅 ยืนยันการจอง'}
        </button>

      </div>
    </div>
  )
}
