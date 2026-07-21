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
  const [severity, setSeverity] = useState<'medium' | 'critical'>('medium')
  const [photoUrl, setPhotoUrl] = useState('')
  const [locationNote, setLocationNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [conflicts, setConflicts] = useState<any[]>([])

  const handleSubmit = async () => {
    if (!description.trim()) { setError('กรุณาอธิบายอาการของรถ'); return }
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
          severity,
          photoUrl: photoUrl || null,
          locationNote: locationNote.trim() || null,
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
          <div className="field-row">
            <label className="field-label">อธิบายอาการของรถ *</label>
            <textarea className="field-input" rows={4}
              placeholder="เช่น เครื่องไม่ติด, ยางแบน, ไฟหน้าไม่ติด..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">ระดับความรุนแรง</label>
            <div className="severity-row">
              {(['medium', 'critical'] as const).map(s => (
                <button key={s} onClick={() => setSeverity(s)} className={`sev-btn ${severity === s ? (s === 'medium' ? 'active-low' : 'active-high') : ''}`}>
                  {s === 'medium' ? '⚠️ ปานกลาง' : '🔴 วิกฤต'}
                </button>
              ))}
            </div>
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
          <div className="card-title">ตำแหน่งรถ / หมายเหตุ</div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">สถานที่ / หมายเหตุเพิ่มเติม</label>
            <input className="field-input" type="text"
              placeholder="เช่น อยู่ที่ร้านซ่อมแถวตลาด"
              value={locationNote}
              onChange={e => setLocationNote(e.target.value)}
            />
          </div>
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
