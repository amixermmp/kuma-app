'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PhotoUpload from '@/components/PhotoUpload'
import BookingConflictModal from '@/components/staff/BookingConflictModal'

type Bike = {
  id: string
  license_plate: string
  brand: string
  model: string
  status: string
}

type Props = { bike: Bike; staffId: string }

export default function BrokenForm({ bike, staffId }: Props) {
  const router = useRouter()
  const [description, setDescription] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [locationType, setLocationType] = useState<'shop' | 'offsite' | null>(null)
  const [locationAddress, setLocationAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [conflicts, setConflicts] = useState<any[]>([])

  const handleSubmit = async () => {
    if (!description.trim()) { setError('กรุณาอธิบายอาการของรถ'); return }
    if (!locationType) { setError('กรุณาเลือกตำแหน่งรถ'); return }
    if (locationType === 'offsite' && !locationAddress.trim()) { setError('กรุณาระบุว่ารถอยู่ที่ไหน'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/staff/repair/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bikeId: bike.id,
          staffId,
          description: description.trim(),
          photoUrl: photoUrl || null,
          locationType,
          locationAddress: locationType === 'offsite' ? locationAddress.trim() : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      if (data.conflicts?.length > 0) { setConflicts(data.conflicts); return }
      router.push('/staff/jobs')
    } catch {
      setError('เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: '#dc2626' }}>
        <Link href="/staff/broken" className="app-header-back">←</Link>
        <div>
          <h1>แจ้งรถเสีย</h1>
          <div className="sub">{bike.license_plate} {bike.brand} {bike.model}</div>
        </div>
      </div>

      <div className="section-pad">
        <div className="card">
          <div className="card-title">อาการที่พบ</div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">อธิบายอาการของรถ *</label>
            <textarea className="field-input" rows={4}
              placeholder="เช่น เครื่องไม่ติด, ยางแบน, ไฟหน้าไม่ติด..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-title">รูปภาพ</div>
          <PhotoUpload
            icon="📷"
            hint="ถ่ายรูปจุดที่เสีย / ความเสียหาย"
            folder={`repair/${bike.id}`}
            onUpload={url => setPhotoUrl(url)}
            onRemove={() => setPhotoUrl('')}
          />
        </div>

        <div className="card">
          <div className="card-title">ตำแหน่งรถ *</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setLocationType('shop')} style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              border: `2px solid ${locationType === 'shop' ? '#111827' : '#e5e7eb'}`,
              background: locationType === 'shop' ? '#f1f5f9' : '#fff',
              color: locationType === 'shop' ? '#111827' : '#6b7280',
              fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
            }}>🏠 ที่ร้าน</button>
            <button onClick={() => setLocationType('offsite')} style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              border: `2px solid ${locationType === 'offsite' ? '#dc2626' : '#e5e7eb'}`,
              background: locationType === 'offsite' ? '#fef2f2' : '#fff',
              color: locationType === 'offsite' ? '#dc2626' : '#6b7280',
              fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
            }}>📍 นอกร้าน</button>
          </div>
          {locationType === 'offsite' && (
            <div className="field-row" style={{ marginTop: '10px', marginBottom: 0 }}>
              <label className="field-label">ระบุว่าอยู่ที่ไหน *</label>
              <input className="field-input" type="text"
                placeholder="เช่น หน้าเซเว่นตลาดใหม่, ถนน... ตรงข้าม..."
                value={locationAddress}
                onChange={e => setLocationAddress(e.target.value)}
              />
            </div>
          )}
        </div>

        <div style={{
          background: '#fef2f2', borderRadius: '10px', padding: '14px',
          margin: '0 0 12px', fontSize: '13px', color: '#dc2626',
        }}>
          ⚠️ เมื่อกดบันทึก รถจะเปลี่ยนสถานะเป็น <strong>"ซ่อม"</strong> และจะสร้าง Job Task อัตโนมัติ
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '10px', padding: '12px', color: '#dc2626',
            fontSize: '14px', marginBottom: '12px',
          }}>⚠️ {error}</div>
        )}

        <button className="btn btn-danger" onClick={handleSubmit} disabled={loading}
          style={{ width: '100%', opacity: loading ? 0.7 : 1 }}>
          {loading ? '⏳ กำลังบันทึก...' : '🔧 บันทึกแจ้งรถเสีย'}
        </button>
      </div>

      <BookingConflictModal conflicts={conflicts} onAcknowledge={() => router.push('/staff/jobs')} />
    </div>
  )
}
