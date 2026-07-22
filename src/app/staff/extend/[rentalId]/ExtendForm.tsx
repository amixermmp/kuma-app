'use client'

import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { calcRentQuote } from '@/lib/pricing'

type Rental = {
  id: string
  start_datetime: string
  expected_end_datetime: string
  total_days: number
  total_amount: number
  daily_rate: number
  discount: number
  outstanding_credit: number
  status: string
  bikes: { id: string; license_plate: string; brand: string; model: string; daily_rate: number; monthly_rate: number | null }
  customers: { id: string; name: string }
}

type UpcomingBooking = {
  id: string
  booking_ref: string
  customer_name: string
  start_datetime: string
  end_datetime: string
}

type Props = {
  rental: Rental
  staffId: string
  upcomingBookings: UpcomingBooking[]
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

const MAX_EXTRA_DAYS_SEARCH = 400

export default function ExtendForm({ rental, upcomingBookings }: Props) {
  const router = useRouter()
  const bike = rental.bikes
  const customer = rental.customers

  const [payment, setPayment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // เรทจริงที่ใช้ตอนทำสัญญา (rental.daily_rate = เรทเต็มของรถเสมอ ไม่รวมส่วนลด — เช็คส่วนลดจาก discount แทน)
  // สมมติฐาน: ส่วนลด/วันต้องตรงกับหน้าส่งรถ (SendCarForm.tsx)
  const STUDENT_PROMO_DISCOUNT = 50
  const isStudentPromo = (rental.discount ?? 0) > 0
  const effectiveDailyRate = rental.daily_rate - (isStudentPromo ? STUDENT_PROMO_DISCOUNT : 0)
  const monthlyRate = bike.monthly_rate || bike.daily_rate * 30
  const startDt = useMemo(() => new Date(rental.start_datetime), [rental.start_datetime])

  // ราคาสะสมถ้าเช่ารวมเป็น (total_days + n) วัน คิดด้วยสูตรร้าน (เช่า 7 จ่าย 5 / cap รายเดือน)
  const cumulativePriceFor = (n: number) => calcRentQuote(startDt, rental.total_days + n, effectiveDailyRate, monthlyRate).total
  // ราคาส่วนเพิ่มถ้าต่ออีก n วัน (ส่วนต่างจากที่จ่ายไปแล้ว)
  const incrementalCostFor = (n: number) => cumulativePriceFor(n) - rental.total_amount

  const paymentNum = parseFloat(payment) || 0
  const existingCredit = rental.outstanding_credit ?? 0
  const totalAvailable = existingCredit + paymentNum

  // หาว่าเงินที่มี (จ่ายใหม่ + เครดิตเก่า) ต่อได้กี่วัน โดยใช้สูตรร้าน (ไม่ใช่หารตรงๆ แบบเส้นตรง)
  const { daysCovered, newCredit } = useMemo(() => {
    if (totalAvailable <= 0) return { daysCovered: 0, newCredit: existingCredit }
    let n = 0
    let costAtN = 0
    for (let i = 1; i <= MAX_EXTRA_DAYS_SEARCH; i++) {
      const cost = incrementalCostFor(i)
      if (cost <= totalAvailable) { n = i; costAtN = cost } else break
    }
    return { daysCovered: n, newCredit: totalAvailable - costAtN }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalAvailable, rental.total_days, rental.total_amount, effectiveDailyRate, monthlyRate])

  const newEnd = useMemo(() => new Date(startDt.getTime() + (rental.total_days + daysCovered) * 86_400_000), [startDt, rental.total_days, daysCovered])

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

  // คิวจองที่จะโดนชนถ้าต่อถึงกำหนดใหม่ (บวก buffer 3 ชม.)
  const BUFFER_MS = 3 * 3_600_000
  const conflictBooking = daysCovered > 0
    ? upcomingBookings.find(b => new Date(b.start_datetime).getTime() < newEndMs + BUFFER_MS)
    : undefined

  // ปุ่มลัด — เติมจำนวนเงินให้ตรงกับ "ต่ออีก N วัน" พอดี (หักเครดิตเก่าที่มีอยู่แล้ว) ตามสูตรร้านจริง
  const fillForDays = (n: number) => setPayment(String(Math.max(0, incrementalCostFor(n) - existingCredit)))

  // ล็อคกันกดซ้อน (สองแตะบนมือถือ/เน็ตช้าแล้วกดซ้ำ) — ใช้ ref เพราะ React state
  // อัพเดตแบบ async ทำให้ setLoading(true) เพียงอย่างเดียวกันไม่ทันในบางเคส
  const submittingRef = useRef(false)

  const handleSubmit = async () => {
    if (submittingRef.current) return
    if (paymentNum <= 0) { setError('กรุณาใส่จำนวนเงิน'); return }
    if (conflictBooking) {
      const ok = confirm(
        `⚠️ ต่อเวลานี้จะชนคิวจอง ${conflictBooking.booking_ref} ของคุณ${conflictBooking.customer_name} ` +
        `(รับรถ ${fmtDate(conflictBooking.start_datetime)})\n\n` +
        `ยืนยันต่อเวลา แล้วไปย้ายคิว/อัพเกรดรถให้ลูกค้าที่จองทันที`
      )
      if (!ok) return
    }
    submittingRef.current = true
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/staff/rental/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rentalId: rental.id,
          payment: paymentNum,
          newEndDatetime: daysCovered > 0 ? newEnd.toISOString() : rental.expected_end_datetime,
          newTotalDays: rental.total_days + daysCovered,
          newCredit,
          overrideBookingConflict: !!conflictBooking,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      // ชนคิว → บังคับวนไปหน้าย้ายคัน/อัพเกรดให้ลูกค้าที่จองทันที
      router.push(conflictBooking ? `/staff/assign/${conflictBooking.id}` : '/staff/home')
    } catch {
      setError('เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      submittingRef.current = false
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

        {/* คิวจองอนาคตของคันนี้ */}
        {upcomingBookings.length > 0 && (
          <div style={{
            background: conflictBooking ? '#fef2f2' : '#fffbeb',
            border: `1.5px solid ${conflictBooking ? '#dc2626' : '#fcd34d'}`,
            borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', fontSize: '13px',
            color: conflictBooking ? '#dc2626' : '#92400e',
          }}>
            {conflictBooking ? (
              <>
                <strong>⛔ ต่อถึง {fmtDate(newEnd.toISOString())} จะชนคิวจอง!</strong><br />
                {conflictBooking.booking_ref} — คุณ{conflictBooking.customer_name} รับรถ {fmtDate(conflictBooking.start_datetime)}<br />
                <span style={{ fontSize: '12px' }}>ถ้ายืนยันต่อ ระบบจะพาไปย้ายคิว/อัพเกรดรถให้ลูกค้าที่จองทันที</span>
              </>
            ) : (
              <>
                📅 คันนี้มีคิวจองถัดไป: <strong>{fmtDate(upcomingBookings[0].start_datetime)}</strong> ({upcomingBookings[0].booking_ref} — คุณ{upcomingBookings[0].customer_name})
                — ต่อได้ถึงก่อนหน้านั้น
              </>
            )}
          </div>
        )}

        {/* Current rental info */}
        <div className="card" style={{ borderTop: `3px solid ${overdueDaysNow > 0 ? '#dc2626' : '#d97706'}` }}>
          <div className="card-title">การเช่าปัจจุบัน</div>
          <div className="info-row">
            <span className="info-key">ผู้เช่า</span>
            <span className="info-val">{customer.name}</span>
          </div>
          <div className="info-row">
            <span className="info-key">เช่าอยู่ตอนนี้</span>
            <span className="info-val">{rental.total_days} วัน</span>
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
          <div className="info-row" style={{ borderBottom: 'none' }}>
            <span className="info-key">ราคา/วัน (ตามสัญญาเดิม)</span>
            <span className="info-val">
              ฿{effectiveDailyRate.toLocaleString()}{isStudentPromo && <span style={{ color: '#7c3aed', fontWeight: 700 }}> 🎓 โปรนักศึกษา</span>}
            </span>
          </div>
        </div>

        {/* Payment input */}
        <div className="card">
          <div className="card-title">รับเงินจากลูกค้า</div>

          {/* Shortcuts — เติมยอดให้ตรงกับจำนวนวันที่เลือก คิดตามสูตรร้านจริง (ไม่ใช่คูณตรงทีละวัน) */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button onClick={() => fillForDays(1)} style={{
              flex: 1, padding: '10px 8px', borderRadius: '10px',
              border: '1.5px solid #e5e7eb', background: '#fff',
              color: '#374151', fontWeight: 600, fontSize: '13px',
              cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.4,
            }}>
              +1 วัน<br />
              <span style={{ fontSize: '11px', color: '#6b7280' }}>฿{Math.max(0, incrementalCostFor(1) - existingCredit).toLocaleString()}</span>
            </button>
            <button onClick={() => fillForDays(7)} style={{
              flex: 1, padding: '10px 8px', borderRadius: '10px',
              border: '1.5px solid #ddd6fe', background: '#f5f3ff',
              color: '#7c3aed', fontWeight: 600, fontSize: '13px',
              cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.4,
            }}>
              รายสัปดาห์ (+7) 🎁<br />
              <span style={{ fontSize: '11px', color: '#7c3aed' }}>฿{Math.max(0, incrementalCostFor(7) - existingCredit).toLocaleString()}</span>
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
            placeholder={`เช่น ${Math.max(0, incrementalCostFor(3) - existingCredit)}`}
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

            <div style={{ borderTop: '1px solid rgba(255,255,255,.2)', paddingTop: '12px' }}>
              {daysCovered === 0 ? (
                <div style={{ background: '#fef2f2', borderRadius: '8px', padding: '10px 12px', color: '#dc2626' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>⚠️ เงินไม่ถึง 1 วัน — จะถูกเก็บเป็นเครดิต</div>
                </div>
              ) : stillOverdueDays > 0 ? (
                <div style={{ background: 'rgba(220,38,38,.15)', borderRadius: '8px', padding: '10px 12px', color: '#fca5a5' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>⚠️ ยังค้างอยู่อีก {stillOverdueDays} วัน</div>
                </div>
              ) : aheadDays > 0 ? (
                <div style={{ background: 'rgba(22,163,74,.15)', borderRadius: '8px', padding: '10px 12px', color: '#86efac' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>✅ ชำระล่วงหน้า {aheadDays} วัน</div>
                </div>
              ) : (
                <div style={{ background: 'rgba(22,163,74,.15)', borderRadius: '8px', padding: '10px 12px', color: '#86efac' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>✅ ชำระครบถึงวันนี้</div>
                </div>
              )}
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

        <button
          className="btn"
          onClick={handleSubmit}
          disabled={loading || paymentNum <= 0}
          style={{
            width: '100%', background: '#d97706', color: '#fff',
            opacity: (loading || paymentNum <= 0) ? 0.5 : 1,
          }}
        >
          {loading ? '⏳ กำลังบันทึก...' : daysCovered === 0 && paymentNum > 0 ? '💾 บันทึกเครดิต' : '💾 ยืนยันต่อเวลา'}
        </button>

      </div>
    </div>
  )
}
