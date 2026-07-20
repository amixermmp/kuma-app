'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { calcRentQuote } from '@/lib/pricing'

type Bike = { id: string; license_plate: string; brand: string; model: string; odometer: number; daily_rate: number; monthly_rate: number | null }
type Customer = { id: string; name: string; phone: string }

type MonthlyRental = {
  id: string
  start_date: string
  payment_day: number
  monthly_rate: number
  deposit_amount: number
  bikes: Bike
  customers: Customer
}

type Props = {
  rental: MonthlyRental
  totalCollected: number
  monthsRented: number
  periodStart: string
  periodEnd: string | null
  periodPaidAmount: number
  staffId: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function MonthlyEndClient({ rental, totalCollected, monthsRented, periodStart, periodEnd, periodPaidAmount }: Props) {
  const router = useRouter()
  const bike = rental.bikes
  const customer = rental.customers

  // คืนรถก่อนครบงวดที่จ่ายไปแล้ว — คิดค่าเช่าใหม่ตามวันที่ใช้จริงในงวดนี้ด้วยเรทรายวันปกติของรถ
  // (ไม่ใช้เรทรายเดือนที่ตกลงไว้ตอนทำสัญญา) แล้วคืนส่วนต่างจากที่จ่ายไปแล้วสำหรับงวดนี้
  const now = Date.now()
  const periodEndMs = periodEnd ? new Date(`${periodEnd}T23:59:59+07:00`).getTime() : null
  const isEarly = periodEndMs != null && now < periodEndMs - 3_600_000
  const periodStartMs = new Date(`${periodStart}T00:00:00+07:00`).getTime()
  const actualDaysUsed = Math.max(1, Math.ceil(Math.max(0, now - periodStartMs) / 86_400_000))
  const normalMonthlyRate = bike.monthly_rate || bike.daily_rate * 30
  const recalculatedCharge = isEarly
    ? calcRentQuote(new Date(periodStartMs), actualDaysUsed, bike.daily_rate, normalMonthlyRate).total
    : periodPaidAmount
  const earlyReturnRefund = isEarly ? Math.max(0, periodPaidAmount - recalculatedCharge) : 0

  const [returnOdometer, setReturnOdometer] = useState(String(bike.odometer ?? ''))
  const [returnNote, setReturnNote]         = useState('')
  const [photos, setPhotos]                 = useState<string[]>([])
  const [uploading, setUploading]           = useState(false)
  const [confirmed, setConfirmed]           = useState(false)
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState('')

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/staff/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (res.ok && data.url) setPhotos(prev => [...prev, data.url])
    } finally {
      setUploading(false)
    }
  }

  const handleConfirm = async () => {
    if (!confirmed) { setError('กรุณากดยืนยันก่อน'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/staff/monthly/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthlyRentalId: rental.id,
          returnPhotos: photos.length > 0 ? photos : null,
          returnNote: returnNote.trim() || null,   // API maps → notes
          returnOdometer: returnOdometer ? Number(returnOdometer) : null,
          earlyReturnRefund,
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

  return (
    <div className="app-wrap">

      {/* Header */}
      <div className="app-header" style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
        <Link href={`/staff/collect/${rental.id}`} className="app-header-back">←</Link>
        <div>
          <h1>สิ้นสุดสัญญาเช่ารายเดือน</h1>
          <div className="sub">{bike.license_plate} {bike.brand} {bike.model}</div>
        </div>
      </div>

      <div className="section-pad">

        {/* Contract summary */}
        <div className="card" style={{ borderTop: '3px solid #dc2626' }}>
          <div className="card-title">สรุปสัญญา</div>
          <div className="info-row"><span className="info-key">ผู้เช่า</span><span className="info-val">{customer.name}</span></div>
          <div className="info-row"><span className="info-key">เบอร์โทร</span><span className="info-val">{customer.phone}</span></div>
          <div className="info-row"><span className="info-key">รถ</span><span className="info-val">{bike.license_plate} {bike.brand} {bike.model}</span></div>
          <div className="info-row"><span className="info-key">เริ่มสัญญา</span><span className="info-val">{fmtDate(rental.start_date)}</span></div>
          <div className="info-row">
            <span className="info-key">เช่ามาแล้ว</span>
            <span className="info-val" style={{ color: '#7c3aed', fontWeight: 700 }}>{monthsRented} เดือน</span>
          </div>
          <div className="info-row">
            <span className="info-key">ค่าเช่า/เดือน</span>
            <span className="info-val">฿{rental.monthly_rate.toLocaleString()}</span>
          </div>
          <div className="info-row">
            <span className="info-key">รวมรับไปแล้ว</span>
            <span className="info-val" style={{ color: '#16a34a', fontWeight: 700 }}>฿{totalCollected.toLocaleString()}</span>
          </div>
          <div className="info-row">
            <span className="info-key">มัดจำ</span>
            <span className="info-val">฿{rental.deposit_amount.toLocaleString()}</span>
          </div>
        </div>

        {/* Early return refund (งวดปัจจุบัน) */}
        {isEarly && (
          <div style={{
            background: '#f0fdf4', border: '2px solid #bbf7d0',
            borderRadius: '14px', padding: '14px 18px', marginBottom: '10px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a', marginBottom: '6px' }}>
              📆 คืนรถก่อนครบงวด — คิดค่าเช่างวดนี้ใหม่ตามวันที่ใช้จริง
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>
              งวดนี้ใช้จริง {actualDaysUsed} วัน × เรทรายวันปกติ (ไม่ใช้เรทรายเดือนที่ตกลงไว้) = ฿{recalculatedCharge.toLocaleString()}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#374151' }}>
                จ่ายงวดนี้ไปแล้ว ฿{periodPaidAmount.toLocaleString()} − ควรจ่ายจริง ฿{recalculatedCharge.toLocaleString()}
              </span>
              <span style={{ fontSize: '20px', fontWeight: 900, color: earlyReturnRefund > 0 ? '#15803d' : '#6b7280' }}>
                {earlyReturnRefund > 0 ? `คืน ฿${earlyReturnRefund.toLocaleString()}` : 'ไม่มีส่วนคืน'}
              </span>
            </div>
          </div>
        )}

        {/* Return info */}
        <div className="card">
          <div className="card-title">บันทึกการคืนรถ</div>

          <div className="field-row">
            <label className="field-label">เลขไมล์ตอนคืน (กม.)</label>
            <input
              className="field-input"
              type="number"
              placeholder={String(bike.odometer ?? 0)}
              value={returnOdometer}
              onChange={e => setReturnOdometer(e.target.value)}
            />
          </div>

          <div className="field-row">
            <label className="field-label">หมายเหตุ (สภาพรถ, ความเสียหาย ฯลฯ)</label>
            <input
              className="field-input"
              type="text"
              placeholder="เช่น คืนสภาพดี / มีรอยขีดข้างซ้าย"
              value={returnNote}
              onChange={e => setReturnNote(e.target.value)}
            />
          </div>

          {/* Photo upload */}
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">รูปถ่ายสภาพรถ (ถ้ามี)</label>
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              border: '2px dashed #d1d5db', borderRadius: '10px', padding: '14px',
              cursor: uploading ? 'not-allowed' : 'pointer', color: '#6b7280', fontSize: '14px',
            }}>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} style={{ display: 'none' }} />
              {uploading ? '⏳ กำลังอัปโหลด...' : '📷 เพิ่มรูป'}
            </label>
            {photos.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                {photos.map((url, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                    <button
                      onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                      style={{
                        position: 'absolute', top: '-6px', right: '-6px',
                        background: '#dc2626', color: '#fff', border: 'none',
                        borderRadius: '50%', width: '18px', height: '18px',
                        fontSize: '10px', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Confirm checkbox */}
        <div className="card" style={{ border: '1.5px solid #dc2626' }}>
          <div style={{ fontSize: '14px', color: '#111827', lineHeight: 1.6, marginBottom: '14px' }}>
            <strong style={{ color: '#dc2626' }}>⚠️ ยืนยันสิ้นสุดสัญญา</strong><br />
            หลังจากกดยืนยัน รถ <strong>{bike.license_plate}</strong> จะกลับสู่สถานะ <strong>ว่าง</strong> และสัญญาเช่าจะถูกปิดถาวร
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: '#dc2626', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#dc2626' }}>
              ฉันยืนยันว่าลูกค้าคืนรถแล้ว
            </span>
          </label>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', color: '#dc2626', fontSize: '14px', marginBottom: '12px' }}>
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={loading || !confirmed}
          style={{
            width: '100%',
            background: confirmed ? '#dc2626' : '#e5e7eb',
            color: confirmed ? '#fff' : '#9ca3af',
            border: 'none', borderRadius: '12px', padding: '16px',
            fontSize: '16px', fontWeight: 700, cursor: confirmed ? 'pointer' : 'not-allowed',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '⏳ กำลังบันทึก...' : '🚫 ยืนยันสิ้นสุดสัญญา'}
        </button>

        <div style={{ height: '24px' }} />
      </div>
    </div>
  )
}
