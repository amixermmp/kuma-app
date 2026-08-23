'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { bangkokToUTC } from '@/lib/time'
import { calcRentQuote, calendarDays, calcExcessHours, calcOvertimeCharge } from '@/lib/pricing'
import { Bike as BikeIcon, Home, Send, CalendarCheck } from 'lucide-react'

type Props = {
  brand: string
  model: string
  dailyRate: number
  monthlyRate: number
  from: string
  to: string
  staffId: string
  promoPayDays?: number
}

const SOURCES = [
  { key: 'line',     label: '💬 LINE' },
  { key: 'facebook', label: '📘 Facebook' },
  { key: 'phone',    label: '📱 โทรศัพท์' },
  { key: 'walkin',   label: '🚶 Walk-in' },
]

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short',
  })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function BookingModelForm({ brand, model, dailyRate, monthlyRate, from, to, staffId, promoPayDays = 5 }: Props) {
  const router = useRouter()

  const [customerName, setCustomerName]   = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [source, setSource]               = useState('line')
  const [deliveryType, setDeliveryType]   = useState<'shop' | 'offsite'>('shop')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [notes, setNotes]                 = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')

  // ใช้ตารางคิดเงินกลางตัวเดียวกับหน้าส่งรถ (โปร 7 วันจ่าย 5 + cap รายเดือน)
  const totalDays   = calendarDays(new Date(from), new Date(to))
  const quote       = calcRentQuote(new Date(from), totalDays, dailyRate, monthlyRate, promoPayDays)
  // เศษชั่วโมงเกินขอบเขตวันที่คิดราคาไปแล้ว — รวมเข้าราคาที่เสนอลูกค้าเลย
  const excessHours = totalDays > 0 ? calcExcessHours(new Date(from), new Date(to), totalDays) : 0
  const overtimeEstimate = calcOvertimeCharge(excessHours, dailyRate)
  const totalAmount = quote.total + overtimeEstimate

  const lookupCustomer = useCallback(async (phone: string) => {
    if (phone.replace(/\D/g, '').length < 9) return
    try {
      const res = await fetch(`/api/staff/customer/lookup?phone=${encodeURIComponent(phone)}`)
      const { customer } = await res.json()
      if (customer) {
        setCustomerName(customer.name)
      }
    } catch { /* silent */ }
  }, [])

  // ล็อคกันกดซ้อน (สองแตะบนมือถือ/เน็ตช้าแล้วกดซ้ำ) — ใช้ ref เพราะ React state
  // อัพเดตแบบ async ทำให้ setLoading(true) เพียงอย่างเดียวกันไม่ทันในบางเคส
  const submittingRef = useRef(false)

  const handleSubmit = async () => {
    if (submittingRef.current) return
    if (!customerName.trim())  { setError('กรุณาใส่ชื่อลูกค้า'); return }
    if (!customerPhone.trim()) { setError('กรุณาใส่เบอร์โทร'); return }
    if (deliveryType === 'offsite' && !deliveryAddress.trim()) { setError('กรุณาใส่สถานที่ส่งรถ'); return }
    submittingRef.current = true
    setLoading(true); setError('')
    try {
      const sendBookingPayload = (overrideConflict: boolean) => fetch('/api/staff/booking/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId,
          requestedBrand: brand,
          requestedModel: model,
          requestedDailyRate: dailyRate,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          startDatetime: bangkokToUTC(from),
          endDatetime: bangkokToUTC(to),
          totalDays,
          dailyRate,
          totalAmount,
          discount: 0,
          source,
          deliveryType,
          deliveryAddress: deliveryType === 'offsite' ? deliveryAddress.trim() : null,
          notes: notes.trim() || null,
          overrideConflict,
        }),
      })
      let res = await sendBookingPayload(false)
      let data = await res.json()
      // รุ่นนี้ไม่ว่างพอในช่วงเวลานี้ — เสนอ Fast lane ให้จองไว้ก่อนได้ (ไม่ยกเลิกคิวเดิม จะไปโผล่คิวมีปัญหาแทน)
      if (!res.ok && data.conflict) {
        const ok = confirm(`⚡ ${data.error}\n\nยืนยันใช้ Fast lane จองไว้ก่อนไหม?`)
        if (!ok) { return }
        res = await sendBookingPayload(true)
        data = await res.json()
      }
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      router.push(`/staff/booking/${data.bookingId}/confirm`)
    } catch {
      setError('เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      submittingRef.current = false
      setLoading(false)
    }
  }

  return (
    <div className="app-wrap">

      <div className="app-header" style={{ background: '#111' }}>
        <Link href="/staff/search" className="app-header-back">←</Link>
        <div>
          <h1>จองคิว</h1>
          <div className="sub">กรอกข้อมูลผู้จอง</div>
        </div>
      </div>

      <div className="section-pad">

        {/* Bike model card */}
        <div style={{
          background: '#111',
          borderRadius: '14px', padding: '14px 16px', marginBottom: '12px',
          color: '#fff', display: 'flex', alignItems: 'center', gap: '14px',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
            background: '#e5231b', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BikeIcon size={24} color="#fff" strokeWidth={1.75} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '17px', fontWeight: 800 }}>{brand} {model}</div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '3px' }}>
              {fmtDateShort(from)} {fmtTime(from)} → {fmtDateShort(to)} {fmtTime(to)}
            </div>
            <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(255,255,255,.2)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
                {totalDays} วัน
              </span>
              <span style={{ background: 'rgba(22,163,74,.35)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
                ฿{totalAmount.toLocaleString()}
                {!quote.isLong && quote.shortResult && quote.shortResult.calcDays < totalDays
                  ? ` (คิด ${quote.shortResult.calcDays} วัน)` : ''}
              </span>
              {overtimeEstimate > 0 && (
                <span style={{ background: 'rgba(217,119,6,.35)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
                  ⏱ รวมล่วงเวลา {excessHours} ชม. (+฿{overtimeEstimate.toLocaleString()})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Note about bike assignment */}
        <div style={{
          background: '#f1f5f9', border: '1px solid #e5e7eb', borderRadius: '10px',
          padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: '#374151',
        }}>
          📋 รถคันที่ใช้จริงจะถูกกำหนดโดย Staff ก่อนส่งรถ
        </div>

        {/* Customer */}
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
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">ชื่อ - นามสกุล *</label>
            <input className="field-input" type="text" placeholder="สมชาย ดีใจ"
              value={customerName} onChange={e => setCustomerName(e.target.value)} />
          </div>
        </div>

        {/* Delivery */}
        <div className="card">
          <div className="card-title">วิธีรับรถ</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setDeliveryType('shop')} style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              border: `2px solid ${deliveryType === 'shop' ? '#e5231b' : '#e5e7eb'}`,
              background: deliveryType === 'shop' ? 'rgba(229,35,27,.08)' : '#fff',
              color: deliveryType === 'shop' ? '#e5231b' : '#6b7280',
              fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}><Home size={16} strokeWidth={1.75} /> รับหน้าร้าน</button>
            <button onClick={() => setDeliveryType('offsite')} style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              border: `2px solid ${deliveryType === 'offsite' ? '#e5231b' : '#e5e7eb'}`,
              background: deliveryType === 'offsite' ? 'rgba(229,35,27,.08)' : '#fff',
              color: deliveryType === 'offsite' ? '#e5231b' : '#6b7280',
              fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}><Send size={16} strokeWidth={1.75} /> ส่งนอกสถานที่</button>
          </div>
          {deliveryType === 'offsite' && (
            <textarea className="field-input" rows={2}
              placeholder="เช่น โรงแรม ABC ห้อง 203 หรือปักหมุด/ลิงก์แผนที่"
              value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
              style={{ marginTop: '10px', resize: 'none' }}
            />
          )}
        </div>

        {/* Source */}
        <div className="card">
          <div className="card-title">ช่องทางที่ลูกค้าติดต่อมา</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {SOURCES.map(s => (
              <button key={s.key} onClick={() => setSource(s.key)} style={{
                padding: '8px 16px', borderRadius: '20px', border: '1.5px solid',
                fontSize: '13px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
                background: source === s.key ? '#111' : '#fff',
                color: source === s.key ? '#fff' : '#6b7280',
                borderColor: source === s.key ? '#111' : '#e5e7eb',
              }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <div className="card-title">หมายเหตุ</div>
          <textarea className="field-input" rows={2}
            placeholder="เช่น ลูกค้าขอรถสีแดง, ต้องการ GPS..."
            value={notes} onChange={e => setNotes(e.target.value)}
            style={{ resize: 'none' }}
          />
        </div>

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
            width: '100%', padding: '16px', border: 'none', borderRadius: '12px',
            background: '#e5231b', color: '#fff', fontSize: '16px', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            opacity: loading ? 0.7 : 1, marginBottom: '24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          {loading ? 'กำลังบันทึก...' : <><CalendarCheck size={18} strokeWidth={2} /> ยืนยันการจอง</>}
        </button>

      </div>
    </div>
  )
}
