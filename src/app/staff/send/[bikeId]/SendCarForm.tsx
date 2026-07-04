'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import PhotoUpload from '@/components/PhotoUpload'
import SignaturePad from '@/components/SignaturePad'
import TabBar from '@/components/staff/TabBar'
import { addTab } from '@/lib/tabStore'

// ── Pricing formula ──────────────────────────────────────────────────────────
// Per-week discount: every 7 days → pay for 5 (2 free)
// Monthly cap: if daily portion >= MCR → cap at MCR
// Long rental: break into calendar months (min 30 days each for Feb) + remaining days

type MonthSegment = { label: string; days: number; price: number }
type PriceResult = {
  months: MonthSegment[]
  remainDays: number
  remainPrice: number
  calcRemainDays: number
  total: number
}

function calcDailySegment(days: number, ndr: number, mcr: number): { calcDays: number; price: number } {
  const calcDays = Math.floor(days / 7) * 5 + Math.min(days % 7, 5)
  return { calcDays, price: Math.min(calcDays * ndr, mcr) }
}

function calcShortPrice(totalDays: number, ndr: number): { calcDays: number; total: number } {
  const calcDays = Math.floor(totalDays / 7) * 5 + Math.min(totalDays % 7, 5)
  return { calcDays, total: calcDays * ndr }
}

function calcLongPrice(start: Date, end: Date, ndr: number, mcr: number): PriceResult | null {
  if (end <= start) return null

  let cursor = new Date(start)
  const months: MonthSegment[] = []
  let total = 0

  while (true) {
    const next = new Date(cursor)
    next.setMonth(next.getMonth() + 1)
    if (next >= end) break

    const rawDays = Math.round((next.getTime() - cursor.getTime()) / 86_400_000)
    const effectiveDays = Math.max(rawDays, 30) // Feb rule: min 30 days
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

// ── Success screen ───────────────────────────────────────────────────────────
function SuccessScreen({ rentalId, type, bikeId }: { rentalId: string; type: 'daily' | 'monthly'; bikeId: string }) {
  const invoiceHref = type === 'daily'
    ? `/staff/invoice/${rentalId}`
    : `/staff/invoice/monthly/${rentalId}`
  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div><h1>ส่งรถสำเร็จ ✅</h1><div className="sub">บันทึกการเช่าเรียบร้อยแล้ว</div></div>
      </div>
      <div className="section-pad" style={{ textAlign: 'center', paddingTop: '40px' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🛵</div>
        <div style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a', marginBottom: '8px' }}>ส่งรถให้ลูกค้าสำเร็จ!</div>
        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '32px' }}>
          {type === 'daily' ? 'สัญญาเช่ารายวัน' : 'สัญญาเช่ารายเดือน'}ถูกบันทึกแล้ว
        </div>
        <Link href={`/staff/contract/${rentalId}`} style={{
          display: 'block', width: '100%', background: '#111827', color: '#fff',
          borderRadius: '12px', padding: '16px', fontSize: '16px', fontWeight: 700,
          textDecoration: 'none', marginBottom: '12px',
        }}>
          📄 ดูสัญญา / ส่งให้ลูกค้า
        </Link>
        <Link href={invoiceHref} style={{
          display: 'block', width: '100%', background: '#1e293b', color: '#fff',
          borderRadius: '12px', padding: '16px', fontSize: '16px', fontWeight: 700,
          textDecoration: 'none', marginBottom: '12px',
        }}>
          🧾 ออกใบกำกับภาษี / ใบเสร็จ
        </Link>
        <Link href="/staff/home" style={{
          display: 'block', width: '100%', background: '#f3f4f6', color: '#374151',
          borderRadius: '12px', padding: '16px', fontSize: '16px', fontWeight: 700,
          textDecoration: 'none', marginBottom: '12px',
        }}>
          🏠 กลับหน้าหลัก
        </Link>
        <Link href={`/staff/bikes/${bikeId}/menu`} style={{
          display: 'block', fontSize: '13px', color: '#9ca3af', textDecoration: 'none', marginTop: '8px',
        }}>
          ← กลับเมนูรถ
        </Link>
      </div>
    </div>
  )
}

// ── Types ────────────────────────────────────────────────────────────────────
type Bike = {
  id: string
  license_plate: string
  brand: string
  model: string
  daily_rate: number
  monthly_rate: number | null
  deposit_amount: number
  odometer: number
}

type PrefillBooking = {
  id: string
  customer_name: string
  customer_phone: string
  customer_hotel: string | null
  start_datetime: string
  end_datetime: string
  total_days: number
  notes: string | null
} | null

type Props = {
  bike: Bike
  staffId: string
  promotions: unknown[] // kept for future use, not rendered in this form
  prefillBooking?: PrefillBooking
  prefillFrom?: string  // datetime-local Bangkok format e.g. "2026-07-01T10:00"
  prefillTo?: string
}

type PhotoState = {
  id_card: string
  selfie: string
  with_bike: string
  damage: string
  payment: string
}

// ── Draft persistence ─────────────────────────────────────────────────────────
type DraftData = {
  customerName: string; customerPhone: string; customerHotel: string
  startDate: string; endDate: string; startTime: string
  studentPromo: boolean; contractType: 'onetime' | 'monthly'; mMonthlyRate: string
  odometer: string; fuelLevel: number; paymentMethod: 'cash' | 'transfer'
  depositAmount: string; lockBike: boolean | null; signature: string | null
  photos: PhotoState
}
function getDraft(key: string): DraftData | null {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(sessionStorage.getItem(key) || 'null') } catch { return null }
}
function saveDraft(key: string, data: DraftData) {
  try { sessionStorage.setItem(key, JSON.stringify(data)) } catch {}
}
function clearDraft(key: string) {
  try { sessionStorage.removeItem(key) } catch {}
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function todayLocal() {
  const d = new Date()
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function dateIn(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function nowTime() {
  const d = new Date()
  const h = d.getHours()
  const rawM = d.getMinutes()
  const m = Math.round(rawM / 15) * 15
  if (m === 60) return `${((h + 1) % 24).toString().padStart(2, '0')}:00`
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

// ── Component ────────────────────────────────────────────────────────────────
export default function SendCarForm({ bike, staffId, prefillBooking, prefillFrom, prefillTo }: Props) {
  const DRAFT_KEY = `send_draft_${bike.id}`

  useEffect(() => {
    addTab({ type: 'sendcar', title: `ส่งรถ ${bike.license_plate}`, href: `/staff/send/${bike.id}` })
  }, [bike.id, bike.license_plate])

  // Load saved draft once (skip if from booking flow)
  const [draft] = useState<DraftData | null>(() => prefillBooking ? null : getDraft(`send_draft_${bike.id}`))

  // ── Customer ──────────────────────────────────────────────────────────────
  const [customerName,  setCustomerName]  = useState(draft?.customerName  ?? prefillBooking?.customer_name  ?? '')
  const [customerPhone, setCustomerPhone] = useState(draft?.customerPhone ?? prefillBooking?.customer_phone ?? '')
  const [customerHotel, setCustomerHotel] = useState(draft?.customerHotel ?? prefillBooking?.customer_hotel ?? '')

  // ── Dates ─────────────────────────────────────────────────────────────────
  const [startDate, setStartDate] = useState(() => {
    if (draft?.startDate) return draft.startDate
    if (prefillBooking?.start_datetime) return prefillBooking.start_datetime.split('T')[0]
    if (prefillFrom) return prefillFrom.split('T')[0]
    return todayLocal()
  })
  const [endDate, setEndDate] = useState(() => {
    if (draft?.endDate) return draft.endDate
    if (prefillBooking?.end_datetime) return prefillBooking.end_datetime.split('T')[0]
    if (prefillTo) return prefillTo.split('T')[0]
    return dateIn(1)
  })
  const [startTime, setStartTime] = useState(() => {
    if (draft?.startTime) return draft.startTime
    if (prefillFrom?.includes('T')) return prefillFrom.split('T')[1].slice(0, 5)
    return nowTime()
  })

  // ── Promo ─────────────────────────────────────────────────────────────────
  const [studentPromo, setStudentPromo] = useState(draft?.studentPromo ?? false)

  // ── Long-rental contract type ─────────────────────────────────────────────
  const [contractType,  setContractType]  = useState<'onetime' | 'monthly'>(draft?.contractType ?? 'monthly')
  const [mMonthlyRate,  setMMonthlyRate]  = useState(draft?.mMonthlyRate ?? String(bike.monthly_rate ?? ''))

  // ── Bike condition ────────────────────────────────────────────────────────
  const [odometer,  setOdometer]  = useState(draft?.odometer ?? String(bike.odometer ?? ''))
  const [fuelLevel, setFuelLevel] = useState(draft?.fuelLevel ?? 8)

  // ── Payment ───────────────────────────────────────────────────────────────
  const [paymentMethod,  setPaymentMethod]  = useState<'cash' | 'transfer'>(draft?.paymentMethod ?? 'cash')
  const [depositAmount,  setDepositAmount]  = useState(draft?.depositAmount ?? String(bike.deposit_amount ?? 0))

  // ── Photos ────────────────────────────────────────────────────────────────
  const [photos, setPhotos] = useState<PhotoState>(draft?.photos ?? {
    id_card: '', selfie: '', with_bike: '', damage: '', payment: '',
  })

  // ── Lock (daily only; monthly = auto-locked) ──────────────────────────────
  const [lockBike,   setLockBike]   = useState<boolean | null>(draft?.lockBike ?? null)
  const [lockError,  setLockError]  = useState(false)

  // ── Signature ─────────────────────────────────────────────────────────────
  const [signature,    setSignature]    = useState<string | null>(draft?.signature ?? null)
  const [showSignPad,  setShowSignPad]  = useState(false)

  // ── Auto-save draft ───────────────────────────────────────────────────────
  // Keep a ref to latest form data for immediate saves (avoids stale closure)
  const latestDraft = useRef<DraftData>({
    customerName, customerPhone, customerHotel, startDate, endDate, startTime,
    studentPromo, contractType, mMonthlyRate, odometer, fuelLevel, paymentMethod,
    depositAmount, lockBike, signature, photos,
  })
  latestDraft.current = {
    customerName, customerPhone, customerHotel, startDate, endDate, startTime,
    studentPromo, contractType, mMonthlyRate, odometer, fuelLevel, paymentMethod,
    depositAmount, lockBike, signature, photos,
  }

  useEffect(() => {
    if (prefillBooking) return
    saveDraft(DRAFT_KEY, latestDraft.current)
  }, [DRAFT_KEY, customerName, customerPhone, customerHotel, startDate, endDate, startTime,
      studentPromo, contractType, mMonthlyRate, odometer, fuelLevel, paymentMethod,
      depositAmount, lockBike, signature, photos, prefillBooking])

  // Save signature immediately (don't wait for effect — avoids race on tab switch)
  const handleSaveSignature = useCallback((sig: string) => {
    setSignature(sig)
    if (!prefillBooking) saveDraft(DRAFT_KEY, { ...latestDraft.current, signature: sig })
  }, [DRAFT_KEY, prefillBooking])

  // ── UI ────────────────────────────────────────────────────────────────────
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState('')
  const [createdRentalId, setCreatedRentalId] = useState<string | null>(null)
  const [createdType,     setCreatedType]     = useState<'daily' | 'monthly'>('daily')
  const [ocrLoading,      setOcrLoading]      = useState(false)
  const [ocrDone,         setOcrDone]         = useState(false)
  const [ocrError,        setOcrError]        = useState('')

  const folder = `send/${bike.id}`

  const setPhoto = useCallback((key: keyof PhotoState) => (url: string) =>
    setPhotos(prev => ({ ...prev, [key]: url })), [])
  const clearPhoto = useCallback((key: keyof PhotoState) => () =>
    setPhotos(prev => ({ ...prev, [key]: '' })), [])

  // OCR บัตรประชาชน — auto-fill ชื่อลูกค้า
  const handleIdCardUpload = useCallback(async (url: string) => {
    setPhoto('id_card')(url)
    if (customerName) return // มีชื่อแล้ว ไม่ต้อง OCR
    setOcrLoading(true)
    setOcrDone(false)
    setOcrError('')
    try {
      const res = await fetch('/api/staff/ocr-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: url }),
      })
      const data = await res.json()
      if (data.name) {
        setCustomerName(data.name)
        setOcrDone(true)
      } else if (data.error) {
        setOcrError(`OCR: ${data.detail ?? data.error}`)
      } else {
        setOcrError('อ่านชื่อไม่ได้ — กรอกเองคับ')
      }
    } catch (e) {
      setOcrError(`OCR error: ${String(e)}`)
    } finally {
      setOcrLoading(false)
    }
  }, [customerName, setPhoto])

  // ── Derived ───────────────────────────────────────────────────────────────
  const startDt = new Date(`${startDate}T${startTime}:00`)
  const endDt   = new Date(`${endDate}T${startTime}:00`)
  const validDates = startDate && endDate && endDt > startDt
  const totalDays  = validDates
    ? Math.round((endDt.getTime() - startDt.getTime()) / 86_400_000)
    : 0

  const isLongRental      = totalDays >= 30
  const isMonthlyContract = isLongRental && contractType === 'monthly'

  const ndr = studentPromo ? bike.daily_rate - 50 : bike.daily_rate
  const mcr = parseFloat(mMonthlyRate) || bike.monthly_rate || bike.daily_rate * 30

  const longResult  = isLongRental && totalDays > 0 ? calcLongPrice(startDt, endDt, ndr, mcr) : null
  const shortResult = !isLongRental && totalDays > 0 ? calcShortPrice(totalDays, ndr) : null

  const totalAmount = isMonthlyContract
    ? mcr
    : (isLongRental ? (longResult?.total ?? 0) : (shortResult?.total ?? 0))

  // Discount = difference from non-student price (for record-keeping)
  const normalTotal = isLongRental
    ? (calcLongPrice(startDt, endDt, bike.daily_rate, mcr)?.total ?? 0)
    : calcShortPrice(totalDays, bike.daily_rate).total
  const discount = studentPromo ? Math.max(0, normalTotal - totalAmount) : 0

  // Payment day for monthly = same day as start date
  const paymentDay = startDate
    ? new Date(startDate + 'T12:00:00').getDate()
    : 1

  // ── Customer lookup ───────────────────────────────────────────────────────
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

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!customerName.trim())  { setError('กรุณาใส่ชื่อลูกค้า'); return }
    if (!customerPhone.trim()) { setError('กรุณาใส่เบอร์โทร'); return }
    if (!validDates)           { setError('กรุณาเลือกช่วงวันเช่าให้ถูกต้อง'); return }

    // Lock is required for daily/onetime
    if (!isMonthlyContract && lockBike === null) {
      setLockError(true)
      document.getElementById('lockSection')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setLockError(false)
    setError('')
    setLoading(true)

    try {
      if (isMonthlyContract) {
        if (!mMonthlyRate || parseFloat(mMonthlyRate) <= 0) {
          setError('กรุณาใส่ราคาเช่าต่อเดือน')
          setLoading(false)
          return
        }
        const res = await fetch('/api/staff/monthly/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bikeId: bike.id,
            staffId,
            customer: {
              name: customerName.trim(),
              phone: customerPhone.trim(),
              address: customerHotel.trim(),
            },
            startDate,
            paymentDay,
            monthlyRate:   parseFloat(mMonthlyRate),
            depositAmount: parseFloat(depositAmount) || 0,
            odometer:      odometer || '0',
            fuelLevel,
            paymentMethod,
            photos,
            signature: signature ?? null,
          }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
        clearDraft(DRAFT_KEY)
        setCreatedType('monthly')
        setCreatedRentalId(data.rentalId ?? data.id ?? null)

      } else {
        const startDatetime = `${startDate}T${startTime}:00+07:00`
        const endDatetime   = `${endDate}T${startTime}:00+07:00`
        const res = await fetch('/api/staff/rental/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bikeId: bike.id,
            staffId,
            customer: {
              name:  customerName.trim(),
              phone: customerPhone.trim(),
              hotel: customerHotel.trim(),
            },
            startDatetime,
            endDatetime,
            dailyRate:     bike.daily_rate,
            totalDays,
            totalAmount,
            depositAmount: parseFloat(depositAmount) || 0,
            discount,
            paymentMethod,
            fuelLevel,
            odometer:      odometer || '0',
            photos,
            signature: signature ?? null,
            lockBike:  lockBike ?? false,
          }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
        clearDraft(DRAFT_KEY)
        setCreatedType('daily')
        setCreatedRentalId(data.rentalId ?? data.id ?? null)
        // Close the source booking if came from assign flow
        if (prefillBooking?.id) {
          await fetch('/api/staff/booking/close', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: prefillBooking.id }),
          }).catch(() => {/* non-critical */})
        }
      }
    } catch {
      setError('เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (createdRentalId) {
    return <SuccessScreen rentalId={createdRentalId} type={createdType} bikeId={bike.id} />
  }

  const headerBg = isMonthlyContract
    ? 'linear-gradient(135deg,#7c3aed,#111827)'
    : 'linear-gradient(135deg,#111827,#374151)'

  const freeWeeks = Math.floor(totalDays / 7)

  return (
    <div className="app-wrap">

      {/* Header */}
      <div className="app-header" style={{ background: headerBg }}>
        <Link href={`/staff/bikes/${bike.id}/menu`} className="app-header-back">←</Link>
        <div>
          <h1>ส่งรถ 🛵</h1>
          <div className="sub">{bike.license_plate} {bike.brand} {bike.model}</div>
        </div>
      </div>
      <TabBar />

      <div className="section-pad">

        {/* Booking pre-fill banner */}
        {prefillBooking && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px',
            padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: '#15803d',
          }}>
            📋 <strong>มาจากการจอง</strong> — ข้อมูลลูกค้าถูกกรอกล่วงหน้าแล้ว แก้ไขได้ตามต้องการ
          </div>
        )}

        {/* ① ข้อมูลลูกค้า */}
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
            <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              ชื่อ - นามสกุล *
              {ocrLoading && <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 400 }}>⏳ กำลังอ่านบัตร...</span>}
              {ocrDone    && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 400 }}>✓ อ่านชื่อแล้ว</span>}
              {ocrError   && <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 400 }}>{ocrError}</span>}
            </label>
            <input className="field-input" type="text" placeholder="สมชาย ดีใจ"
              value={customerName} onChange={e => { setCustomerName(e.target.value); setOcrDone(false); setOcrError('') }} />
          </div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">โรงแรม / ที่พัก</label>
            <input className="field-input" type="text" placeholder="Nap Park Hotel"
              value={customerHotel} onChange={e => setCustomerHotel(e.target.value)} />
          </div>
        </div>

        {/* ② ช่วงเวลาเช่า */}
        <div className="card">
          <div className="card-title">ช่วงเวลาเช่า</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div className="field-row" style={{ marginBottom: 0 }}>
              <label className="field-label">วันที่รับรถ *</label>
              <input className="field-input" type="date"
                value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="field-row" style={{ marginBottom: 0 }}>
              <label className="field-label">วันที่กำหนดคืน *</label>
              <input className="field-input" type="date"
                value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">เวลารับรถ</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                className="field-input" style={{ flex: 1 }}
                value={startTime.split(':')[0] ?? '08'}
                onChange={e => setStartTime(e.target.value + ':' + (startTime.split(':')[1] ?? '00'))}
              >
                {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map(h => (
                  <option key={h} value={h}>{h} น.</option>
                ))}
              </select>
              <select
                className="field-input" style={{ flex: 1 }}
                value={startTime.split(':')[1] ?? '00'}
                onChange={e => setStartTime((startTime.split(':')[0] ?? '08') + ':' + e.target.value)}
              >
                {['00', '15', '30', '45'].map(m => (
                  <option key={m} value={m}>{m} นาที</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ② ½ โปรโมชั่น */}
        <div className="card">
          <div className="card-title">โปรโมชั่น</div>
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
            <div style={{ marginTop: '10px', background: '#f1f5f9', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#111827' }}>
              ลด ฿50/วัน จากราคารายวันปกติ — ไม่รวมค่าเช่ารายเดือน
            </div>
          )}
        </div>

        {/* ③ Price hero */}
        {totalDays > 0 && (
          <div style={{
            background: isMonthlyContract
              ? 'linear-gradient(135deg,#7c3aed,#111827)'
              : 'linear-gradient(135deg,#111827,#111827)',
            borderRadius: '16px', padding: '18px 16px', marginBottom: '12px', color: '#fff',
          }}>
            <div style={{ fontSize: '12px', opacity: .8, marginBottom: '4px' }}>
              {isMonthlyContract ? 'สัญญารายเดือน' : `${totalDays} วัน`}
            </div>
            <div style={{ fontSize: '36px', fontWeight: 900, letterSpacing: '-1px', marginBottom: '8px' }}>
              {isMonthlyContract
                ? `฿${Number(mMonthlyRate || 0).toLocaleString()}/เดือน`
                : `฿${totalAmount.toLocaleString()}`}
            </div>
            <div style={{ fontSize: '12px', opacity: .75 }}>
              {isMonthlyContract
                ? `จ่ายทุกวันที่ ${paymentDay} ของเดือน`
                : isLongRental
                  ? `${longResult?.months.length ?? 0} เดือน + ${longResult?.remainDays ?? 0} วัน • คิดตามสูตร`
                  : `฿${ndr.toLocaleString()}/วัน × ${shortResult?.calcDays ?? totalDays} วัน`
                    + (freeWeeks > 0 ? ` (ฟรี ${freeWeeks * 2} วัน)` : '')}
            </div>

            {/* Breakdown — long rental onetime */}
            {!isMonthlyContract && isLongRental && longResult && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,.2)' }}>
                {longResult.months.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ opacity: .8 }}>📅 เดือน {i + 1} ({m.days} วัน)</span>
                    <span style={{ fontWeight: 700 }}>฿{m.price.toLocaleString()}</span>
                  </div>
                ))}
                {longResult.remainDays > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ opacity: .8 }}>
                      📆 เศษ {longResult.remainDays} วัน (คิด {longResult.calcRemainDays} วัน × ฿{ndr})
                    </span>
                    <span style={{ fontWeight: 700 }}>฿{longResult.remainPrice.toLocaleString()}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ opacity: .8 }}>🎓 ส่วนลดนักศึกษา</span>
                    <span style={{ fontWeight: 700 }}>-฿{discount.toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', paddingTop: '8px', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,.2)' }}>
                  <span>รวมสุทธิ</span>
                  <span style={{ fontWeight: 900 }}>฿{totalAmount.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Breakdown — short rental */}
            {!isLongRental && shortResult && (freeWeeks > 0 || discount > 0) && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,.2)' }}>
                {freeWeeks > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ opacity: .8 }}>🎁 ฟรี {freeWeeks * 2} วัน ({freeWeeks} สัปดาห์ × 2 วัน)</span>
                    <span style={{ fontWeight: 700 }}>—</span>
                  </div>
                )}
                {discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '0' }}>
                    <span style={{ opacity: .8 }}>🎓 ลดนักศึกษา ({shortResult.calcDays} วัน × ฿50)</span>
                    <span style={{ fontWeight: 700 }}>-฿{discount.toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ④ Long rental: contract type choice */}
        {isLongRental && (
          <div style={{
            background: 'linear-gradient(135deg,#7c3aed,#111827)',
            borderRadius: '14px', padding: '16px', marginBottom: '12px', color: '#fff',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 800, marginBottom: '4px' }}>
              🗓️ เช่าระยะยาว — เลือกรูปแบบ
            </div>
            <div style={{ fontSize: '12px', opacity: .8, marginBottom: '14px' }}>
              เช่า {totalDays} วัน — ต้องการสัญญาแบบไหน?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {(['onetime', 'monthly'] as const).map(t => (
                <button key={t} onClick={() => setContractType(t)} style={{
                  border: `2px solid ${contractType === t ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.3)'}`,
                  borderRadius: '10px', padding: '12px 10px', textAlign: 'center', cursor: 'pointer',
                  background: contractType === t ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.1)',
                  color: '#fff', fontFamily: 'inherit',
                }}>
                  <div style={{ fontSize: '22px', marginBottom: '4px' }}>{t === 'onetime' ? '💳' : '📋'}</div>
                  <div style={{ fontSize: '12px', fontWeight: 800 }}>
                    {t === 'onetime' ? 'จ่ายครั้งเดียว' : 'สัญญารายเดือน'}
                  </div>
                  <div style={{ fontSize: '10px', opacity: .8, marginTop: '2px' }}>
                    {t === 'onetime' ? 'คิดตามสูตรปกติ' : 'จ่ายทุกเดือน'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ⑤ Monthly contract extra fields */}
        {isMonthlyContract && (
          <div className="card">
            <div className="card-title">รายละเอียดสัญญารายเดือน</div>
            <div className="field-row">
              <label className="field-label">ราคาต่อเดือน (บาท) *</label>
              <input className="field-input" type="number" placeholder="2590"
                value={mMonthlyRate} onChange={e => setMMonthlyRate(e.target.value)} />
            </div>
            <div className="field-row" style={{ marginBottom: 0 }}>
              <label className="field-label">ครบกำหนดชำระทุกวันที่</label>
              <div style={{
                background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '10px',
                padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <span style={{ fontSize: '20px' }}>📅</span>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#15803d' }}>วันที่ {paymentDay}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                    ของทุกเดือน — ตามวันเริ่มสัญญา
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Monthly: auto-lock notice */}
        {isMonthlyContract && (
          <div style={{
            background: '#f1f5f9', border: '1px solid #e5e7eb', borderRadius: '12px',
            padding: '12px 14px', marginBottom: '12px', fontSize: '13px', color: '#111827',
          }}>
            🔒 รถจะถูกล็อคอัตโนมัติ — ไม่ปรากฏในการค้นหาจนกว่าจะกด &quot;สิ้นสุดสัญญา&quot;
          </div>
        )}

        {/* ⑥ รูปภาพ */}
        <div className="card">
          <div className="card-title">รูปภาพ</div>
          <div className="field-row">
            <label className="field-label">📄 รูปบัตรประชาชน / พาสปอร์ต *</label>
            <PhotoUpload icon="🪪" hint="ถ่ายรูปหรืออัพโหลดบัตร" folder={folder}
              onUpload={handleIdCardUpload} onRemove={clearPhoto('id_card')} />
          </div>
          <div className="field-row">
            <label className="field-label">🤳 รูปคู่บัตรประชาชน *</label>
            <PhotoUpload icon="🤳" hint="ลูกค้าถือบัตรให้เห็นหน้า" folder={folder}
              onUpload={setPhoto('selfie')} onRemove={clearPhoto('selfie')} />
          </div>
          <div className="field-row">
            <label className="field-label">🛵 รูปคู่รถ *</label>
            <PhotoUpload icon="🛵" hint="ลูกค้ายืนคู่รถก่อนรับ" folder={folder}
              onUpload={setPhoto('with_bike')} onRemove={clearPhoto('with_bike')} />
          </div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">🔍 รูปตำหนิรถก่อนเช่า *</label>
            <PhotoUpload icon="📷" hint="ถ่ายรูปรอบคันก่อนส่ง" folder={folder}
              onUpload={setPhoto('damage')} onRemove={clearPhoto('damage')} />
          </div>
        </div>

        {/* ⑦ สภาพรถตอนส่ง */}
        <div className="card">
          <div className="card-title">สภาพรถตอนส่ง</div>
          <div className="field-row">
            <label className="field-label">เลขไมล์ตอนส่งรถ</label>
            <input className="field-input" type="number" placeholder="14230"
              value={odometer} onChange={e => setOdometer(e.target.value)} />
          </div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">ระดับน้ำมันตอนส่ง ({fuelLevel}/8)</label>
            <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} onClick={() => setFuelLevel(i + 1)} style={{
                  flex: 1, height: '30px', borderRadius: '4px', cursor: 'pointer',
                  background: i < fuelLevel ? '#16a34a' : '#e5e7eb', transition: 'background .1s',
                }} />
              ))}
            </div>
          </div>
        </div>

        {/* ⑧ การชำระเงิน */}
        <div className="card">
          <div className="card-title">การชำระเงิน</div>
          <div className="field-row">
            <label className="field-label">วิธีชำระ</label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              {(['cash', 'transfer'] as const).map(m => (
                <button key={m} onClick={() => setPaymentMethod(m)} style={{
                  padding: '7px 18px', borderRadius: '20px', border: '1.5px solid',
                  fontSize: '13px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
                  background: paymentMethod === m ? '#111827' : '#fff',
                  color: paymentMethod === m ? '#fff' : '#6b7280',
                  borderColor: paymentMethod === m ? '#111827' : '#e5e7eb',
                }}>
                  {m === 'cash' ? '💵 เงินสด' : '📱 สลิปโอน'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="field-row" style={{ marginBottom: 0 }}>
              <label className="field-label">เงินมัดจำ (฿)</label>
              <input className="field-input" type="number" placeholder="1000"
                value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
            </div>
            <div className="field-row" style={{ marginBottom: 0 }}>
              <label className="field-label">💳 หลักฐานการชำระ</label>
              <PhotoUpload
                icon={paymentMethod === 'cash' ? '💵' : '📱'}
                hint={paymentMethod === 'cash' ? 'ถ่ายรูปเงินสด' : 'อัพโหลดสลิป'}
                folder={folder}
                onUpload={setPhoto('payment')} onRemove={clearPhoto('payment')}
              />
            </div>
          </div>
        </div>

        {/* ⑨ ล็อครถ (daily / onetime only) */}
        {!isMonthlyContract && (
          <div className="card" id="lockSection">
            <div className="card-title">
              🔒 ต้องการล็อคผลการค้นหาหรือไม่{' '}
              <span style={{ color: '#dc2626' }}>*</span>
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
              กรุณาเลือกอย่างใดอย่างหนึ่ง — ถ้าไม่เลือกจะบันทึกไม่ได้
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button onClick={() => { setLockBike(true); setLockError(false) }} style={{
                border: `2px solid ${lockBike === true ? '#ef4444' : '#e5e7eb'}`,
                borderRadius: '12px', padding: '16px 10px', textAlign: 'center', cursor: 'pointer',
                background: lockBike === true ? '#fef2f2' : '#f9fafb',
                color: lockBike === true ? '#dc2626' : '#374151', fontFamily: 'inherit',
              }}>
                <div style={{ fontSize: '28px', marginBottom: '6px' }}>🔒</div>
                <div style={{ fontSize: '14px', fontWeight: 800 }}>ล็อครถ</div>
                <div style={{ fontSize: '11px', opacity: .65, marginTop: '4px', lineHeight: 1.4 }}>
                  ซ่อนจากการค้นหา<br />จนกว่าจะรับรถคืน
                </div>
              </button>
              <button onClick={() => { setLockBike(false); setLockError(false) }} style={{
                border: `2px solid ${lockBike === false ? '#22c55e' : '#e5e7eb'}`,
                borderRadius: '12px', padding: '16px 10px', textAlign: 'center', cursor: 'pointer',
                background: lockBike === false ? '#f0fdf4' : '#f9fafb',
                color: lockBike === false ? '#15803d' : '#374151', fontFamily: 'inherit',
              }}>
                <div style={{ fontSize: '28px', marginBottom: '6px' }}>🔓</div>
                <div style={{ fontSize: '14px', fontWeight: 800 }}>ไม่ล็อค</div>
                <div style={{ fontSize: '11px', opacity: .65, marginTop: '4px', lineHeight: 1.4 }}>
                  รถยังแสดงในระบบ<br />ตามปกติ
                </div>
              </button>
            </div>
            {lockError && (
              <div style={{
                marginTop: '10px', background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#dc2626',
              }}>
                ⚠️ กรุณาเลือกว่าต้องการล็อครถหรือไม่
              </div>
            )}
          </div>
        )}

        {/* ⑩ ลายเซ็นลูกค้า */}
        <div className="card">
          <div className="card-title">ลายเซ็นลูกค้า</div>
          {signature ? (
            <div style={{ position: 'relative' }}>
              <img src={signature} alt="ลายเซ็น" style={{ width: '100%', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff' }} />
              <button onClick={() => setShowSignPad(true)} style={{
                position: 'absolute', bottom: '8px', right: '8px',
                background: '#0ea5e9', color: '#fff', border: 'none',
                borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer',
              }}>
                เซ็นใหม่
              </button>
            </div>
          ) : (
            <div className="sign-area" onClick={() => setShowSignPad(true)} style={{ cursor: 'pointer' }}>
              ✏️ แตะเพื่อเซ็นชื่อ
            </div>
          )}
        </div>

        {showSignPad && (
          <SignaturePad onSave={handleSaveSignature} onClose={() => setShowSignPad(false)} />
        )}

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px',
            padding: '12px', color: '#dc2626', fontSize: '14px', marginBottom: '12px',
          }}>
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', padding: '16px', border: 'none', borderRadius: '14px',
            background: isMonthlyContract
              ? 'linear-gradient(135deg,#7c3aed,#111827)'
              : 'linear-gradient(135deg,#111827,#374151)',
            color: '#fff', fontSize: '16px', fontWeight: 800, cursor: 'pointer',
            opacity: loading ? 0.7 : 1, marginBottom: '24px', fontFamily: 'inherit',
            boxShadow: '0 4px 14px rgba(29,78,216,.3)',
          }}
        >
          {loading
            ? '⏳ กำลังบันทึก...'
            : isMonthlyContract
              ? '💾 บันทึกสัญญารายเดือน'
              : '💾 บันทึกการเช่า'}
        </button>

      </div>
    </div>
  )
}
