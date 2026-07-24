'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Bike = { id: string; license_plate: string; brand: string; model: string }
type Customer = { id: string; name: string; phone: string; workplace: string | null }

type MonthlyRental = {
  id: string
  start_date: string
  payment_day: number
  monthly_rate: number
  deposit_amount: number
  bikes: Bike
  customers: Customer
}

type Payment = {
  id: string
  due_date: string
  paid_date: string
  amount: number
  payment_method: string | null
  payment_note: string | null
  status: string
}

type Period = {
  periodNum: number
  dueDate: string
  label: string
  payments: Payment[]
  totalPaid: number
  periodRate: number
  fullyPaid: boolean
  isOverdue: boolean
}

type Props = {
  rental: MonthlyRental
  periods: Period[]
  currentPeriod: Period
  staffId: string
  totalCollected: number
}

const PAYMENT_METHODS = ['💵 เงินสด', '📱 โอนธนาคาร', '💳 บัตรเครดิต', '📲 QR Promptpay']

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function CollectRentForm({ rental, periods, currentPeriod, staffId, totalCollected }: Props) {
  const router = useRouter()
  const bike = rental.bikes
  const customer = rental.customers
  const monthlyRate = rental.monthly_rate
  const { isOverdue } = currentPeriod
  // ใช้ราคาของ "งวดนี้" เสมอ (periodRate) ไม่ใช่ราคาปัจจุบันของสัญญา — เผื่อเคยสลับรถหลังงวดนี้กำหนด
  // ชำระไปแล้ว งวดนั้นยังอ้างอิงราคาเดิม ราคาใหม่มีผลแค่งวดถัดไปที่กำหนดชำระหลังวันสลับ
  const remaining = currentPeriod.periodRate - currentPeriod.totalPaid

  const [payDate, setPayDate]     = useState(new Date().toISOString().split('T')[0])
  const [payMethod, setPayMethod] = useState(PAYMENT_METHODS[0])
  const [amount, setAmount]       = useState('')
  const [note, setNote]           = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const paid = parseFloat(amount) || 0
  const newTotal = currentPeriod.totalPaid + paid
  const willComplete = newTotal >= currentPeriod.periodRate

  const handleSubmit = async () => {
    if (paid <= 0) { setError('กรุณาใส่ยอดที่รับ'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/staff/collection/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthlyRentalId: rental.id,
          staffId,
          dueDate: currentPeriod.dueDate,
          amountPaid: paid,
          paymentMethod: payMethod,
          paymentNote: note.trim() || null,
          collectedAt: new Date(`${payDate}T12:00:00+07:00`).toISOString(),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      setAmount(''); setNote('')
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  const headerBg = isOverdue
    ? 'linear-gradient(135deg,#dc2626,#b91c1c)'
    : '#111827'

  const monthsRented = periods.filter(p => p.fullyPaid).length

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
        <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '10px 14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '18px' }}>🔴</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#dc2626' }}>ชำระล่าช้า</div>
            <div style={{ fontSize: '11px', color: '#dc2626' }}>
              ครบกำหนด {fmtDate(currentPeriod.dueDate)} — ยังค้าง ฿{remaining.toLocaleString()}
            </div>
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
          <div className="info-row"><span className="info-key">เริ่มสัญญา</span><span className="info-val">{fmtDate(rental.start_date)}</span></div>
          <div className="info-row">
            <span className="info-key">เช่ามาแล้ว</span>
            <span className="info-val" style={{ color: '#7c3aed', fontWeight: 700 }}>{monthsRented} เดือน</span>
          </div>
          <div className="info-row">
            <span className="info-key">ค่าเช่า/เดือน</span>
            <span className="info-val" style={{ color: '#7c3aed', fontWeight: 700 }}>฿{monthlyRate.toLocaleString()}</span>
          </div>
          <div className="info-row">
            <span className="info-key">ครบกำหนดทุกวันที่</span>
            <span className="info-val">{rental.payment_day} ของเดือน</span>
          </div>
        </div>

        {/* Current period */}
        {currentPeriod.fullyPaid ? (
          <div className="card" style={{ borderTop: '3px solid #16a34a' }}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: '36px' }}>✅</div>
              <div style={{ fontWeight: 700, color: '#16a34a', marginTop: '8px' }}>เก็บเงินครบทุกเดือนแล้ว</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{currentPeriod.label}</div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ borderTop: `3px solid ${isOverdue ? '#dc2626' : '#16a34a'}` }}>
            <div className="card-title" style={{ color: isOverdue ? '#dc2626' : '#16a34a' }}>
              {isOverdue ? '🔴 ค้างชำระ' : '💰 งวดที่ต้องเก็บ'}
            </div>

            {currentPeriod.periodRate !== monthlyRate && (
              <div style={{
                background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: '10px',
                padding: '10px 14px', marginBottom: '12px', fontSize: '12px', color: '#92400e',
              }}>
                🔄 งวดนี้เคยตกลงราคาไว้ที่ ฿{currentPeriod.periodRate.toLocaleString()}/เดือน ก่อนสลับรถ
                — เก็บตามราคานี้ (ราคาใหม่ ฿{monthlyRate.toLocaleString()} มีผลตั้งแต่งวดถัดไป)
              </div>
            )}

            {/* Period box */}
            <div style={{
              background: isOverdue ? '#fef2f2' : '#f0fdf4',
              borderRadius: '10px', padding: '14px', textAlign: 'center', marginBottom: '14px',
            }}>
              <div style={{ fontSize: '13px', color: isOverdue ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                {currentPeriod.label}
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: isOverdue ? '#dc2626' : '#16a34a', margin: '6px 0' }}>
                ฿{currentPeriod.periodRate.toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: isOverdue ? '#dc2626' : '#16a34a' }}>
                ครบกำหนด: {fmtDate(currentPeriod.dueDate)}
              </div>
            </div>

            {/* Progress bar (if partially paid) */}
            {currentPeriod.totalPaid > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>จ่ายแล้ว ฿{currentPeriod.totalPaid.toLocaleString()}</span>
                  <span style={{ color: isOverdue ? '#dc2626' : '#d97706', fontWeight: 600 }}>ค้าง ฿{remaining.toLocaleString()}</span>
                </div>
                <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: '4px', background: '#16a34a',
                    width: `${Math.min(100, (currentPeriod.totalPaid / currentPeriod.periodRate) * 100)}%`,
                  }} />
                </div>
              </div>
            )}

            {/* Amount */}
            <div className="field-row">
              <label className="field-label">
                {currentPeriod.totalPaid > 0 ? `ยอดที่รับเพิ่ม (ค้าง ฿${remaining.toLocaleString()})` : 'ยอดที่รับ (บาท)'}
              </label>
              <input className="field-input" type="number"
                placeholder={String(remaining)}
                value={amount} onChange={e => setAmount(e.target.value)}
              />
              {paid > 0 && !willComplete && (
                <div style={{ fontSize: '12px', color: '#d97706', marginTop: '4px' }}>
                  🟡 จ่ายบางส่วน — ยังค้าง ฿{(currentPeriod.periodRate - newTotal).toLocaleString()}
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
                value={note} onChange={e => setNote(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Payment history */}
        {periods.length > 0 && (
          <div className="card">
            <div className="card-title">ประวัติการชำระ</div>
            {[...periods].reverse().map(p => {
              const icon = p.fullyPaid ? '✅' : p.isOverdue ? '🔴' : p.totalPaid > 0 ? '🟡' : '⏳'
              const color = p.fullyPaid ? '#16a34a' : p.isOverdue ? '#dc2626' : p.totalPaid > 0 ? '#d97706' : '#9ca3af'
              const label = p.fullyPaid
                ? 'ครบแล้ว'
                : p.isOverdue
                  ? `เลท — ค้าง ฿${(p.periodRate - p.totalPaid).toLocaleString()}`
                  : p.totalPaid > 0
                    ? `บางส่วน — ค้าง ฿${(p.periodRate - p.totalPaid).toLocaleString()}`
                    : 'รอชำระ'
              return (
                <div key={p.dueDate} style={{ marginBottom: '10px', borderBottom: '1px solid #f3f4f6', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>{icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>{p.label}</div>
                      <div style={{ fontSize: '11px', color, fontWeight: 600 }}>{label}</div>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color }}>
                      {p.totalPaid > 0 ? `฿${p.totalPaid.toLocaleString()}` : '—'}
                    </span>
                  </div>
                  {/* Sub-payments */}
                  {p.payments.length > 0 && (
                    <div style={{ marginLeft: '28px', marginTop: '4px' }}>
                      {p.payments.map((pay, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6b7280', padding: '1px 0' }}>
                          <span>{fmtDate(pay.paid_date)} • {pay.payment_method ?? '—'}{pay.payment_note ? ` • ${pay.payment_note}` : ''}</span>
                          <span style={{ fontWeight: 600 }}>+฿{Number(pay.amount).toLocaleString()}</span>
                        </div>
                      ))}
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

        {!currentPeriod.fullyPaid && (
          <button className="btn" onClick={handleSubmit} disabled={loading} style={{
            width: '100%',
            background: isOverdue ? '#dc2626' : '#16a34a',
            color: '#fff', opacity: loading ? 0.7 : 1,
          }}>
            {loading ? '⏳ กำลังบันทึก...' : currentPeriod.totalPaid > 0 ? '➕ เพิ่มการชำระ' : '✅ บันทึกรับเงินเดือนนี้'}
          </button>
        )}

        <div style={{ height: '16px' }} />

        {/* End contract */}
        <div className="card" style={{ border: '1.5px solid #dc2626' }}>
          <div className="card-title" style={{ color: '#dc2626' }}>⚠️ สิ้นสุดสัญญา</div>
          <div style={{ fontSize: '13px', color: '#4b5563', marginBottom: '14px' }}>
            เมื่อลูกค้าคืนรถและสิ้นสุดการเช่ารายเดือน กดปุ่มนี้เพื่อปลดล็อครถ — รถจะกลับสู่สถานะ <strong>ว่าง</strong>
          </div>
          <Link href={`/staff/monthly/end/${rental.id}`} className="btn" style={{
            display: 'block', width: '100%', background: '#fff', color: '#dc2626',
            border: '2px solid #dc2626', textAlign: 'center', textDecoration: 'none',
          }}>
            🚫 สิ้นสุดสัญญาเช่ารายเดือน
          </Link>
        </div>

      </div>
    </div>
  )
}
