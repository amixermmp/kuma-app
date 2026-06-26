'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import PhotoUpload from '@/components/PhotoUpload'
import SignaturePad from '@/components/SignaturePad'

// ── Success screen ───────────────────────────────────────────
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
        <Link href={invoiceHref} style={{
          display: 'block', width: '100%', background: '#1e3a8a', color: '#fff',
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

type Promotion = {
  id: string
  code: string
  description: string | null
  discount_type: string
  discount_value: number
  eligible_bike_ids: string[] | null
}

type Props = {
  bike: Bike
  staffId: string
  promotions: Promotion[]
}

type PhotoState = {
  id_card: string
  selfie: string
  with_bike: string
  damage: string
  payment: string
}

function nowLocal(offsetMs = 0) {
  const d = new Date(Date.now() + offsetMs)
  d.setSeconds(0, 0)
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function todayLocal() {
  const d = new Date()
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function SendCarForm({ bike, staffId, promotions }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const preFrom = searchParams.get('from')
  const preTo = searchParams.get('to')

  const [rentalType, setRentalType] = useState<'day' | 'month'>('day')

  // ── Daily rental state ──────────────────────────────────────
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerHotel, setCustomerHotel] = useState('')
  const [startDatetime, setStartDatetime] = useState(preFrom ?? nowLocal())
  const [endDatetime, setEndDatetime] = useState(preTo ?? nowLocal(3 * 24 * 60 * 60 * 1000))
  const [odometer, setOdometer] = useState(String(bike.odometer ?? ''))
  const [fuelLevel, setFuelLevel] = useState(4)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash')
  const [depositAmount, setDepositAmount] = useState(String(bike.deposit_amount ?? 0))
  const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null)
  const [photos, setPhotos] = useState<PhotoState>({ id_card: '', selfie: '', with_bike: '', damage: '', payment: '' })

  // ── Monthly rental state ────────────────────────────────────
  const [mName, setMName] = useState('')
  const [mPhone, setMPhone] = useState('')
  const [mAddress, setMAddress] = useState('')
  const [mStartDate, setMStartDate] = useState(todayLocal())
  const [mPaymentDay, setMPaymentDay] = useState(new Date().getDate())
  const [mMonthlyRate, setMMonthlyRate] = useState(String(bike.monthly_rate ?? ''))
  const [mDeposit, setMDeposit] = useState(String(bike.deposit_amount ?? 0))
  const [mOdometer, setMOdometer] = useState(String(bike.odometer ?? ''))
  const [mFuelLevel, setMFuelLevel] = useState(4)
  const [mPaymentMethod, setMPaymentMethod] = useState<'cash' | 'transfer'>('cash')
  const [mPhotos, setMPhotos] = useState<PhotoState>({ id_card: '', selfie: '', with_bike: '', damage: '', payment: '' })

  const [signature, setSignature] = useState<string | null>(null)
  const [showSignPad, setShowSignPad] = useState(false)
  const [mSignature, setMSignature] = useState<string | null>(null)
  const [showMSignPad, setShowMSignPad] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdRentalId, setCreatedRentalId] = useState<string | null>(null)
  const [createdType, setCreatedType] = useState<'daily' | 'monthly'>('daily')

  const folder = `send/${bike.id}`

  const setPhoto = useCallback((key: keyof PhotoState) => (url: string) => {
    setPhotos(prev => ({ ...prev, [key]: url }))
  }, [])
  const clearPhoto = useCallback((key: keyof PhotoState) => () => {
    setPhotos(prev => ({ ...prev, [key]: '' }))
  }, [])

  const setMPhoto = useCallback((key: keyof PhotoState) => (url: string) => {
    setMPhotos(prev => ({ ...prev, [key]: url }))
  }, [])
  const clearMPhoto = useCallback((key: keyof PhotoState) => () => {
    setMPhotos(prev => ({ ...prev, [key]: '' }))
  }, [])

  // ── Daily calculations ──────────────────────────────────────
  const totalDays = startDatetime && endDatetime
    ? Math.max(1, Math.ceil((new Date(endDatetime).getTime() - new Date(startDatetime).getTime()) / 86_400_000))
    : 1
  // กรองเฉพาะโปรที่รถคันนี้ร่วมรายการ (eligible_bike_ids = null หมายถึงทุกคัน)
  const eligiblePromos = promotions.filter(p =>
    !p.eligible_bike_ids || p.eligible_bike_ids.includes(bike.id)
  )
  const selectedPromo = eligiblePromos.find(p => p.id === selectedPromoId)
  const discount = selectedPromo
    ? selectedPromo.discount_type === 'percent'
      ? (bike.daily_rate * totalDays) * (selectedPromo.discount_value / 100)
      : selectedPromo.discount_value
    : 0
  const totalAmount = Math.max(0, bike.daily_rate * totalDays - discount)

  // ── Customer lookup (shared) ────────────────────────────────
  const lookupCustomer = useCallback(async (phone: string, isMonthly = false) => {
    if (phone.replace(/\D/g, '').length < 9) return
    try {
      const res = await fetch(`/api/staff/customer/lookup?phone=${encodeURIComponent(phone)}`)
      const { customer } = await res.json()
      if (customer) {
        if (isMonthly) {
          setMName(customer.name)
          setMAddress(customer.workplace ?? '')
        } else {
          setCustomerName(customer.name)
          setCustomerHotel(customer.workplace ?? '')
        }
      }
    } catch { /* silent */ }
  }, [])

  // ── Payment day options for monthly ────────────────────────
  const startDay = new Date(mStartDate).getDate()
  const payDayOptions = [1, 5, 10, 15, startDay].filter((v, i, arr) => arr.indexOf(v) === i).sort((a, b) => a - b)

  // ── Submit handlers ─────────────────────────────────────────
  const handleDaySubmit = async () => {
    if (!customerName.trim()) { setError('กรุณาใส่ชื่อลูกค้า'); return }
    if (!customerPhone.trim()) { setError('กรุณาใส่เบอร์โทร'); return }
    if (new Date(endDatetime) <= new Date(startDatetime)) { setError('วันคืนต้องหลังวันเช่า'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/staff/rental/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bikeId: bike.id, staffId, rentalType: 'day',
          customer: { name: customerName.trim(), phone: customerPhone.trim(), hotel: customerHotel.trim() },
          startDatetime, endDatetime, dailyRate: bike.daily_rate, totalDays, totalAmount,
          depositAmount: parseFloat(depositAmount) || 0, discount, paymentMethod, fuelLevel,
          odometer: odometer || '0', photos,
          signature: signature ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      setCreatedType('daily')
      setCreatedRentalId(data.rentalId ?? data.id ?? null)
    } catch {
      setError('เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  const handleMonthlySubmit = async () => {
    if (!mName.trim()) { setError('กรุณาใส่ชื่อลูกค้า'); return }
    if (!mPhone.trim()) { setError('กรุณาใส่เบอร์โทร'); return }
    if (!mMonthlyRate || parseFloat(mMonthlyRate) <= 0) { setError('กรุณาใส่ราคาเช่าต่อเดือน'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/staff/monthly/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bikeId: bike.id, staffId,
          customer: { name: mName.trim(), phone: mPhone.trim(), address: mAddress.trim() },
          startDate: mStartDate,
          paymentDay: mPaymentDay,
          monthlyRate: parseFloat(mMonthlyRate),
          depositAmount: parseFloat(mDeposit) || 0,
          odometer: mOdometer || '0',
          fuelLevel: mFuelLevel,
          paymentMethod: mPaymentMethod,
          photos: mPhotos,
          signature: mSignature ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      setCreatedType('monthly')
      setCreatedRentalId(data.rentalId ?? data.id ?? null)
    } catch {
      setError('เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  // Show success screen after rental created
  if (createdRentalId) {
    return <SuccessScreen rentalId={createdRentalId} type={createdType} bikeId={bike.id} />
  }

  const isMonthly = rentalType === 'month'

  return (
    <div className="app-wrap">

      {/* Header */}
      <div className="app-header" style={{ background: isMonthly ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : undefined }}>
        <Link href={`/staff/bikes/${bike.id}/menu`} className="app-header-back">←</Link>
        <div>
          <h1>ส่งรถ — {isMonthly ? 'รายเดือน' : 'รายวัน'}</h1>
          <div className="sub">{bike.license_plate} {bike.brand} {bike.model}</div>
        </div>
      </div>

      {/* Lock banner */}
      {isMonthly ? (
        <div style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', padding: '10px 14px' }}>
          <div style={{ background: 'rgba(255,255,255,.15)', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            🔒 รถจะถูกล็อคจนกว่าจะ &quot;สิ้นสุดสัญญา&quot; — ไม่มีวันคืนรถอัตโนมัติ
          </div>
        </div>
      ) : (
        <div style={{ background: '#fffbeb', borderLeft: '4px solid #d97706', padding: '10px 14px', fontSize: '13px', color: '#92400e', fontWeight: 600 }}>
          🔒 รถคันนี้ถูกล็อคสำหรับรายการนี้แล้ว
        </div>
      )}

      {/* Rental type toggle */}
      <div style={{ background: '#fff', padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '10px', padding: '4px', gap: '4px' }}>
          {(['day', 'month'] as const).map(t => (
            <button key={t} onClick={() => { setRentalType(t); setError('') }} style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: '8px',
              fontSize: '14px', fontWeight: 700, cursor: 'pointer',
              background: rentalType === t ? (t === 'month' ? '#7c3aed' : '#2563eb') : 'transparent',
              color: rentalType === t ? '#fff' : '#6b7280',
              transition: 'all .15s',
            }}>
              {t === 'day' ? '📅 รายวัน' : '🗓️ รายเดือน'}
            </button>
          ))}
        </div>
      </div>

      <div className="section-pad">

        {/* ══════════════════════════════════════════════
            DAILY FORM
            ══════════════════════════════════════════════ */}
        {!isMonthly && (<>

          {/* Customer */}
          <div className="card">
            <div className="card-title">ข้อมูลลูกค้า</div>
            <div className="field-row">
              <label className="field-label">เบอร์โทรศัพท์ *</label>
              <input className="field-input" type="tel" placeholder="081-234-5678"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                onBlur={e => lookupCustomer(e.target.value, false)}
              />
            </div>
            <div className="field-row">
              <label className="field-label">ชื่อ - นามสกุล *</label>
              <input className="field-input" type="text" placeholder="สมชาย ดีใจ"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
              />
            </div>
            <div className="field-row">
              <label className="field-label">โรงแรม / ที่พัก</label>
              <input className="field-input" type="text" placeholder="Nap Park Hotel"
                value={customerHotel}
                onChange={e => setCustomerHotel(e.target.value)}
              />
            </div>
          </div>

          {/* Photos */}
          <div className="card">
            <div className="card-title">รูปภาพ</div>
            <div className="field-row">
              <label className="field-label">📄 รูปบัตรประชาชน / พาสปอร์ต *</label>
              <PhotoUpload icon="🪪" hint="ถ่ายรูปหรืออัพโหลดบัตร" folder={folder}
                onUpload={setPhoto('id_card')} onRemove={clearPhoto('id_card')} />
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
            <div className="field-row">
              <label className="field-label">🔍 รูปตำหนิรถก่อนเช่า *</label>
              <PhotoUpload icon="📷" hint="ถ่ายรูปรอบคันก่อนส่ง" folder={folder}
                onUpload={setPhoto('damage')} onRemove={clearPhoto('damage')} />
            </div>
            <div className="field-row" style={{ marginBottom: 0 }}>
              <label className="field-label">💳 หลักฐานการชำระเงิน *</label>
              <div style={{ display: 'flex', gap: '8px', margin: '6px 0 8px' }}>
                {(['cash', 'transfer'] as const).map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m)} style={{
                    padding: '6px 16px', borderRadius: '20px', border: '1.5px solid',
                    fontSize: '13px', cursor: 'pointer', fontWeight: 600,
                    background: paymentMethod === m ? '#2563eb' : '#fff',
                    color: paymentMethod === m ? '#fff' : '#6b7280',
                    borderColor: paymentMethod === m ? '#2563eb' : '#e5e7eb',
                  }}>
                    {m === 'cash' ? '💵 เงินสด' : '📱 สลิปโอน'}
                  </button>
                ))}
              </div>
              <PhotoUpload
                icon={paymentMethod === 'cash' ? '💵' : '📱'}
                hint={paymentMethod === 'cash' ? 'ถ่ายรูปเงินสด' : 'อัพโหลดสลิปโอน'}
                folder={folder}
                onUpload={setPhoto('payment')} onRemove={clearPhoto('payment')}
              />
            </div>
          </div>

          {/* Rental details */}
          <div className="card">
            <div className="card-title">รายละเอียดการเช่า</div>
            <div className="field-row">
              <label className="field-label">วันที่เริ่มเช่า *</label>
              <input className="field-input" type="datetime-local"
                value={startDatetime} onChange={e => setStartDatetime(e.target.value)} />
            </div>
            <div className="field-row">
              <label className="field-label">วันที่กำหนดคืน *</label>
              <input className="field-input" type="datetime-local"
                value={endDatetime} onChange={e => setEndDatetime(e.target.value)} />
            </div>
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

          {/* Promotions */}
          {eligiblePromos.length > 0 && (
            <div className="card">
              <div className="card-title">โปรโมชั่น</div>
              <label className="field-label">เลือกโปรโมชั่น (ถ้ามี)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                <button onClick={() => setSelectedPromoId(null)} style={{
                  padding: '6px 16px', borderRadius: '20px', border: '1.5px solid',
                  fontSize: '13px', cursor: 'pointer', fontWeight: 600,
                  background: !selectedPromoId ? '#2563eb' : '#fff',
                  color: !selectedPromoId ? '#fff' : '#6b7280',
                  borderColor: !selectedPromoId ? '#2563eb' : '#e5e7eb',
                }}>ราคาปกติ</button>
                {eligiblePromos.map(p => (
                  <button key={p.id} onClick={() => setSelectedPromoId(p.id)} style={{
                    padding: '6px 16px', borderRadius: '20px', border: '1.5px solid',
                    fontSize: '13px', cursor: 'pointer', fontWeight: 600,
                    background: selectedPromoId === p.id ? '#2563eb' : '#fff',
                    color: selectedPromoId === p.id ? '#fff' : '#6b7280',
                    borderColor: selectedPromoId === p.id ? '#2563eb' : '#e5e7eb',
                  }}>{p.description ?? p.code}</button>
                ))}
              </div>
            </div>
          )}

          {/* Deposit */}
          <div className="card">
            <div className="card-title">เงินมัดจำ</div>
            <div className="field-row" style={{ marginBottom: 0 }}>
              <label className="field-label">ยอดเงินมัดจำ (บาท)</label>
              <input className="field-input" type="number" placeholder="1000"
                value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
            </div>
          </div>

          {/* Price summary */}
          <div className="price-box">
            <div className="price-label">ค่าเช่าทั้งหมด ({totalDays} วัน)</div>
            <div className="price-amount">฿{totalAmount.toLocaleString()}</div>
            <div className="price-detail">
              ฿{bike.daily_rate.toLocaleString()}/วัน × {totalDays} วัน
              {discount > 0 ? ` • ลด ฿${discount.toLocaleString()}` : ' • ไม่มีโปรโมชั่น'}
            </div>
          </div>

          <div className="card">
            <div className="card-title">ลายเซ็นลูกค้า</div>
            {signature ? (
              <div style={{ position: 'relative' }}>
                <img src={signature} alt="ลายเซ็น" style={{ width: '100%', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff' }} />
                <button onClick={() => setShowSignPad(true)} style={{ position: 'absolute', bottom: '8px', right: '8px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
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
            <SignaturePad onSave={setSignature} onClose={() => setShowSignPad(false)} />
          )}

          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', color: '#dc2626', fontSize: '14px', marginBottom: '12px' }}>⚠️ {error}</div>}

          <button className="btn btn-primary" onClick={handleDaySubmit} disabled={loading}
            style={{ width: '100%', opacity: loading ? 0.7 : 1 }}>
            {loading ? '⏳ กำลังบันทึก...' : '💾 บันทึกการเช่า'}
          </button>

        </>)}

        {/* ══════════════════════════════════════════════
            MONTHLY FORM
            ══════════════════════════════════════════════ */}
        {isMonthly && (<>

          {/* Customer */}
          <div className="card">
            <div className="card-title">ข้อมูลลูกค้า</div>
            <div className="field-row">
              <label className="field-label">ชื่อ - นามสกุล *</label>
              <input className="field-input" type="text" placeholder="สมชาย ดีใจ"
                value={mName} onChange={e => setMName(e.target.value)} />
            </div>
            <div className="field-row">
              <label className="field-label">เบอร์โทรศัพท์ *</label>
              <input className="field-input" type="tel" placeholder="081-234-5678"
                value={mPhone}
                onChange={e => setMPhone(e.target.value)}
                onBlur={e => lookupCustomer(e.target.value, true)}
              />
            </div>
            <div className="field-row" style={{ marginBottom: 0 }}>
              <label className="field-label">ที่พัก / ที่อยู่ปัจจุบัน</label>
              <input className="field-input" type="text" placeholder="คอนโด ริมทะเล ห้อง 203"
                value={mAddress} onChange={e => setMAddress(e.target.value)} />
            </div>
          </div>

          {/* Photos */}
          <div className="card">
            <div className="card-title">รูปภาพ</div>
            <div className="field-row">
              <label className="field-label">📄 รูปบัตรประชาชน / พาสปอร์ต *</label>
              <PhotoUpload icon="🪪" hint="ถ่ายรูปหรืออัพโหลดบัตร" folder={folder}
                onUpload={setMPhoto('id_card')} onRemove={clearMPhoto('id_card')} />
            </div>
            <div className="field-row">
              <label className="field-label">🤳 รูปคู่บัตรประชาชน * <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 400 }}>(ลูกค้าถือบัตรให้เห็นหน้า)</span></label>
              <PhotoUpload icon="🤳" hint="ถ่ายรูปลูกค้าถือบัตร" folder={folder}
                onUpload={setMPhoto('selfie')} onRemove={clearMPhoto('selfie')} />
            </div>
            <div className="field-row">
              <label className="field-label">🛵 รูปคู่รถ * <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 400 }}>(ลูกค้ายืนคู่รถก่อนรับ)</span></label>
              <PhotoUpload icon="🛵" hint="ถ่ายรูปลูกค้าคู่รถ" folder={folder}
                onUpload={setMPhoto('with_bike')} onRemove={clearMPhoto('with_bike')} />
            </div>
            <div className="field-row">
              <label className="field-label">🔍 รูปตำหนิรถก่อนเช่า *</label>
              <PhotoUpload icon="📷" hint="ถ่ายรูปรถ" folder={folder}
                onUpload={setMPhoto('damage')} onRemove={clearMPhoto('damage')} />
            </div>
            <div className="field-row" style={{ marginBottom: 0 }}>
              <label className="field-label">💳 หลักฐานการชำระเงิน *</label>
              <div style={{ display: 'flex', gap: '8px', margin: '6px 0 8px' }}>
                {(['cash', 'transfer'] as const).map(m => (
                  <button key={m} onClick={() => setMPaymentMethod(m)} style={{
                    padding: '6px 16px', borderRadius: '20px', border: '1.5px solid',
                    fontSize: '13px', cursor: 'pointer', fontWeight: 600,
                    background: mPaymentMethod === m ? '#7c3aed' : '#fff',
                    color: mPaymentMethod === m ? '#fff' : '#6b7280',
                    borderColor: mPaymentMethod === m ? '#7c3aed' : '#e5e7eb',
                  }}>
                    {m === 'cash' ? '💵 เงินสด' : '📱 สลิปโอน'}
                  </button>
                ))}
              </div>
              <PhotoUpload
                icon={mPaymentMethod === 'cash' ? '💵' : '📱'}
                hint={mPaymentMethod === 'cash' ? 'ถ่ายรูปเงินสด / อัพโหลดสลิป' : 'อัพโหลดสลิปโอน'}
                folder={folder}
                onUpload={setMPhoto('payment')} onRemove={clearMPhoto('payment')}
              />
            </div>
          </div>

          {/* Contract details */}
          <div className="card">
            <div className="card-title">รายละเอียดสัญญารายเดือน</div>
            <div className="field-row">
              <label className="field-label">วันเริ่มสัญญา *</label>
              <input className="field-input" type="date"
                value={mStartDate}
                onChange={e => {
                  setMStartDate(e.target.value)
                  const day = new Date(e.target.value).getDate()
                  setMPaymentDay(day)
                }}
              />
            </div>
            <div className="field-row">
              <label className="field-label">ครบกำหนดชำระทุกวันที่ *</label>
              <select className="field-input"
                value={mPaymentDay}
                onChange={e => setMPaymentDay(Number(e.target.value))}
              >
                {payDayOptions.map(d => (
                  <option key={d} value={d}>
                    {d} ของทุกเดือน{d === startDay ? ' (วันเริ่มสัญญา)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-row">
              <label className="field-label">ราคาเช่าต่อเดือน (บาท) *</label>
              <input className="field-input" type="number" placeholder="3500"
                value={mMonthlyRate} onChange={e => setMMonthlyRate(e.target.value)} />
            </div>
            <div className="field-row">
              <label className="field-label">เงินมัดจำ (บาท)</label>
              <input className="field-input" type="number" placeholder="3500"
                value={mDeposit} onChange={e => setMDeposit(e.target.value)} />
            </div>
            <div className="field-row">
              <label className="field-label">เลขไมล์ตอนส่งรถ</label>
              <input className="field-input" type="number" placeholder="14230"
                value={mOdometer} onChange={e => setMOdometer(e.target.value)} />
            </div>
            <div className="field-row" style={{ marginBottom: 0 }}>
              <label className="field-label">ระดับน้ำมันตอนส่ง ({mFuelLevel}/8)</label>
              <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} onClick={() => setMFuelLevel(i + 1)} style={{
                    flex: 1, height: '30px', borderRadius: '4px', cursor: 'pointer',
                    background: i < mFuelLevel ? '#7c3aed' : '#e5e7eb', transition: 'background .1s',
                  }} />
                ))}
              </div>
            </div>
          </div>

          {/* Price summary */}
          <div className="price-box" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
            <div className="price-label">ค่าเช่าต่อเดือน</div>
            <div className="price-amount">
              {mMonthlyRate ? `฿${Number(mMonthlyRate).toLocaleString()}` : '฿—'}
            </div>
            <div className="price-detail">
              ครบกำหนดชำระทุกวันที่ {mPaymentDay} ของเดือน
            </div>
          </div>

          <div style={{ background: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: '10px', padding: '12px 14px', marginBottom: '12px', fontSize: '13px', color: '#6d28d9' }}>
            📌 ระบบจะสร้าง <strong>Job Task เก็บค่าเช่า 💰</strong> อัตโนมัติทุกเดือน และรถจะ <strong>ไม่ปรากฏในการค้นหา</strong> จนกว่าจะกด &quot;สิ้นสุดสัญญา&quot;
          </div>

          <div className="card">
            <div className="card-title">ลายเซ็นลูกค้า</div>
            {mSignature ? (
              <div style={{ position: 'relative' }}>
                <img src={mSignature} alt="ลายเซ็น" style={{ width: '100%', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff' }} />
                <button onClick={() => setShowMSignPad(true)} style={{ position: 'absolute', bottom: '8px', right: '8px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                  เซ็นใหม่
                </button>
              </div>
            ) : (
              <div className="sign-area" onClick={() => setShowMSignPad(true)} style={{ cursor: 'pointer' }}>
                ✏️ แตะเพื่อเซ็นชื่อ
              </div>
            )}
          </div>

          {showMSignPad && (
            <SignaturePad onSave={setMSignature} onClose={() => setShowMSignPad(false)} />
          )}

          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', color: '#dc2626', fontSize: '14px', marginBottom: '12px' }}>⚠️ {error}</div>}

          <button
            onClick={handleMonthlySubmit}
            disabled={loading}
            style={{
              width: '100%', padding: '16px', border: 'none', borderRadius: '12px',
              background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff',
              fontSize: '16px', fontWeight: 700, cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '⏳ กำลังบันทึก...' : '💾 บันทึกสัญญารายเดือน'}
          </button>

        </>)}

      </div>
    </div>
  )
}
