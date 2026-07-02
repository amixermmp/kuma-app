'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Rental = {
  id: string
  expected_end_datetime: string
  total_amount: number
  daily_rate: number
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

  const [unit, setUnit] = useState<'day' | 'hour'>('day')
  const [amount, setAmount] = useState(1)
  const [studentPromo, setStudentPromo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const HOURLY_RATE = 50
  const dayRate = studentPromo ? rental.daily_rate - 50 : rental.daily_rate
  const chargeAsDay = unit === 'hour' && amount > 5

  const extraCharge = useMemo(() => {
    if (unit === 'day') return amount * dayRate
    if (chargeAsDay) return dayRate
    return amount * HOURLY_RATE
  }, [unit, amount, dayRate, chargeAsDay])

  const newEndDate = useMemo(() => {
    const base = new Date(rental.expected_end_datetime)
    if (unit === 'day') base.setDate(base.getDate() + amount)
    else base.setHours(base.getHours() + (chargeAsDay ? amount : amount))
    return base
  }, [rental.expected_end_datetime, unit, amount, chargeAsDay])

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/staff/rental/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rentalId: rental.id,
          unit,
          amount,
          extraCharge,
          newEndDatetime: newEndDate.toISOString(),
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

        {/* Current rental */}
        <div className="card" style={{ borderTop: '3px solid #d97706' }}>
          <div className="card-title">การเช่าปัจจุบัน</div>
          <div className="info-row">
            <span className="info-key">ผู้เช่า</span>
            <span className="info-val">{customer.name}</span>
          </div>
          <div className="info-row">
            <span className="info-key">กำหนดคืนเดิม</span>
            <span className="info-val" style={{ color: '#dc2626' }}>
              {fmtDate(rental.expected_end_datetime)}
            </span>
          </div>
          <div className="info-row">
            <span className="info-key">ค่าเช่าปัจจุบัน</span>
            <span className="info-val">฿{rental.total_amount.toLocaleString()}</span>
          </div>
        </div>

        {/* Extend options */}
        <div className="card">
          <div className="card-title">ต่อเวลาเป็น</div>

          {/* Unit toggle */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {(['day', 'hour'] as const).map(u => (
              <button key={u} onClick={() => { setUnit(u); setAmount(u === 'day' ? 1 : 1) }} style={{
                padding: '6px 20px', borderRadius: '20px',
                border: '2px solid', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                background: unit === u ? '#d97706' : '#fff',
                color: unit === u ? '#fff' : '#6b7280',
                borderColor: unit === u ? '#d97706' : '#e5e7eb',
              }}>
                {u === 'day' ? 'รายวัน' : 'รายชั่วโมง'}
              </button>
            ))}
          </div>

          {/* Stepper */}
          <label className="field-label">
            จำนวน{unit === 'day' ? 'วัน' : 'ชั่วโมง'}ที่ต้องการต่อ
          </label>
          <div className="time-stepper">
            <button className="stepper-btn"
              onClick={() => setAmount(a => Math.max(1, a - 1))}>−</button>
            <div style={{ textAlign: 'center' }}>
              <div className="stepper-val">{amount}</div>
              <div className="stepper-unit">{unit === 'day' ? 'วัน' : 'ชม.'}</div>
            </div>
            <button className="stepper-btn"
              onClick={() => setAmount(a => Math.min(unit === 'day' ? 90 : 23, a + 1))}>+</button>
          </div>

          {/* Hourly warning */}
          {unit === 'hour' && amount > 5 && (
            <div style={{
              background: '#fffbeb', borderRadius: '8px', padding: '10px',
              fontSize: '13px', color: '#92400e', textAlign: 'center', marginTop: '12px',
            }}>
              ⚠️ เกิน 5 ชม. คิดเป็นราคา 1 วัน (฿{dayRate.toLocaleString()})
            </div>
          )}
        </div>

        {/* Student promo */}
        <div className="card">
          <div className="card-title">ราคา</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setStudentPromo(false)} style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              border: `2px solid ${!studentPromo ? '#374151' : '#e5e7eb'}`,
              background: !studentPromo ? '#f1f5f9' : '#fff',
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
            <div style={{ marginTop: '10px', background: '#f5f3ff', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#7c3aed' }}>
              ลด ฿50/วัน — ราคารายวัน ฿{dayRate.toLocaleString()}
            </div>
          )}
        </div>

        {/* Price summary */}
        <div className="price-box">
          <div className="price-label">กำหนดคืนใหม่</div>
          <div style={{ fontSize: '20px', fontWeight: 800, margin: '8px 0' }}>
            {fmtDate(newEndDate.toISOString())}
          </div>
          <div className="price-label" style={{ marginTop: '12px' }}>ค่าต่อเวลาเพิ่มเติม</div>
          <div className="price-amount">฿{extraCharge.toLocaleString()}</div>
          <div className="price-detail">
            {unit === 'day'
              ? `฿${dayRate.toLocaleString()}/วัน × ${amount} วัน`
              : chargeAsDay
                ? `คิดเต็มวัน ฿${dayRate.toLocaleString()}`
                : `฿${HOURLY_RATE}/ชม. × ${amount} ชม.`}
          </div>
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
          className="btn"
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', background: '#d97706', color: '#fff',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '⏳ กำลังบันทึก...' : '💾 ยืนยันต่อเวลา'}
        </button>

      </div>
    </div>
  )
}
