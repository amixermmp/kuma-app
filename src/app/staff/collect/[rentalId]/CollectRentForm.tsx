'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Rental = {
  id: string
  start_datetime: string
  daily_rate: number
  total_amount: number
  bikes: { id: string; license_plate: string; brand: string; model: string }
  customers: { id: string; name: string; phone: string; workplace: string | null }
}

type Collection = {
  id: string
  period_label: string
  due_date: string
  amount_due: number
  amount_paid: number
  status: string
  payment_method: string | null
  collected_at: string | null
}

type Props = {
  rental: Rental
  collections: Collection[]
  staffId: string
  currentPeriodNum: number
  periodLabel: string
  dueDate: string
  monthlyRate: number
  totalCollected: number
  alreadyCollected: boolean
}

const PAYMENT_METHODS = ['💵 เงินสด', '📱 โอนธนาคาร', '💳 บัตรเครดิต', '📲 QR Promptpay']

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function statusIcon(status: string) {
  if (status === 'paid') return '✅'
  if (status === 'partial') return '🟡'
  if (status === 'overdue') return '🔴'
  return '⏳'
}

export default function CollectRentForm({
  rental, collections, staffId,
  currentPeriodNum, periodLabel, dueDate,
  monthlyRate, totalCollected, alreadyCollected,
}: Props) {
  const router = useRouter()
  const bike = rental.bikes
  const customer = rental.customers

  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [payMethod, setPayMethod] = useState(PAYMENT_METHODS[0])
  const [amountPaid, setAmountPaid] = useState(String(monthlyRate))
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const paid = parseFloat(amountPaid) || 0
  const isPartial = paid > 0 && paid < monthlyRate
  const isOverpaid = paid > monthlyRate

  // Start datetime formatted
  const startDate = new Date(rental.start_datetime)
  const monthsRented = currentPeriodNum - 1

  const handleSubmit = async () => {
    if (paid <= 0) { setError('กรุณาใส่ยอดที่รับ'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/staff/collection/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rentalId: rental.id,
          staffId,
          periodLabel,
          dueDate,
          amountDue: monthlyRate,
          amountPaid: paid,
          paymentMethod: payMethod,
          paymentNote: note.trim() || null,
          collectedAt: new Date(`${payDate}T12:00:00+07:00`).toISOString(),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
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
      <div className="app-header" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div>
          <h1>เก็บค่าเช่ารายเดือน</h1>
          <div className="sub">{bike.license_plate} {bike.brand} {bike.model}</div>
        </div>
      </div>

      <div className="section-pad">

        {/* Contract info */}
        <div className="card" style={{ borderTop: '3px solid #7c3aed' }}>
          <div className="card-title">ข้อมูลสัญญา</div>
          <div className="info-row">
            <span className="info-key">ผู้เช่า</span>
            <span className="info-val">{customer.name}</span>
          </div>
          <div className="info-row">
            <span className="info-key">เบอร์โทร</span>
            <span className="info-val">{customer.phone}</span>
          </div>
          {customer.workplace && (
            <div className="info-row">
              <span className="info-key">ที่พัก</span>
              <span className="info-val">{customer.workplace}</span>
            </div>
          )}
          <div className="info-row">
            <span className="info-key">เริ่มสัญญา</span>
            <span className="info-val">{fmtDate(rental.start_datetime)}</span>
          </div>
          <div className="info-row">
            <span className="info-key">เช่ามาแล้ว</span>
            <span className="info-val" style={{ color: '#7c3aed', fontWeight: 700 }}>
              {monthsRented} เดือน {monthsRented === 0 ? '(เดือนแรก)' : ''}
            </span>
          </div>
          <div className="info-row">
            <span className="info-key">ค่าเช่า/เดือน</span>
            <span className="info-val" style={{ color: '#7c3aed', fontWeight: 700 }}>
              ฿{monthlyRate.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Current period to collect */}
        {alreadyCollected ? (
          <div className="card" style={{ borderTop: '3px solid #16a34a' }}>
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
              <div style={{ fontWeight: 700, color: '#16a34a' }}>เก็บเงินเดือนนี้แล้ว</div>
              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>{periodLabel}</div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ borderTop: '3px solid #16a34a' }}>
            <div className="card-title" style={{ color: '#16a34a' }}>💰 งวดที่ต้องเก็บ</div>
            <div style={{
              background: '#f0fdf4', borderRadius: '10px', padding: '14px',
              textAlign: 'center', marginBottom: '14px',
            }}>
              <div style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>{periodLabel}</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: '#16a34a', margin: '6px 0' }}>
                ฿{monthlyRate.toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: '#16a34a' }}>ครบกำหนด: {fmtDate(dueDate)}</div>
            </div>

            <div className="field-row">
              <label className="field-label">ยอดที่รับจริง (บาท)</label>
              <input className="field-input" type="number"
                value={amountPaid}
                onChange={e => setAmountPaid(e.target.value)}
              />
              {isPartial && (
                <div style={{ fontSize: '12px', color: '#d97706', marginTop: '4px' }}>
                  ⚠️ ชำระบางส่วน — ค้างอีก ฿{(monthlyRate - paid).toLocaleString()}
                </div>
              )}
              {isOverpaid && (
                <div style={{ fontSize: '12px', color: '#2563eb', marginTop: '4px' }}>
                  💡 จ่ายเกิน ฿{(paid - monthlyRate).toLocaleString()} (ทอนหรือนับล่วงหน้า)
                </div>
              )}
            </div>

            <div className="field-row">
              <label className="field-label">วันที่รับเงิน</label>
              <input className="field-input" type="date"
                value={payDate}
                onChange={e => setPayDate(e.target.value)}
              />
            </div>

            <div className="field-row">
              <label className="field-label">ช่องทางชำระเงิน</label>
              <select className="field-input"
                value={payMethod}
                onChange={e => setPayMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>

            <div className="field-row" style={{ marginBottom: 0 }}>
              <label className="field-label">หมายเหตุ</label>
              <input className="field-input" type="text"
                placeholder="เช่น โอนมาแล้ว ref 123456 / นัดจ่ายวันศุกร์"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Payment history */}
        {collections.length > 0 && (
          <div className="card">
            <div className="card-title">ประวัติการชำระ</div>
            {collections.map(c => (
              <div key={c.id} className="payment-history-item">
                <span style={{ fontSize: '18px' }}>{statusIcon(c.status)}</span>
                <div style={{ flex: 1 }}>
                  <div className="pay-month">{c.period_label}</div>
                  <div className="pay-date">
                    {c.collected_at ? `ชำระ: ${fmtDate(c.collected_at)}` : 'ยังไม่ชำระ'}
                    {c.payment_method ? ` • ${c.payment_method}` : ''}
                    {c.status === 'partial' ? ` • ค้าง ฿${(c.amount_due - c.amount_paid).toLocaleString()}` : ''}
                  </div>
                </div>
                <span className="pay-amt" style={{ color: c.status === 'partial' ? '#d97706' : '#16a34a' }}>
                  ฿{Number(c.amount_paid).toLocaleString()}
                </span>
              </div>
            ))}
            <div style={{ textAlign: 'center', padding: '10px', fontSize: '13px', color: '#6b7280' }}>
              รายได้สะสม: <strong style={{ color: '#7c3aed' }}>฿{totalCollected.toLocaleString()}</strong>
            </div>
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

        {!alreadyCollected && (
          <button
            className="btn"
            onClick={handleSubmit}
            disabled={loading}
            style={{ width: '100%', background: '#16a34a', color: '#fff', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? '⏳ กำลังบันทึก...' : '✅ บันทึกรับเงินเดือนนี้'}
          </button>
        )}

        <div style={{ height: '16px' }} />

        {/* End contract */}
        <div className="card" style={{ border: '1.5px solid #dc2626' }}>
          <div className="card-title" style={{ color: '#dc2626' }}>⚠️ สิ้นสุดสัญญา</div>
          <div style={{ fontSize: '13px', color: '#4b5563', marginBottom: '14px' }}>
            เมื่อลูกค้าคืนรถและสิ้นสุดการเช่ารายเดือน กดปุ่มนี้เพื่อปลดล็อครถ
            รถจะกลับสู่สถานะ <strong>ว่าง</strong>
          </div>
          <Link
            href={`/staff/return/${rental.id}`}
            className="btn"
            style={{
              display: 'block', width: '100%',
              background: '#fff', color: '#dc2626',
              border: '2px solid #dc2626', textAlign: 'center',
              textDecoration: 'none',
            }}
          >
            🚫 สิ้นสุดสัญญาเช่ารายเดือน
          </Link>
        </div>

      </div>
    </div>
  )
}
