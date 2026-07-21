'use client'

import { useState, useMemo } from 'react'
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

export default function ExtendForm({ rental, upcomingBookings }: Props) {
  const router = useRouter()
  const bike = rental.bikes
  const customer = rental.customers

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // เรทจริงที่ใช้ตอนทำสัญญา (rental.daily_rate = เรทเต็มของรถเสมอ ไม่รวมส่วนลด — เช็คส่วนลดจาก discount แทน)
  // สมมติฐาน: ส่วนลด/วันต้องตรงกับหน้าส่งรถ (SendCarForm.tsx)
  const STUDENT_PROMO_DISCOUNT = 50
  const isStudentPromo = (rental.discount ?? 0) > 0
  const effectiveDailyRate = rental.daily_rate - (isStudentPromo ? STUDENT_PROMO_DISCOUNT : 0)
  const monthlyRate = bike.monthly_rate || bike.daily_rate * 30

  // กรอก "จำนวนวันรวมทั้งหมด" (นับจากวันเริ่มสัญญาเดิม) แทนจำนวนเงิน — ให้คิดราคาด้วยสูตรร้านเสมอ
  const [totalDaysStr, setTotalDaysStr] = useState(String(rental.total_days))
  const totalDaysInput = Math.max(rental.total_days, parseInt(totalDaysStr) || rental.total_days)
  const extraDays = totalDaysInput - rental.total_days

  const startDt = useMemo(() => new Date(rental.start_datetime), [rental.start_datetime])
  const newEnd = useMemo(() => new Date(startDt.getTime() + totalDaysInput * 86_400_000), [startDt, totalDaysInput])

  // ราคารวมทั้งสัญญาใหม่ — คิดด้วยสูตรร้าน (โปร 7 วันจ่าย 5 / cap รายเดือน) ด้วยเรทเดิมตอนทำสัญญา
  const newTotalPrice = extraDays > 0
    ? calcRentQuote(startDt, totalDaysInput, effectiveDailyRate, monthlyRate).total
    : rental.total_amount

  const existingCredit = rental.outstanding_credit ?? 0
  // ต้องเก็บเพิ่ม = ราคารวมใหม่ − ที่จ่ายไปแล้ว − เครดิตค้างจากก่อนหน้า (ติดลบ = จ่ายเกินไว้แล้ว เก็บเป็นเครดิตแทน)
  const rawDue = newTotalPrice - rental.total_amount - existingCredit
  const payment = Math.max(0, rawDue)
  const newCredit = rawDue < 0 ? -rawDue : 0

  const now = Date.now()
  const expectedMs = new Date(rental.expected_end_datetime).getTime()
  const overdueDaysNow = now > expectedMs
    ? Math.ceil((now - expectedMs) / 86_400_000)
    : 0

  const newEndMs = newEnd.getTime()
  const stillOverdueDays = extraDays > 0 && now > newEndMs
    ? Math.ceil((now - newEndMs) / 86_400_000)
    : 0
  const aheadDays = extraDays > 0 && newEndMs > now
    ? Math.floor((newEndMs - now) / 86_400_000)
    : 0

  // คิวจองที่จะโดนชนถ้าต่อถึงกำหนดใหม่ (บวก buffer 3 ชม.)
  const BUFFER_MS = 3 * 3_600_000
  const conflictBooking = extraDays > 0
    ? upcomingBookings.find(b => new Date(b.start_datetime).getTime() < newEndMs + BUFFER_MS)
    : undefined

  const handleSubmit = async () => {
    if (extraDays <= 0) { setError('กรุณาระบุจำนวนวันรวมให้มากกว่าเดิม'); return }
    // ต่อทับคิวได้ แต่ต้องยืนยัน และหลังต่อจะพาไปย้ายคิวให้ลูกค้าที่จองทันที
    if (conflictBooking) {
      const ok = confirm(
        `⚠️ ต่อเวลานี้จะชนคิวจอง ${conflictBooking.booking_ref} ของคุณ${conflictBooking.customer_name} ` +
        `(รับรถ ${fmtDate(conflictBooking.start_datetime)})\n\n` +
        `ยืนยันต่อเวลา แล้วไปย้ายคิว/อัพเกรดรถให้ลูกค้าที่จองทันที`
      )
      if (!ok) return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/staff/rental/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rentalId: rental.id,
          payment,
          newEndDatetime: newEnd.toISOString(),
          newTotalDays: totalDaysInput,
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

        {/* Total days input */}
        <div className="card">
          <div className="card-title">ต่อเวลาเป็นกี่วันรวม</div>

          {/* Shortcuts */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button onClick={() => setTotalDaysStr(String(rental.total_days + 1))} style={{
              flex: 1, padding: '10px 8px', borderRadius: '10px',
              border: '1.5px solid #e5e7eb', background: '#fff',
              color: '#374151', fontWeight: 600, fontSize: '13px',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              +1 วัน
            </button>
            <button onClick={() => setTotalDaysStr(String(rental.total_days + 3))} style={{
              flex: 1, padding: '10px 8px', borderRadius: '10px',
              border: '1.5px solid #e5e7eb', background: '#fff',
              color: '#374151', fontWeight: 600, fontSize: '13px',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              +3 วัน
            </button>
            <button onClick={() => setTotalDaysStr(String(7))} style={{
              flex: 1, padding: '10px 8px', borderRadius: '10px',
              border: '1.5px solid #ddd6fe', background: '#f5f3ff',
              color: '#7c3aed', fontWeight: 600, fontSize: '13px',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              ครบ 7 วัน 🎁
            </button>
          </div>

          <label className="field-label">จำนวนวันรวมทั้งหมด (นับจากวันเริ่มเช่า)</label>
          <input
            className="field-input"
            type="number"
            min={rental.total_days}
            value={totalDaysStr}
            onChange={e => setTotalDaysStr(e.target.value)}
            style={{ fontSize: '20px', fontWeight: 700 }}
          />
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
            ต่อเพิ่ม {extraDays > 0 ? extraDays : 0} วัน จากเดิม {rental.total_days} วัน — ราคาคิดตามสูตรร้าน (เช่า 7 จ่าย 5) ไม่ใช่คูณตรงทีละวัน
          </div>
        </div>

        {/* Summary */}
        {extraDays > 0 && (
          <div style={{
            background: 'linear-gradient(135deg,#111827,#1e293b)',
            borderRadius: '16px', padding: '18px 16px', marginBottom: '12px', color: '#fff',
          }}>
            <div style={{ fontSize: '12px', opacity: .8, marginBottom: '12px' }}>สรุปการต่อเวลา</div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', opacity: .8 }}>รวมเช่าทั้งหมด</span>
              <span style={{ fontSize: '16px', fontWeight: 800 }}>{totalDaysInput} วัน</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', opacity: .8 }}>ราคารวมใหม่ (สูตรร้าน)</span>
              <span style={{ fontSize: '13px', fontWeight: 700 }}>฿{newTotalPrice.toLocaleString()}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', opacity: .8 }}>จ่ายไปแล้ว</span>
              <span style={{ fontSize: '13px', fontWeight: 700 }}>฿{rental.total_amount.toLocaleString()}</span>
            </div>

            {existingCredit > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', opacity: .8 }}>หักเครดิตค้าง</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#86efac' }}>−฿{existingCredit.toLocaleString()}</span>
              </div>
            )}

            {newCredit > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', opacity: .8 }}>จ่ายเกินไว้ — เก็บเป็นเครดิต</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#fbbf24' }}>฿{Math.round(newCredit).toLocaleString()}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', opacity: .8 }}>กำหนดคืนใหม่</span>
              <span style={{ fontSize: '13px', fontWeight: 700 }}>{fmtDate(newEnd.toISOString())}</span>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,.2)', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: stillOverdueDays > 0 ? '8px' : 0 }}>
                <span style={{ fontSize: '13px', fontWeight: 700 }}>💰 เก็บเงินเพิ่ม</span>
                <span style={{ fontSize: '22px', fontWeight: 900, color: '#fbbf24' }}>
                  {payment > 0 ? `฿${payment.toLocaleString()}` : '฿0'}
                </span>
              </div>
              {stillOverdueDays > 0 ? (
                <div style={{ background: 'rgba(220,38,38,.15)', borderRadius: '8px', padding: '10px 12px', color: '#fca5a5' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>⚠️ กำหนดใหม่ยังเกินตอนนี้อยู่ {stillOverdueDays} วัน</div>
                </div>
              ) : aheadDays > 0 ? (
                <div style={{ background: 'rgba(22,163,74,.15)', borderRadius: '8px', padding: '10px 12px', color: '#86efac' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>✅ ชำระล่วงหน้า {aheadDays} วัน</div>
                </div>
              ) : null}
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
          disabled={loading || extraDays <= 0}
          style={{
            width: '100%', background: '#d97706', color: '#fff',
            opacity: (loading || extraDays <= 0) ? 0.5 : 1,
          }}
        >
          {loading ? '⏳ กำลังบันทึก...' : '💾 ยืนยันต่อเวลา'}
        </button>

      </div>
    </div>
  )
}
