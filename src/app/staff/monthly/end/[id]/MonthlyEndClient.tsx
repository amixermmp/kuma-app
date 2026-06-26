'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Bike = { id: string; license_plate: string; brand: string; model: string; odometer: number }
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
  staffId: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function MonthlyEndClient({ rental, totalCollected, monthsRented }: Props) {
  const router = useRouter()
  const bike = rental.bikes
  const customer = rental.customers

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
