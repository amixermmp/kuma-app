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
  payment_history: PaymentEntry[] | null
}

type PaymentEntry = {
  amount: number
  method: string | null
  note: string | null
  paid_at: string
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
  currentPaidAmt: number
  fullyPaid: boolean
  isOverdue: boolean
}

const PAYMENT_METHODS = ['💵 เงินสด', '📱 โอนธนาคาร', '💳 บัตรเครดิต', '📲 QR Promptpay']

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function statusBadge(c: Collection, monthlyRate: number) {
  if (c.status === 'paid') return { icon: '✅', label: 'ครบแล้ว', color: '#16a34a', bg: '#f0fdf4' }
  const now = new Date()
  const due = new Date(c.due_date)
  if (now > due) return { icon: '🔴', label: `เลท • ค้าง ฿${(monthlyRate - Number(c.amount_paid)).toLocaleString()}`, color: '#dc2626', bg: '#fef2f2' }
  return { icon: '🟡', label: `บางส่วน • ค้าง ฿${(monthlyRate - Number(c.amount_paid)).toLocaleString()}`, color: '#d97706', bg: '#fffbeb' }
}

export default function CollectRentForm({
  rental, collections, staffId,
  currentPeriodNum, periodLabel, dueDate,
  monthlyRate, totalCollected, currentPaidAmt, fullyPaid, isOverdue,
}: Props) {
  const router = useRouter()
  const bike = rental.bikes
  const customer = rental.customers

  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [payMethod, setPayMethod] = useState(PAYMENT_METHODS[0])
  const [amountPaid, setAmountPaid] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const paid = parseFloat(amountPaid) || 0
  const remaining = monthlyRate - currentPaidAmt
  const newTotal = currentPaidAmt + paid
  const willComplete = newTotal >= monthlyRate
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
      setAmountPaid('')
      setNote('')
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  const headerBg = isOverdue
    ? 'linear-gradient(135deg,#dc2626,#b91c1c)'
    : 'linear-gradient(135deg,#7c3aed,#4f46e5)'

  return (
    <div className="app-wrap">

      {/* Header */}
      <div className="app-header" style={{ background: headerBg }}>
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div>
          <h1>เก็บค่าเช่ารายเดือน{isOverdue ? ' ⚠️' : ''}</h1>
          <div className="sub">{bike.license_plate} {bike.brand} {bike.model}</div>
        </div>
      </div>

      {/* Overdue banner */}
      {isOverdue && (
        <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🔴</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#dc2626' }}>ชำระล่าช้า</div>
            <div style={{ fontSize: '11px', color: '#dc2626' }}>ครบกำหนด {fmtDate(dueDate)} — ยังค้างอยู่ ฿{remaining.toLocaleString()}</div>
          </div>
        </div>
      )}

      <div className="section-pad">

        {/* Contract info */}
        <div className="card" style={{ borderTop: `3px solid ${isOverdue ? '#dc2626' : '#7c3aed'}` }}>
          <div className="card-title">ข้อมูลสัญญา</div>
          <div className="info-row"><span className="info-key">ผู้เช่า</span><span className="info-val">{customer.name}</span></div>
          <div className="info-row"><span className="info-key">เบอร์โทร</span><span className="info-val">{customer.phone}</span></div>
          {customer.workplace && (
            <div className="info-row"><span className="info-key">ที่พัก</span><span className="info-val">{customer.workplace}</span></div>
          )}
          <div className="info-row"><span className="info-key">เริ่มสัญญา</span><span className="info-val">{fmtDate(rental.start_datetime)}</span></div>
          <div className="info-row">
            <span className="info-key">เช่ามาแล้ว</span>
            <span className="info-val" style={{ color: '#7c3aed', fontWeight: 700 }}>{monthsRented} เดือน</span>
          </div>
          <div className="info-row">
            <span className="info-key">ค่าเช่า/เดือน</span>
            <span className="info-val" style={{ color: '#7c3aed', fontWeight: 700 }}>฿{monthlyRate.toLocaleString()}</span>
          </div>
        </div>

        {/* Current period */}
        {fullyPaid ? (
          <div className="card" style={{ borderTop: '3px solid #16a34a' }}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>✅</div>
              <div style={{ fontWeight: 700, color: '#16a34a', fontSize: '15px' }}>เก็บเงินเดือนนี้ครบแล้ว</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{periodLabel}</div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ borderTop: `3px solid ${isOverdue ? '#dc2626' : '#16a34a'}` }}>
            <div className="card-title" style={{ color: isOverdue ? '#dc2626' : '#16a34a' }}>
              {isOverdue ? '🔴 ค้างชำระ' : '💰 งวดที่ต้องเก็บ'}
            </div>

            {/* Period box */}
            <div style={{
              background: isOverdue ? '#fef2f2' : '#f0fdf4',
              borderRadius: '10px', padding: '14px', textAlign: 'center', marginBottom: '14px',
            }}>
              <div style={{ fontSize: '13px', color: isOverdue ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{periodLabel}</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: isOverdue ? '#dc2626' : '#16a34a', margin: '6px 0' }}>
                ฿{monthlyRate.toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: isOverdue ? '#dc2626' : '#16a34a' }}>ครบกำหนด: {fmtDate(dueDate)}</div>
            </div>

            {/* Progress bar (show if partially paid) */}
            {currentPaidAmt > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>จ่ายแล้ว ฿{currentPaidAmt.toLocaleString()}</span>
                  <span style={{ color: isOverdue ? '#dc2626' : '#d97706', fontWeight: 600 }}>ค้างอีก ฿{remaining.toLocaleString()}</span>
                </div>
                <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: '4px',
                    background: '#16a34a',
                    width: `${Math.min(100, (currentPaidAmt / monthlyRate) * 100)}%`,
                    transition: 'width .3s',
                  }} />
                </div>
              </div>
            )}

            {/* Amount input */}
            <div className="field-row">
              <label className="field-label">
                {currentPaidAmt > 0 ? `ยอดที่รับเพิ่ม (ค้าง ฿${remaining.toLocaleString()})` : 'ยอดที่รับ (บาท)'}
              </label>
              <input className="field-input" type="number"
                placeholder={String(remaining)}
                value={amountPaid}
                onChange={e => setAmountPaid(e.target.value)}
              />
              {paid > 0 && !willComplete && (
                <div style={{ fontSize: '12px', color: '#d97706', marginTop: '4px' }}>
                  🟡 จ่ายบางส่วน — ยังค้าง ฿{(monthlyRate - newTotal).toLocaleString()}
                </div>
              )}
              {paid > 0 && willComplete && (
                <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px' }}>
                  ✅ ครบแล้ว! job task จะหายไปหลังบันทึก
                </div>
              )}
            </div>

            <div className="field-row">
              <label className="field-label">วันที่รับเงิน</label>
              <input className="field-input" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </div>

            <div className="field-row">
              <label className="field-label">ช่องทางชำระเงิน</label>
              <select className="field-input" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>

            <div className="field-row" style={{ marginBottom: 0 }}>
              <label className="field-label">หมายเหตุ</label>
              <input className="field-input" type="text"
                placeholder="เช่น โอนมาแล้ว ref 123456"
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
            {collections.map((c) => {
              const badge = statusBadge(c, monthlyRate)
              const subPayments: PaymentEntry[] = Array.isArray(c.payment_history) ? c.payment_history : []
              return (
                <div key={c.id} style={{ marginBottom: '12px', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '16px' }}>{badge.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>{c.period_label}</div>
                      <div style={{ fontSize: '11px', color: badge.color, fontWeight: 600 }}>{badge.label}</div>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: c.status === 'paid' ? '#16a34a' : badge.color }}>
                      ฿{Number(c.amount_paid).toLocaleString()}
                    </span>
                  </div>
                  {/* Sub-payment breakdown */}
                  {subPayments.length > 1 && (
                    <div style={{ marginLeft: '24px', marginTop: '4px' }}>
                      {subPayments.map((sp, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6b7280', padding: '2px 0' }}>
                          <span>{fmtDate(sp.paid_at)} • {sp.method ?? '—'}{sp.note ? ` • ${sp.note}` : ''}</span>
                          <span style={{ fontWeight: 600 }}>+฿{Number(sp.amount).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {subPayments.length === 1 && (
                    <div style={{ marginLeft: '24px', fontSize: '11px', color: '#9ca3af' }}>
                      {fmtDate(subPayments[0].paid_at)} • {subPayments[0].method ?? '—'}
                      {subPayments[0].note ? ` • ${subPayments[0].note}` : ''}
                    </div>
                  )}
                </div>
              )
            })}
            <div style={{ textAlign: 'center', padding: '4px', fontSize: '13px', color: '#6b7280' }}>
              รายได้สะสม: <strong style={{ color: '#7c3aed' }}>฿{totalCollected.toLocaleString()}</strong>
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', color: '#dc2626', fontSize: '14px', marginBottom: '12px' }}>
            ⚠️ {error}
          </div>
        )}

        {!fullyPaid && (
          <button
            className="btn"
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%',
              background: isOverdue ? '#dc2626' : '#16a34a',
              color: '#fff',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '⏳ กำลังบันทึก...' : currentPaidAmt > 0 ? '➕ เพิ่มการชำระ' : '✅ บันทึกรับเงินเดือนนี้'}
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
