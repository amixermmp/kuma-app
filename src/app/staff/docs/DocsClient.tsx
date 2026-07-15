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
const DOC_TYPES = ['pob', 'tax'] as const

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
  const [cost, setCost] = useState('')

  const color = urgencyColor(doc.urgency)
  const isActionable = true // ใส่/แก้เอกสารได้ตลอด ไม่ต้องรอใกล้หมดอายุ

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
          cost: cost ? parseFloat(cost) : null,
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
          <div className="field-row">
            <label className="field-label">วันหมดอายุใหม่</label>
            <input className="field-input" type="date"
              value={newExpiry}
              min={new Date().toISOString().split('T')[0]}
              max={new Date(new Date().setFullYear(new Date().getFullYear() + 15)).toISOString().split('T')[0]}
              onChange={e => setNewExpiry(e.target.value)} />
          </div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">ค่าใช้จ่ายที่จ่ายจริง (บาท) — ลงบัญชีรายจ่ายอัตโนมัติ</label>
            <input className="field-input" type="number" inputMode="decimal" placeholder="เช่น 645"
              value={cost} onChange={e => setCost(e.target.value)} />
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

function AddDocCard({ bikeId, docType, onSaved }: { bikeId: string; docType: string; onSaved: () => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [photoUrl, setPhotoUrl] = useState('')
  const [expiry, setExpiry] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!expiry) { setError('กรุณาระบุวันหมดอายุ'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/staff/docs/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bikeId, docType, expiryDate: expiry, photoUrl: photoUrl || null }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error); return }
      onSaved()
      router.refresh()
    } catch { setError('เกิดข้อผิดพลาด') }
    finally { setLoading(false) }
  }

  return (
    <div className="card" style={{ borderTop: '3px dashed #d1d5db', background: '#f9fafb' }}>
      <div className="card-title" style={{ color: '#6b7280' }}>
        {DOC_ICON[docType]} {DOC_LABEL[docType] ?? docType} — <span style={{ fontWeight: 400 }}>ยังไม่มีข้อมูล</span>
      </div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{
            width: '100%', padding: '10px', border: '1.5px dashed #9ca3af',
            borderRadius: '8px', background: '#fff', color: '#4b5563',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ➕ เพิ่มข้อมูล{DOC_LABEL[docType] ?? docType}
        </button>
      ) : (
        <div>
          <div className="field-row">
            <label className="field-label">อัพโหลดเอกสาร</label>
            <PhotoUpload
              icon={DOC_ICON[docType]}
              hint={`อัพโหลด${DOC_LABEL[docType] ?? 'เอกสาร'}`}
              folder={`docs/${bikeId}`}
              onUpload={url => setPhotoUrl(url)}
              onRemove={() => setPhotoUrl('')}
            />
          </div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">วันหมดอายุ *</label>
            <input className="field-input" type="date"
              value={expiry}
              onChange={e => setExpiry(e.target.value)} />
          </div>
          {error && <div style={{ color: '#dc2626', fontSize: '13px', marginTop: '8px' }}>⚠️ {error}</div>}
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <button onClick={() => setOpen(false)} style={{
              flex: 1, padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px',
              background: '#fff', color: '#6b7280', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
            }}>ยกเลิก</button>
            <button onClick={handleSave} disabled={loading} style={{
              flex: 2, padding: '10px', border: 'none', borderRadius: '8px',
              background: '#0f766e', color: '#fff', fontSize: '14px', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1,
            }}>
              {loading ? '⏳ กำลังบันทึก...' : '✅ บันทึก'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// การ์ดหน้าเล่มทะเบียน — เอกสารถาวร อัพโหลด/เปลี่ยนรูปได้ตลอด ไม่มีวันหมดอายุ
function RegistrationCard({ bikeId, regDoc }: { bikeId: string; regDoc: { id: string; doc_photo_url: string | null } | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [photoUrl, setPhotoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const hasPhoto = !!regDoc?.doc_photo_url

  const handleSave = async () => {
    if (!photoUrl) { setError('กรุณาอัพโหลดรูปก่อน'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/staff/docs/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: regDoc?.id, bikeId, docType: 'registration', photoUrl }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error); return }
      setOpen(false)
      setPhotoUrl('')
      router.refresh()
    } catch { setError('เกิดข้อผิดพลาด') }
    finally { setLoading(false) }
  }

  return (
    <div className="card" style={{ borderTop: `3px solid ${hasPhoto ? '#16a34a' : '#d1d5db'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div className="card-title" style={{ margin: 0, flex: 1 }}>
          📗 สำเนาหน้าเล่มทะเบียน
          <span style={{ fontSize: '11px', fontWeight: 400, color: '#9ca3af', marginLeft: '6px' }}>เอกสารถาวร — ใส่ครั้งเดียว</span>
        </div>
        <span style={{
          fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
          background: hasPhoto ? '#dcfce7' : '#f3f4f6', color: hasPhoto ? '#16a34a' : '#9ca3af',
        }}>
          {hasPhoto ? '✅ มีแล้ว' : '— ไม่มี'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        {hasPhoto && (
          <a href={regDoc!.doc_photo_url!} target="_blank" rel="noreferrer" style={{
            flex: 1, padding: '9px', borderRadius: '8px', textAlign: 'center',
            background: '#f1f5f9', color: '#374151', border: '1px solid #e5e7eb',
            fontSize: '13px', fontWeight: 600, textDecoration: 'none',
          }}>👁️ ดูรูป</a>
        )}
        {!open && (
          <button onClick={() => setOpen(true)} style={{
            flex: 1, padding: '9px', borderRadius: '8px',
            background: hasPhoto ? '#fff' : '#0f766e',
            color: hasPhoto ? '#0f766e' : '#fff',
            border: hasPhoto ? '1.5px solid #0f766e' : 'none',
            fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {hasPhoto ? '🔄 เปลี่ยนรูป' : '➕ อัพโหลดหน้าเล่ม'}
          </button>
        )}
      </div>

      {open && (
        <div style={{ marginTop: '12px' }}>
          <PhotoUpload
            icon="📗"
            hint="อัพโหลดสำเนาหน้าเล่มทะเบียน"
            folder={`docs/${bikeId}`}
            onUpload={url => setPhotoUrl(url)}
            onRemove={() => setPhotoUrl('')}
          />
          {error && <div style={{ color: '#dc2626', fontSize: '13px', marginTop: '8px' }}>⚠️ {error}</div>}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button onClick={() => { setOpen(false); setPhotoUrl('') }} style={{
              flex: 1, padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px',
              background: '#fff', color: '#6b7280', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
            }}>ยกเลิก</button>
            <button onClick={handleSave} disabled={loading || !photoUrl} style={{
              flex: 2, padding: '10px', border: 'none', borderRadius: '8px',
              background: photoUrl ? '#0f766e' : '#e5e7eb', color: photoUrl ? '#fff' : '#9ca3af',
              fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              opacity: loading ? 0.7 : 1,
            }}>
              {loading ? '⏳ กำลังบันทึก...' : '✅ บันทึก'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DocsClient({ docs, bikeId, backHref, regDoc }: {
  docs: DocItem[]
  bikeId: string | null
  backHref?: string
  regDoc?: { id: string; doc_photo_url: string | null } | null
}) {
  const urgent = docs.filter(d => d.urgency === 'overdue' || d.urgency === 'critical')
  const warning = docs.filter(d => d.urgency === 'warning')
  const ok = docs.filter(d => d.urgency === 'ok')

  // ถ้าดู specific bike → หา type ที่ยังไม่มีในฐานข้อมูล
  const existingTypes = new Set(docs.map(d => d.doc_type))
  const missingTypes = bikeId ? DOC_TYPES.filter(t => !existingTypes.has(t)) : []
  const [savedTypes, setSavedTypes] = useState<string[]>([])
  const pendingMissing = missingTypes.filter(t => !savedTypes.includes(t))

  const resolvedBackHref = backHref ?? (bikeId ? '/staff/jobs' : '/staff/home')

  // แสดงชื่อรถใน subtitle (จาก doc แรกที่มีข้อมูล)
  const bike = docs[0]?.bikes

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: '#0f766e' }}>
        <Link href={resolvedBackHref} className="app-header-back">←</Link>
        <div>
          <h1>งานเอกสาร</h1>
          <div className="sub">{bike ? `${bike.license_plate} ${bike.brand} ${bike.model}` : 'ภาษี / พ.ร.บ. / ประกัน'}</div>
        </div>
      </div>

      <div className="section-pad" style={{ paddingTop: '12px' }}>
        {/* หน้าเล่มทะเบียน — อัพโหลด/เปลี่ยนได้ตลอด */}
        {bikeId && <RegistrationCard bikeId={bikeId} regDoc={regDoc ?? null} />}

        {/* เอกสารที่ยังไม่มี (เฉพาะตอน filter by bikeId) */}
        {pendingMissing.length > 0 && (
          <>
            <div style={{
              background: '#fefce8', border: '1px solid #fde047', borderRadius: '10px',
              padding: '10px 14px', marginBottom: '4px', fontSize: '13px', color: '#854d0e',
            }}>
              ⚠️ รถคันนี้ยังไม่มีข้อมูล {pendingMissing.map(t => DOC_LABEL[t]).join(', ')}
            </div>
            {pendingMissing.map(t => (
              <AddDocCard
                key={t}
                bikeId={bikeId!}
                docType={t}
                onSaved={() => setSavedTypes(prev => [...prev, t])}
              />
            ))}
          </>
        )}

        {docs.length === 0 && pendingMissing.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '14px' }}>
            ยังไม่มีข้อมูลเอกสาร
          </div>
        ) : docs.length > 0 && (
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
