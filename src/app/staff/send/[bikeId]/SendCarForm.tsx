'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PhotoUpload from '@/components/PhotoUpload'

type Bike = {
  id: string
  license_plate: string
  brand: string
  model: string
  daily_rate: number
  deposit_amount: number
  odometer: number
}

type Promotion = {
  id: string
  code: string
  description: string | null
  discount_type: string
  discount_value: number
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

export default function SendCarForm({ bike, staffId, promotions }: Props) {
  const router = useRouter()

  const [rentalType, setRentalType] = useState<'day' | 'month'>('day')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerHotel, setCustomerHotel] = useState('')
  const [startDatetime, setStartDatetime] = useState(nowLocal())
  const [endDatetime, setEndDatetime] = useState(nowLocal(3 * 24 * 60 * 60 * 1000))
  const [odometer, setOdometer] = useState(String(bike.odometer ?? ''))
  const [fuelLevel, setFuelLevel] = useState(4)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash')
  const [depositAmount, setDepositAmount] = useState(String(bike.deposit_amount ?? 0))
  const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [photos, setPhotos] = useState<PhotoState>({
    id_card: '', selfie: '', with_bike: '', damage: '', payment: '',
  })

  const setPhoto = useCallback((key: keyof PhotoState) => (url: string) => {
    setPhotos(prev => ({ ...prev, [key]: url }))
  }, [])

  const clearPhoto = useCallback((key: keyof PhotoState) => () => {
    setPhotos(prev => ({ ...prev, [key]: '' }))
  }, [])

  // Price calculation
  const totalDays = startDatetime && endDatetime
    ? Math.max(1, Math.ceil((new Date(endDatetime).getTime() - new Date(startDatetime).getTime()) / 86_400_000))
    : 1

  const selectedPromo = promotions.find(p => p.id === selectedPromoId)
  const discount = selectedPromo
    ? selectedPromo.discount_type === 'percent'
      ? (bike.daily_rate * totalDays) * (selectedPromo.discount_value / 100)
      : selectedPromo.discount_value
    : 0
  const totalAmount = Math.max(0, bike.daily_rate * totalDays - discount)

  // Auto-fill customer by phone
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

  const handleSubmit = async () => {
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
          bikeId: bike.id,
          staffId,
          rentalType,
          customer: { name: customerName.trim(), phone: customerPhone.trim(), hotel: customerHotel.trim() },
          startDatetime,
          endDatetime,
          dailyRate: bike.daily_rate,
          totalDays,
          totalAmount,
          depositAmount: parseFloat(depositAmount) || 0,
          discount,
          paymentMethod,
          fuelLevel,
          odometer: odometer || '0',
          photos,
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

  const folder = `send/${bike.id}`

  return (
    <div className="app-wrap">

      {/* Header */}
      <div className="app-header">
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div>
          <h1>ส่งรถ — เช่ารถ</h1>
          <div className="sub">{bike.license_plate} {bike.brand} {bike.model}</div>
        </div>
      </div>

      {/* Lock banner */}
      <div style={{ background: '#fffbeb', borderLeft: '4px solid #d97706', padding: '10px 14px', fontSize: '13px', color: '#92400e', fontWeight: 600 }}>
        🔒 รถคันนี้ถูกล็อคสำหรับรายการนี้แล้ว
      </div>

      {/* Rental type toggle */}
      <div style={{ background: '#fff', padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '10px', padding: '4px', gap: '4px' }}>
          {(['day', 'month'] as const).map(t => (
            <button key={t} onClick={() => setRentalType(t)} style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: '8px',
              fontSize: '14px', fontWeight: 700, cursor: 'pointer',
              background: rentalType === t ? '#2563eb' : 'transparent',
              color: rentalType === t ? '#fff' : '#6b7280',
              transition: 'all .15s',
            }}>
              {t === 'day' ? '📅 รายวัน' : '🗓️ รายเดือน'}
            </button>
          ))}
        </div>
      </div>

      <div className="section-pad">

        {/* Customer info */}
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
            <PhotoUpload
              icon="🪪"
              hint="ถ่ายรูปหรืออัพโหลดบัตร"
              folder={folder}
              onUpload={setPhoto('id_card')}
              onRemove={clearPhoto('id_card')}
            />
          </div>
          <div className="field-row">
            <label className="field-label">🤳 รูปคู่บัตรประชาชน *</label>
            <PhotoUpload
              icon="🤳"
              hint="ลูกค้าถือบัตรให้เห็นหน้า"
              folder={folder}
              onUpload={setPhoto('selfie')}
              onRemove={clearPhoto('selfie')}
            />
          </div>
          <div className="field-row">
            <label className="field-label">🛵 รูปคู่รถ *</label>
            <PhotoUpload
              icon="🛵"
              hint="ลูกค้ายืนคู่รถก่อนรับ"
              folder={folder}
              onUpload={setPhoto('with_bike')}
              onRemove={clearPhoto('with_bike')}
            />
          </div>
          <div className="field-row">
            <label className="field-label">🔍 รูปตำหนิรถก่อนเช่า *</label>
            <PhotoUpload
              icon="📷"
              hint="ถ่ายรูปรอบคันก่อนส่ง"
              folder={folder}
              onUpload={setPhoto('damage')}
              onRemove={clearPhoto('damage')}
            />
          </div>
          {/* Payment proof */}
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
              onUpload={setPhoto('payment')}
              onRemove={clearPhoto('payment')}
            />
          </div>
        </div>

        {/* Rental details */}
        <div className="card">
          <div className="card-title">รายละเอียดการเช่า</div>
          <div className="field-row">
            <label className="field-label">วันที่เริ่มเช่า *</label>
            <input className="field-input" type="datetime-local"
              value={startDatetime}
              onChange={e => setStartDatetime(e.target.value)}
            />
          </div>
          <div className="field-row">
            <label className="field-label">วันที่กำหนดคืน *</label>
            <input className="field-input" type="datetime-local"
              value={endDatetime}
              onChange={e => setEndDatetime(e.target.value)}
            />
          </div>
          <div className="field-row">
            <label className="field-label">เลขไมล์ตอนส่งรถ</label>
            <input className="field-input" type="number" placeholder="14230"
              value={odometer}
              onChange={e => setOdometer(e.target.value)}
            />
          </div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">ระดับน้ำมันตอนส่ง ({fuelLevel}/8)</label>
            <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} onClick={() => setFuelLevel(i + 1)} style={{
                  flex: 1, height: '30px', borderRadius: '4px', cursor: 'pointer',
                  background: i < fuelLevel ? '#16a34a' : '#e5e7eb',
                  transition: 'background .1s',
                }} />
              ))}
            </div>
          </div>
        </div>

        {/* Promotions */}
        {promotions.length > 0 && (
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
              {promotions.map(p => (
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
              value={depositAmount}
              onChange={e => setDepositAmount(e.target.value)}
            />
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

        {/* Signature placeholder */}
        <div className="card">
          <div className="card-title">ลายเซ็นลูกค้า</div>
          <div className="sign-area">✏️ แตะเพื่อเซ็นชื่อ</div>
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
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={loading}
          style={{ width: '100%', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? '⏳ กำลังบันทึก...' : '💾 บันทึกการเช่า'}
        </button>

      </div>
    </div>
  )
}
