'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PhotoUpload from '@/components/PhotoUpload'
import type { DocItem } from './page'

const DOC_LABEL: Record<string, string> = {
  pob: 'พ.ร.บ. ประกันภัย',
  tax: 'ป้ายภาษีประจำปี',
  registration: 'หน้าเล่มรถ',
}
const DOC_ICON: Record<string, string> = { pob: '🛡️', tax: '💰', registration: '📗' }

function urgencyColor(u: DocItem['urgency']) {
  if (u === 'overdue' || u === 'critical') return '#dc2626'
  if (u === 'warning') return '#d97706'
  return '#16a34a'
}
function urgencyLabel(u: DocItem['urgency'], days: number) {
  if (u === 'overdue') return days < -100 ? 'ไม่มีข้อมูล' : `หมดแล้ว ${Math.abs(days)} วัน`
  if (u === 'critical') return `🚨 เหลือ ${days} วัน — เร่งด่วน!`
  if (u === 'warning') return `⚠️ เหลือ ${days} วัน`
  return `✅ เหลือ ${days} วัน`
}

function DocCard({ doc }: { doc: DocItem }) {
  const router = useRouter()
  const [photoUrl, setPhotoUrl] = useState('')
  const [newExpiry, setNewExpiry] = useState(
    doc.expiry_date
      ? new Date(new Date(doc.expiry_date).setFullYear(new Date(doc.expiry_date).getFullYear() + 1))
          .toISOString().split('T')[0]
      : ''
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const color = urgencyColor(doc.urgency)
  const isActionable = doc.urgency !== 'ok'

  const handleSave = async () => {
    if (!newExpiry) { setError('กรุณาระบุวันหมดอายุใหม่'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/staff/docs/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: doc.id,
          bikeId: doc.bike_id,
          docType: doc.doc_type,
          expiryDate: newExpiry,
          photoUrl: photoUrl || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error); return }
      setSaved(true)
      router.refresh()
    } catch { setError('เกิดข้อผิดพลาด') }
    finally { setLoading(false) }
  }

  return (
    <div className="card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="card-title" style={{ color }}>
        {DOC_ICON[doc.doc_type]} {DOC_LABEL[doc.doc_type] ?? doc.doc_type}
      </div>
      <div className="info-row">
        <span className="info-key">ทะเบียนรถ</span>
        <span className="info-val">{doc.bikes?.license_plate} {doc.bikes?.brand} {doc.bikes?.model}</span>
      </div>
      <div className="info-row">
        <span className="info-key">หมดอายุ</span>
        <span className="info-val" style={{ color }}>
          {doc.expiry_date
            ? new Date(doc.expiry_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
            : 'ไม่มีข้อมูล'}
        </span>
      </div>
      <div className="info-row">
        <span className="info-key">สถานะ</span>
        <span className="info-val" style={{ color, fontWeight: 700 }}>
          {urgencyLabel(doc.urgency, doc.days)}
        </span>
      </div>

      {isActionable && !saved && (
        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px dashed #e5e7eb' }}>
          <div className="field-row">
            <label className="field-label">อัพโหลดเอกสารใหม่</label>
            <PhotoUpload
              icon={DOC_ICON[doc.doc_type]}
              hint={`อัพโหลด${DOC_LABEL[doc.doc_type] ?? 'เอกสาร'}ใหม่`}
              folder={`docs/${doc.bike_id}`}
              onUpload={url => setPhotoUrl(url)}
              onRemove={() => setPhotoUrl('')}
            />
          </div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">วันหมดอายุใหม่</label>
            <input className="field-input" type="date"
              value={newExpiry} onChange={e => setNewExpiry(e.target.value)} />
          </div>
          {error && <div style={{ color: '#dc2626', fontSize: '13px', marginTop: '8px' }}>⚠️ {error}</div>}
          <button className="btn btn-success"
            style={{ marginTop: '14px', width: '100%', opacity: loading ? 0.7 : 1 }}
            onClick={handleSave} disabled={loading}>
            {loading ? '⏳ กำลังบันทึก...' : '✅ บันทึก — ปิด Job Task'}
          </button>
        </div>
      )}
      {saved && (
        <div style={{ marginTop: '10px', color: '#16a34a', fontSize: '13px', fontWeight: 600 }}>
          ✅ บันทึกเรียบร้อยแล้ว
        </div>
      )}
    </div>
  )
}

export default function DocsClient({ docs }: { docs: DocItem[] }) {
  const urgent = docs.filter(d => d.urgency === 'overdue' || d.urgency === 'critical')
  const warning = docs.filter(d => d.urgency === 'warning')
  const ok = docs.filter(d => d.urgency === 'ok')

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: '#0f766e' }}>
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div>
          <h1>งานเอกสาร</h1>
          <div className="sub">ภาษี / พ.ร.บ. / ประกัน</div>
        </div>
      </div>

      <div className="section-pad" style={{ paddingTop: '12px' }}>
        {docs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '14px' }}>
            ยังไม่มีข้อมูลเอกสาร<br />
            <span style={{ fontSize: '12px' }}>เพิ่มข้อมูลได้จากหน้ารายละเอียดรถ</span>
          </div>
        ) : (
          <>
            {urgent.length > 0 && (
              <div style={{
                background: '#fef2f2', borderRadius: '10px', padding: '12px 14px',
                margin: '12px 0 4px', fontSize: '13px', color: '#dc2626',
                border: '1px solid #fecaca',
              }}>
                🚨 <strong>ใกล้หมดอายุ!</strong> มี {urgent.length} รายการที่ต้องดำเนินการด่วน
              </div>
            )}
            {urgent.map(d => <DocCard key={d.id} doc={d} />)}

            {warning.length > 0 && (
              <div style={{
                background: '#fffbeb', borderRadius: '10px', padding: '12px 14px',
                margin: '4px 0', fontSize: '13px', color: '#d97706',
                border: '1px solid #fcd34d',
              }}>
                ⚠️ มี {warning.length} รายการที่ใกล้หมดอายุภายใน 30 วัน
              </div>
            )}
            {warning.map(d => <DocCard key={d.id} doc={d} />)}

            {ok.length > 0 && (
              <>
                <div className="card-title" style={{ padding: '8px 0', fontSize: '12px', color: '#6b7280' }}>
                  ปกติ / ยังไม่หมดอายุ
                </div>
                {ok.map(d => <DocCard key={d.id} doc={d} />)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
