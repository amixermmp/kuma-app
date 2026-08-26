'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { calcRentQuote } from '@/lib/pricing'
import { idAndSlipNameMatch } from '@/lib/customer'
import PhotoUpload from '@/components/PhotoUpload'

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
  promoPayDays?: number
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

const MAX_EXTRA_DAYS_SEARCH = 400

function ExtendSuccessScreen({ customerName, bikeLabel, newEndIso }: { customerName: string; bikeLabel: string; newEndIso: string }) {
  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
        <div><h1>ต่อเวลาสำเร็จ ✅</h1><div className="sub">บันทึกเรียบร้อยแล้ว</div></div>
      </div>
      <div className="section-pad" style={{ textAlign: 'center', paddingTop: '40px' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>⏱️</div>
        <div style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a', marginBottom: '8px' }}>ต่อเวลาให้คุณ{customerName} สำเร็จ!</div>
        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>{bikeLabel}</div>
        <div style={{
          background: '#f0fdf4', border: '2px solid #bbf7d0', borderRadius: '14px',
          padding: '18px', marginBottom: '32px',
        }}>
          <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600, marginBottom: '4px' }}>ลูกค้าใช้รถได้ถึง</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#111827' }}>{fmtDate(newEndIso)}</div>
        </div>
        <Link href="/staff/home" style={{
          display: 'block', width: '100%', background: '#111827', color: '#fff',
          borderRadius: '12px', padding: '16px', fontSize: '16px', fontWeight: 700,
          textDecoration: 'none',
        }}>
          🏠 กลับหน้าหลัก
        </Link>
      </div>
    </div>
  )
}

export default function ExtendForm({ rental, upcomingBookings, promoPayDays = 5 }: Props) {
  const router = useRouter()
  const bike = rental.bikes
  const customer = rental.customers

  const [payment, setPayment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successEndIso, setSuccessEndIso] = useState<string | null>(null)

  // หลักฐานการชำระ/สลิป — บังคับแนบทุกครั้งที่ต่อเวลา
  const [photoUrl, setPhotoUrl]           = useState('')
  const [slipOcrLoading, setSlipOcrLoading] = useState(false)
  const [slipOcrName, setSlipOcrName]     = useState('')
  const slipNameMismatch = slipOcrName !== '' && !idAndSlipNameMatch(customer.name, slipOcrName)

  const handleSlipUpload = useCallback(async (url: string) => {
    setPhotoUrl(url)
    setSlipOcrName('')
    setSlipOcrLoading(true)
    try {
      const res = await fetch('/api/staff/ocr-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: url }),
      })
      const data = await res.json()
      if (data.name) setSlipOcrName(data.name)
    } catch {
      // อ่านสลิปไม่สำเร็จ — ไม่บล็อก แค่เทียบชื่อไม่ได้เฉยๆ
    } finally {
      setSlipOcrLoading(false)
    }
  }, [])
  // โปร "เช่า 7 จ่าย 5" ใช้ได้เฉพาะตอนลูกค้าตั้งใจจ่ายเป็นก้อนทีเดียว (กดปุ่มรายสัปดาห์) เท่านั้น —
  // ถ้าทยอยจ่ายทีละวัน (พิมพ์เองหรือกด +1 วัน) คิดราคาเต็มทุกวัน ไม่มีส่วนลดสะสม
  const [useWeeklyPromo, setUseWeeklyPromo] = useState(false)

  // เรทจริงที่ใช้ตอนทำสัญญา (rental.daily_rate = เรทเต็มของรถเสมอ ไม่รวมส่วนลด — เช็คส่วนลดจาก discount แทน)
  // สมมติฐาน: ส่วนลด/วันต้องตรงกับหน้าส่งรถ (SendCarForm.tsx)
  const STUDENT_PROMO_DISCOUNT = 50
  const isStudentPromo = (rental.discount ?? 0) > 0
  const effectiveDailyRate = rental.daily_rate - (isStudentPromo ? STUDENT_PROMO_DISCOUNT : 0)
  const monthlyRate = bike.monthly_rate || bike.daily_rate * 30
  const startDt = useMemo(() => new Date(rental.start_datetime), [rental.start_datetime])

  // เคยสลับรถระหว่างเช่าไหม (เช่นรถเสียกลางทาง) — ถ้าใช่ วันที่ต่อเวลาใหม่ต้องคิดตามเรทคันปัจจุบัน
  // ไม่ใช่คันเดิมตอนทำสัญญา (ช่วงที่จ่ายไปแล้วก่อนสลับไม่โดนแตะ — rental.total_amount เดิมไม่เปลี่ยน)
  const rateChangedFromSwap = bike.daily_rate !== rental.daily_rate
  const currentEffectiveDailyRate = bike.daily_rate - (isStudentPromo ? STUDENT_PROMO_DISCOUNT : 0)
  const extendFromDt = useMemo(() => new Date(rental.expected_end_datetime), [rental.expected_end_datetime])

  // ── เช็คก่อนว่าต่อได้ไหม (แยกอิสระจากเงินโดยสิ้นเชิง) ─────────────────────────
  // ให้พนักงานตอบลูกค้าได้ทันทีตอนแค่ถามว่า "ต่ออีก N วัน/ชม. ได้ไหม" โดยยังไม่ต้องรับเงิน/บันทึกอะไร
  const [checkDays, setCheckDays] = useState('')
  const [checkHours, setCheckHours] = useState('')
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<{
    ok: boolean
    checkedEndIso: string
    conflict: { bookingRef: string; customerName: string; startDatetime: string } | null
    error?: string
  } | null>(null)

  const handleCheck = async () => {
    const d = parseFloat(checkDays) || 0
    const h = parseFloat(checkHours) || 0
    if (d <= 0 && h <= 0) return
    const checkedEndIso = new Date(extendFromDt.getTime() + d * 86_400_000 + h * 3_600_000).toISOString()
    setChecking(true)
    setCheckResult(null)
    try {
      const res = await fetch('/api/staff/rental/extend/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rentalId: rental.id, newEndDatetime: checkedEndIso }),
      })
      const data = await res.json()
      if (!res.ok) { setCheckResult({ ok: false, checkedEndIso, conflict: null, error: data.error || 'เช็คไม่สำเร็จ' }); return }
      setCheckResult({ ok: data.ok, checkedEndIso, conflict: data.conflict })
    } catch {
      setCheckResult({ ok: false, checkedEndIso, conflict: null, error: 'เช็คไม่สำเร็จ ลองอีกครั้ง' })
    } finally {
      setChecking(false)
    }
  }

  // ราคาปุ่ม "รายสัปดาห์" (จ่ายเป็นก้อนทีเดียว) — คิดเป็นสัญญาย่อยแยกอิสระ เริ่มนับใหม่จากกำหนดคืนเดิม
  // เสมอ ไม่เอายอดที่จ่ายมาแล้ว (rental.total_amount) มาหักลบ เพราะยอดนั้นอาจมาจากการทยอยจ่ายทีละวัน
  // สะสมมาก่อน (ไม่ได้โปร) — เดิมสูตร "คิดรวมทั้งสัญญาแล้วลบยอดจ่ายเดิม" ทำให้ยอดทยอยจ่ายที่สะสมไว้
  // มีผลเหมือนถูกนับเป็นส่วนหนึ่งของแพ็กเกจ 7 วัน ปลดล็อกส่วนลดให้ทั้งที่ไม่ได้จ่ายเป็นก้อนจริง
  // (บางเคสยอดจ่ายสะสมมากกว่าราคาสัญญารวมตามสูตรโปรด้วยซ้ำ ทำให้ปุ่มรายสัปดาห์ขึ้น ฿0)
  const weeklyPromoIncrementalCostFor = (n: number) =>
    calcRentQuote(extendFromDt, n, rateChangedFromSwap ? currentEffectiveDailyRate : effectiveDailyRate, monthlyRate, promoPayDays).total
  // ราคาเต็มไม่มีโปร — ใช้กับการทยอยจ่ายทีละวัน (พิมพ์เองหรือกด +1 วัน)
  const flatIncrementalCostFor = (n: number) => n * (rateChangedFromSwap ? currentEffectiveDailyRate : effectiveDailyRate)

  const paymentNum = parseFloat(payment) || 0
  const existingCredit = rental.outstanding_credit ?? 0
  const totalAvailable = existingCredit + paymentNum

  // หาว่าเงินที่มี (จ่ายใหม่ + เครดิตเก่า) ต่อได้กี่วัน
  const { daysCovered, newCredit } = useMemo(() => {
    if (totalAvailable <= 0) return { daysCovered: 0, newCredit: existingCredit }
    if (useWeeklyPromo) {
      // โปร 7 จ่าย 5 — หาจำนวนวันสูงสุดที่จ่ายไหวตามสูตรร้าน (ไม่ใช่หารตรงๆ แบบเส้นตรง)
      let n = 0
      let costAtN = 0
      for (let i = 1; i <= MAX_EXTRA_DAYS_SEARCH; i++) {
        const cost = weeklyPromoIncrementalCostFor(i)
        if (cost <= totalAvailable) { n = i; costAtN = cost } else break
      }
      return { daysCovered: n, newCredit: totalAvailable - costAtN }
    }
    // ทยอยจ่ายทีละวัน — ราคาเต็มตรงไปตรงมา ไม่มีส่วนลดสะสม (เรทคันปัจจุบันถ้าเคยสลับรถ)
    const dayRate = rateChangedFromSwap ? currentEffectiveDailyRate : effectiveDailyRate
    const n = Math.floor(totalAvailable / dayRate)
    return { daysCovered: n, newCredit: totalAvailable - n * dayRate }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalAvailable, useWeeklyPromo, rental.total_days, rental.total_amount, effectiveDailyRate, monthlyRate, rateChangedFromSwap, currentEffectiveDailyRate])

  const newEnd = useMemo(() => new Date(startDt.getTime() + (rental.total_days + daysCovered) * 86_400_000), [startDt, rental.total_days, daysCovered])

  const now = Date.now()
  const expectedMs = new Date(rental.expected_end_datetime).getTime()
  // ใช้ floor เหมือนป้าย "เกิน N วัน" ในหน้า Job Tasks (นับเป็นวันเต็มที่ผ่านไปแล้วเท่านั้น) —
  // เดิมหน้านี้ใช้ ceil ทำให้เลขไม่ตรงกับหน้า Job Tasks (เช่น เกิน 30 ชม. หน้านึงขึ้น 1 วัน อีกหน้าขึ้น 2 วัน)
  const overdueDaysNow = now > expectedMs
    ? Math.floor((now - expectedMs) / 86_400_000)
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

  // ปุ่มลัด — เติมจำนวนเงินให้ตรงกับ "ต่ออีก N วัน" พอดี (หักเครดิตเก่าที่มีอยู่แล้ว)
  // weekly=true (ปุ่มรายสัปดาห์เท่านั้น) ถึงจะใช้สูตรโปร 7 จ่าย 5 นอกนั้นราคาเต็มเสมอ
  const fillForDays = (n: number, weekly: boolean) => {
    setUseWeeklyPromo(weekly)
    const cost = weekly ? weeklyPromoIncrementalCostFor(n) : flatIncrementalCostFor(n)
    setPayment(String(Math.max(0, cost - existingCredit)))
  }

  // ล็อคกันกดซ้อน (สองแตะบนมือถือ/เน็ตช้าแล้วกดซ้ำ) — ใช้ ref เพราะ React state
  // อัพเดตแบบ async ทำให้ setLoading(true) เพียงอย่างเดียวกันไม่ทันในบางเคส
  const submittingRef = useRef(false)

  const handleSubmit = async () => {
    if (submittingRef.current) return
    if (paymentNum <= 0) { setError('กรุณาใส่จำนวนเงิน'); return }
    if (!photoUrl) { setError('กรุณาแนบรูปหลักฐานการชำระ'); return }
    if (conflictBooking) {
      const ok = confirm(
        `⚡ ต่อเวลานี้จะชนคิวจอง ${conflictBooking.booking_ref} ของคุณ${conflictBooking.customer_name} ` +
        `(รับรถ ${fmtDate(conflictBooking.start_datetime)})\n\n` +
        `ใช้ Fast lane ยืนยันต่อเวลา (คิวนั้นจะยังไม่ถูกยกเลิก) แล้วไปย้ายคิว/หารถแทนให้ลูกค้าที่จองทันที`
      )
      if (!ok) return
    }
    submittingRef.current = true
    setLoading(true)
    setError('')
    try {
      const buildBody = (override: boolean) => JSON.stringify({
        rentalId: rental.id,
        payment: paymentNum,
        newEndDatetime: daysCovered > 0 ? newEnd.toISOString() : rental.expected_end_datetime,
        newTotalDays: rental.total_days + daysCovered,
        newCredit,
        overrideBookingConflict: override,
        photoUrl,
        slipCustomerName: slipOcrName || null,
      })

      let res = await fetch('/api/staff/rental/extend', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: buildBody(!!conflictBooking),
      })
      let data = await res.json()

      // ชนคิวแบบ "รุ่นเดียวกันไม่พอ" เช็คได้แค่ฝั่ง server เท่านั้น (ไม่มีทางเตือนล่วงหน้าเหมือนชนคันเดียวกัน)
      // ถ้าเจอตรงนี้แปลว่ายังไม่เคยถามยืนยัน Fast lane มาก่อน — ถามแล้วยิงซ้ำแบบ override ให้เลย ไม่งั้นกดยืนยันกี่ครั้งก็ต่อไม่ได้
      let routeConflictId = conflictBooking?.id
      if (!res.ok && res.status === 409 && data.conflictBookingId && !conflictBooking) {
        const ok = confirm(`⚡ ${data.error}`)
        if (!ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
        routeConflictId = data.conflictBookingId
        res = await fetch('/api/staff/rental/extend', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: buildBody(true),
        })
        data = await res.json()
      }

      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      if (routeConflictId) {
        // ชนคิว → บังคับวนไปหน้าย้ายคัน/อัพเกรดให้ลูกค้าที่จองทันที
        router.push(`/staff/assign/${routeConflictId}`)
      } else {
        // สำเร็จ → โชว์หน้ายืนยันว่าลูกค้าใช้ได้ถึงวันไหน ให้พนักงานกดกลับหน้าหลักเอง
        setSuccessEndIso(daysCovered > 0 ? newEnd.toISOString() : rental.expected_end_datetime)
      }
    } catch {
      setError('เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      submittingRef.current = false
      setLoading(false)
    }
  }

  if (successEndIso) {
    return <ExtendSuccessScreen customerName={customer.name} bikeLabel={`${bike.license_plate} ${bike.brand} ${bike.model}`} newEndIso={successEndIso} />
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

        {/* เช็คก่อนว่าต่อได้ไหม — แยกอิสระจากเงินโดยสิ้นเชิง ไว้ตอบลูกค้าก่อนตัดสินใจ ไม่บันทึกอะไรเลย */}
        <div className="card">
          <div className="card-title">🔍 เช็คก่อนว่าต่อได้ไหม</div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
            ไม่เก็บเงิน ไม่บันทึกอะไรทั้งสิ้น — ใช้ตอบลูกค้าก่อนตัดสินใจได้เลย
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <label className="field-label">ต่ออีกกี่วัน</label>
              <input className="field-input" type="number" min={0} placeholder="0"
                value={checkDays}
                onChange={e => { setCheckDays(e.target.value); setCheckResult(null) }} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="field-label">ต่ออีกกี่ชม.</label>
              <input className="field-input" type="number" min={0} placeholder="0"
                value={checkHours}
                onChange={e => { setCheckHours(e.target.value); setCheckResult(null) }} />
            </div>
          </div>
          <button
            onClick={handleCheck}
            disabled={checking || (!checkDays && !checkHours)}
            style={{
              width: '100%', padding: '11px', borderRadius: '10px', border: '1.5px solid #2563eb',
              background: checking ? '#f3f4f6' : '#eff6ff', color: '#2563eb', fontWeight: 700, fontSize: '14px',
              cursor: checking || (!checkDays && !checkHours) ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {checking ? '⏳ กำลังเช็ค...' : '🔍 เช็คเลย'}
          </button>
          {checkResult && (
            <div style={{
              marginTop: '12px', borderRadius: '10px', padding: '10px 14px', fontSize: '13px',
              background: checkResult.error ? '#fef2f2' : checkResult.ok ? '#f0fdf4' : '#fef2f2',
              border: `1.5px solid ${checkResult.error ? '#fecaca' : checkResult.ok ? '#bbf7d0' : '#fecaca'}`,
              color: checkResult.error ? '#dc2626' : checkResult.ok ? '#16a34a' : '#dc2626',
            }}>
              {checkResult.error ? (
                <>⚠️ {checkResult.error}</>
              ) : checkResult.ok ? (
                <><strong>✅ ต่อได้ ไม่ชนคิวจอง</strong> — ถึง {fmtDate(checkResult.checkedEndIso)}</>
              ) : (
                <>
                  <strong>⛔ ต่อแบบนี้ไม่ได้ปกติ — ชนคิวจอง</strong><br />
                  {checkResult.conflict?.bookingRef} — คุณ{checkResult.conflict?.customerName} รับรถ {checkResult.conflict ? fmtDate(checkResult.conflict.startDatetime) : ''}
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>ต้องใช้ Fast lane ยืนยันถึงจะต่อได้จริง</div>
                </>
              )}
            </div>
          )}
        </div>

        {rateChangedFromSwap && (
          <div style={{
            background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: '10px',
            padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: '#92400e',
          }}>
            🔄 <strong>เคยสลับรถระหว่างเช่า</strong> — ช่วงที่จ่ายไปแล้วยังคิดราคาคันเดิมเหมือนเดิม
            (฿{effectiveDailyRate.toLocaleString()}/วัน) แต่วันที่ต่อเวลาเพิ่มใหม่นี้จะคิดราคาคันปัจจุบัน
            (฿{currentEffectiveDailyRate.toLocaleString()}/วัน)
          </div>
        )}

        {/* Payment input */}
        <div className="card">
          <div className="card-title">รับเงินจากลูกค้า</div>

          {/* Shortcuts — ราคาเต็มทุกวัน ยกเว้นปุ่มรายสัปดาห์ที่ใช้โปร 7 จ่าย 5 (ต้องจ่ายเป็นก้อนทีเดียวเท่านั้นถึงได้โปร) */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button onClick={() => fillForDays(1, false)} style={{
              flex: 1, padding: '10px 8px', borderRadius: '10px',
              border: '1.5px solid #e5e7eb', background: '#fff',
              color: '#374151', fontWeight: 600, fontSize: '13px',
              cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.4,
            }}>
              +1 วัน<br />
              <span style={{ fontSize: '11px', color: '#6b7280' }}>฿{Math.max(0, flatIncrementalCostFor(1) - existingCredit).toLocaleString()}</span>
            </button>
            <button onClick={() => fillForDays(7, true)} style={{
              flex: 1, padding: '10px 8px', borderRadius: '10px',
              border: '1.5px solid #ddd6fe', background: '#f5f3ff',
              color: '#7c3aed', fontWeight: 600, fontSize: '13px',
              cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.4,
            }}>
              รายสัปดาห์ (+7) 🎁<br />
              <span style={{ fontSize: '11px', color: '#7c3aed' }}>฿{Math.max(0, weeklyPromoIncrementalCostFor(7) - existingCredit).toLocaleString()}</span>
            </button>
            <button onClick={() => { setPayment(''); setUseWeeklyPromo(false) }} style={{
              flex: 1, padding: '10px 8px', borderRadius: '10px',
              border: '1.5px solid #d97706', background: '#fffbeb',
              color: '#d97706', fontWeight: 600, fontSize: '13px',
              cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.4,
            }}>
              ระบุเอง
            </button>
          </div>
          {useWeeklyPromo && (
            <div style={{ fontSize: '11px', color: '#7c3aed', marginTop: '-10px', marginBottom: '12px' }}>
              🎁 ใช้โปรรายสัปดาห์อยู่ — ถ้าแก้ยอดเองจะกลับไปคิดราคาเต็มทันที
            </div>
          )}

          <label className="field-label">จำนวนเงินที่รับ (บาท)</label>
          <input
            className="field-input"
            type="number"
            placeholder={`เช่น ${Math.max(0, flatIncrementalCostFor(3) - existingCredit)}`}
            value={payment}
            onChange={e => { setPayment(e.target.value); setUseWeeklyPromo(false) }}
            style={{ fontSize: '20px', fontWeight: 700 }}
          />
          {existingCredit > 0 && paymentNum > 0 && (
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
              เครดิตเก่า ฿{existingCredit.toLocaleString()} + รับใหม่ ฿{paymentNum.toLocaleString()} = รวม ฿{totalAvailable.toLocaleString()}
            </div>
          )}

          <div className="field-row" style={{ marginTop: '14px', marginBottom: 0 }}>
            <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              💳 หลักฐานการชำระ *
              {slipOcrLoading && <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 400 }}>⏳ กำลังอ่านสลิป...</span>}
            </label>
            <PhotoUpload icon="📱" hint="ถ่ายรูปหรืออัพโหลดสลิป" folder={`extend/${rental.id}`}
              onUpload={handleSlipUpload} onRemove={() => { setPhotoUrl(''); setSlipOcrName('') }} />
            {slipNameMismatch && (
              <div style={{
                marginTop: 8, padding: '10px 12px', borderRadius: 8,
                background: '#fef2f2', border: '1px solid #fecaca',
                fontSize: 12, color: '#dc2626', lineHeight: 1.6,
              }}>
                ⚠️ ชื่อในสลิปไม่ตรงกับชื่อผู้เช่า<br />
                🪪 ผู้เช่า: <strong>{customer.name}</strong><br />
                💳 ผู้โอน: <strong>{slipOcrName}</strong>
              </div>
            )}
          </div>
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
          disabled={loading || paymentNum <= 0 || !photoUrl}
          style={{
            width: '100%', background: '#d97706', color: '#fff',
            opacity: (loading || paymentNum <= 0 || !photoUrl) ? 0.5 : 1,
          }}
        >
          {loading ? '⏳ กำลังบันทึก...' : daysCovered === 0 && paymentNum > 0 ? '💾 บันทึกเครดิต' : '💾 ยืนยันต่อเวลา'}
        </button>

      </div>
    </div>
  )
}
