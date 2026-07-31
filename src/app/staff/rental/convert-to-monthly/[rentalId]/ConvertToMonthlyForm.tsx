'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Rental = {
  id: string
  start_datetime: string
  expected_end_datetime: string
  total_days: number
  total_amount: number
  deposit_amount: number
  bikes: { id: string; license_plate: string; brand: string; model: string; monthly_rate: number | null; deposit_amount: number; photo_url: string | null }
  customers: { name: string; phone: string; id_card_number: string | null }
}

function isThaiIdNumber(idCardNumber: string): boolean {
  const digits = idCardNumber.replace(/\D/g, '')
  return digits.length === 13
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' })

export default function ConvertToMonthlyForm({ rental, staffId }: { rental: Rental; staffId: string }) {
  const router = useRouter()
  const bike = rental.bikes
  const customer = rental.customers
  const isThaiId = isThaiIdNumber(customer.id_card_number ?? '')

  const [monthlyRate, setMonthlyRate] = useState(String(bike.monthly_rate ?? ''))
  const [paymentDay, setPaymentDay] = useState(new Date().getDate())
  const requiredDeposit = bike.deposit_amount ?? 0
  const dailyDepositCovers = rental.deposit_amount >= requiredDeposit
  const [depositAmount, setDepositAmount] = useState(String(dailyDepositCovers ? rental.deposit_amount : requiredDeposit))
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>(isThaiId ? 'transfer' : 'cash')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!monthlyRate || parseFloat(monthlyRate) <= 0) { setError('กรุณาใส่ราคาเช่าต่อเดือน'); return }
    if (paymentMethod === 'cash' && isThaiId) { setError('บัตรประชาชนไทย — จ่ายเงินสดไม่ได้ ต้องโอนเงินเท่านั้น'); return }
    setError('')
    setLoading(true)
    try {
      const sendPayload = (overrideBookingConflict: boolean) => fetch('/api/staff/rental/convert-to-monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rentalId: rental.id,
          staffId,
          monthlyRate: parseFloat(monthlyRate),
          paymentDay,
          depositAmount: parseFloat(depositAmount) || 0,
          paymentMethod,
          overrideBookingConflict,
        }),
      })
      let res = await sendPayload(false)
      let data = await res.json()
      if (!res.ok && data.conflictBookingId) {
        const ok = confirm(`⚡ ${data.error}\n\nยืนยันใช้ Fast lane ทำต่อไหม?`)
        if (!ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
        res = await sendPayload(true)
        data = await res.json()
      }
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      router.push('/staff/jobs')
    } catch {
      setError('เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-wrap">
      <div className="app-header">
        <Link href="/staff/jobs" className="app-header-back">←</Link>
        <div>
          <h1>แปลงเป็นรายเดือน</h1>
          <div className="sub">{bike.license_plate} {bike.brand} {bike.model}</div>
        </div>
      </div>

      <div className="section-pad">
        <div className="card">
          <div className="card-title">สัญญารายวันเดิม</div>
          <div className="info-row">
            <span className="info-key">ผู้เช่า</span>
            <span className="info-val">{customer.name}</span>
          </div>
          <div className="info-row">
            <span className="info-key">เริ่มเช่า</span>
            <span className="info-val">{fmtDate(rental.start_datetime)}</span>
          </div>
          <div className="info-row">
            <span className="info-key">จ่ายไปแล้ว (รายวัน)</span>
            <span className="info-val">฿{Number(rental.total_amount).toLocaleString()}</span>
          </div>
          <div className="info-row">
            <span className="info-key">มัดจำที่จ่ายไว้</span>
            <span className="info-val">฿{Number(rental.deposit_amount).toLocaleString()}</span>
          </div>
        </div>

        <div className="card">
          <div className="card-title">สัญญารายเดือนใหม่</div>
          <div className="field-row">
            <label className="field-label">ราคาเช่าต่อเดือน (฿)</label>
            <input className="field-input" type="number" value={monthlyRate} onChange={e => setMonthlyRate(e.target.value)} />
          </div>
          <div className="field-row">
            <label className="field-label">วันเก็บเงินรายเดือน (วันที่ ... ทุกเดือน)</label>
            <input className="field-input" type="number" min={1} max={31} value={paymentDay} onChange={e => setPaymentDay(parseInt(e.target.value) || 1)} />
          </div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">เงินมัดจำรายเดือน (฿)</label>
            <input className="field-input" type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
            {dailyDepositCovers ? (
              <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>
                ✓ มัดจำรายวันที่จ่ายไว้ (฿{rental.deposit_amount.toLocaleString()}) ครบตามเกณฑ์รายเดือน (฿{requiredDeposit.toLocaleString()}) แล้ว — ยกมาใช้ต่อได้เลย
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#d97706', marginTop: 4 }}>
                ⚠️ มัดจำรายวันที่จ่ายไว้ (฿{rental.deposit_amount.toLocaleString()}) ยังไม่ถึงเกณฑ์รายเดือน (฿{requiredDeposit.toLocaleString()}) — ต้องเก็บเพิ่มอีก ฿{(requiredDeposit - rental.deposit_amount).toLocaleString()}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-title">การชำระเงินงวดแรก</div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">วิธีชำระ</label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              {(['cash', 'transfer'] as const).map(m => {
                const disabled = m === 'cash' && isThaiId
                return (
                  <button key={m} disabled={disabled} onClick={() => setPaymentMethod(m)} style={{
                    padding: '7px 18px', borderRadius: '20px', border: '1.5px solid',
                    fontSize: '13px', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 600, fontFamily: 'inherit',
                    background: paymentMethod === m ? '#111827' : '#fff',
                    color: disabled ? '#d1d5db' : paymentMethod === m ? '#fff' : '#6b7280',
                    borderColor: paymentMethod === m ? '#111827' : '#e5e7eb',
                    opacity: disabled ? 0.6 : 1,
                  }}>
                    {m === 'cash' ? '💵 เงินสด' : '📱 โอนเงิน'}
                  </button>
                )
              })}
            </div>
            {isThaiId && (
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                บัตรประชาชนไทย — จ่ายเงินสดไม่ได้ ต้องโอนเงินอย่างเดียว
              </div>
            )}
          </div>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: '#dc2626' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
            background: loading ? '#9ca3af' : '#16a34a', color: '#fff', fontWeight: 700, fontSize: '15px',
            cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}
        >
          {loading ? '⏳ กำลังบันทึก...' : '📅 ยืนยันแปลงเป็นรายเดือน'}
        </button>
      </div>
    </div>
  )
}
