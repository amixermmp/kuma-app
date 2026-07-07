'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Rental = {
  id: string
  expected_end_datetime: string
  total_amount: number
  daily_rate: number
  outstanding_credit: number
  status: string
  bikes: { id: string; license_plate: string; brand: string; model: string }
  customers: { id: string; name: string }
}

type Props = {
  rental: Rental
  staffId: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function ExtendForm({ rental }: Props) {
  const router = useRouter()
  const bike = rental.bikes
  const customer = rental.customers

  const [payment, setPayment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const paymentNum = parseFloat(payment) || 0
  const existingCredit = rental.outstanding_credit ?? 0
  const totalAvailable = existingCredit + paymentNum
  const daysCovered = totalAvailable > 0 ? Math.floor(totalAvailable / rental.daily_rate) : 0
  const newCredit = totalAvailable > 0 ? totalAvailable % rental.daily_rate : existingCredit

  const newEnd = useMemo(() => {
    const d = new Date(rental.expected_end_datetime)
    d.setDate(d.getDate() + daysCovered)
    return d
  }, [rental.expected_end_datetime, daysCovered])

  const now = Date.now()
  const expectedMs = new Date(rental.expected_end_datetime).getTime()
  const overdueDaysNow = now > expectedMs
    ? Math.ceil((now - expectedMs) / 86_400_000)
    : 0

  const newEndMs = newEnd.getTime()
  const stillOverdueDays = daysCovered > 0 && now > newEndMs
    ? Math.ceil((now - newEndMs) / 86_400_000)
    : 0
  const aheadDays = daysCovered > 0 && newEndMs > now
    ? Math.floor((newEndMs - now) / 86_400_000)
    : 0

  const handleSubmit = async () => {
    if (paymentNum <= 0) { setError('กรุณาใส่จำนวนเงิน'); return }
    setLoading(true)
    setError('')
    try {
      // daysCovered = 0 → บันทึกเครดิต แต่ไม่เลื่อน expected_end
      const res = await fetch('/api/staff/rental/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rentalId: rental.id,
          payment: paymentNum,
          newEndDatetime: daysCovered > 0 ? newEnd.toISOString() : rental.expected_end_datetime,
          newCredit,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      router.push('/staff/home')
    } catch {
      setError('เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-wrap">

      {/* Header */}
      <div className="app-header">
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div>
          <h1>ต่อเวลาการเช่า</h1>
          <div className="sub">{bike.license_plate} {bike.brand} {bike.model}</div>
        </div>
      </div>

      <div className="section-pad">

        {/* Current rental info */}
        <div className="card" style={{ borderTop: `3px solid ${overdueDaysNow > 0 ? '#dc2626' : '#d97706'}` }}>
          <div className="card-title">การเช่าปัจจุบัน</div>
          <div className="info-row">
            <span className="info-key">ผู้เช่า</span>
            <span className="info-val">{customer.name}</span>
          </div>
          <div className="info-row">
            <span className="info-key">กำหนดคืนเดิม</span>
            <span className="info-val" style={{ color: overdueDaysNow > 0 ? '#dc2626' : 'inherit' }}>
              {fmtDate(rental.expected_end_datetime)}
              {overdueDaysNow > 0 && ` (เกิน ${overdueDaysNow} วัน)`}
            </span>
          </div>
          {existingCredit > 0 && (
            <div className="info-row">
              <span className="info-key">เครดิตค้างจากครั้งก่อน</span>
              <span className="info-val" style={{ color: '#16a34a' }}>+฿{existingCredit.toLocaleString()}</span>
            </div>
          )}
          <div className="info-row">
            <span className="info-key">ราคา/วัน</span>
            <span className="info-val">฿{rental.daily_rate.toLocaleString()}</span>
          </div>
        </div>

        {/* Payment input */}
        <div className="card">
          <div className="card-title">รับเงินจากลูกค้า</div>

          {/* Shortcuts */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button onClick={() => setPayment(String(rental.daily_rate))} style={{
              flex: 1, padding: '10px 8px', borderRadius: '10px',
              border: '1.5px solid #e5e7eb', background: '#fff',
              color: '#374151', fontWeight: 600, fontSize: '13px',
              cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.4,
            }}>
              1 วัน<br />
              <span style={{ fontSize: '11px', color: '#6b7280' }}>฿{rental.daily_rate.toLocaleString()}</span>
            </button>
            <button onClick={() => setPayment(String(rental.daily_rate * 7))} style={{
              flex: 1, padding: '10px 8px', borderRadius: '10px',
              border: '1.5px solid #e5e7eb', background: '#fff',
              color: '#374151', fontWeight: 600, fontSize: '13px',
              cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.4,
            }}>
              7 วัน<br />
              <span style={{ fontSize: '11px', color: '#6b7280' }}>฿{(rental.daily_rate * 7).toLocaleString()}</span>
            </button>
            <button onClick={() => setPayment('')} style={{
              flex: 1, padding: '10px 8px', borderRadius: '10px',
              border: '1.5px solid #d97706', background: '#fffbeb',
              color: '#d97706', fontWeight: 600, fontSize: '13px',
              cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.4,
            }}>
              ระบุเอง
            </button>
          </div>

          <label className="field-label">จำนวนเงินที่รับ (บาท)</label>
          <input
            className="field-input"
            type="number"
            placeholder={`เช่น ${rental.daily_rate * 3}`}
            value={payment}
            onChange={e => setPayment(e.target.value)}
            style={{ fontSize: '20px', fontWeight: 700 }}
          />
          {existingCredit > 0 && paymentNum > 0 && (
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
              เครดิตเก่า ฿{existingCredit.toLocaleString()} + รับใหม่ ฿{paymentNum.toLocaleString()} = รวม ฿{totalAvailable.toLocaleString()}
            </div>
          )}
        </div>

        {/* Summary */}
        {paymentNum > 0 && (
          <div style={{
            background: 'linear-gradient(135deg,#111827,#1e293b)',
            borderRadius: '16px', padding: '18px 16px', marginBottom: '12px', color: '#fff',
          }}>
            <div style={{ fontSize: '12px', opacity: .8, marginBottom: '12px' }}>สรุปการต่อเวลา</div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', opacity: .8 }}>ได้</span>
              <span style={{ fontSize: '16px', fontWeight: 800 }}>
                {daysCovered > 0 ? `${daysCovered} วัน` : '< 1 วัน (ไม่ถึงวัน)'}
              </span>
            </div>

            {newCredit > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', opacity: .8 }}>เศษที่ยังค้าง</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#fbbf24' }}>
                  ฿{Math.round(newCredit).toLocaleString()}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', opacity: .8 }}>กำหนดคืนใหม่</span>
              <span style={{ fontSize: '13px', fontWeight: 700 }}>
                {daysCovered > 0 ? fmtDate(newEnd.toISOString()) : '—'}
              </span>
            </div>

     