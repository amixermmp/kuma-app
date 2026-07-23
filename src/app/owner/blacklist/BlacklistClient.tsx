'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PhotoUpload from '@/components/PhotoUpload'

type Entry = { id: string; name: string; phone: string | null; id_card_number: string | null; photo_url: string | null; reason: string | null; created_at: string }

const normalizeSearch = (s: string) => s.replace(/\s+/g, '').toLowerCase()

export default function BlacklistClient({ entries }: { entries: Entry[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [idCardNumber, setIdCardNumber] = useState('')
  const [reason, setReason] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrHint, setOcrHint] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  // แนบรูป (บัตร/โพสเตือนภัย) — ถ้าอ่านได้ auto-fill ชื่อ/เลขบัตรให้เลย (ไม่ทับถ้าพิมพ์ไว้แล้ว)
  const handlePhotoUpload = useCallback(async (url: string) => {
    setPhotoUrl(url)
    setOcrLoading(true)
    setOcrHint('')
    try {
      const res = await fetch('/api/staff/ocr-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: url }),
      })
      const data = await res.json()
      let filled = false
      setName(prev => {
        if (!prev.trim() && data.name) { filled = true; return data.name }
        return prev
      })
      setIdCardNumber(prev => {
        if (!prev.trim() && data.idCardNumber) { filled = true; return data.idCardNumber }
        return prev
      })
      setOcrHint(filled ? '✓ อ่านจากรูปแล้ว ตรวจสอบก่อนบันทึก' : 'อ่านจากรูปไม่ได้ — กรอกเอง (รูปถูกแนบไว้แล้ว)')
    } catch {
      setOcrHint('อ่านจากรูปไม่ได้ — กรอกเอง (รูปถูกแนบไว้แล้ว)')
    } finally {
      setOcrLoading(false)
    }
  }, [])

  const nSearch = normalizeSearch(search)
  const filteredEntries = nSearch
    ? entries.filter(e =>
        normalizeSearch(e.name).includes(nSearch) ||
        (e.phone && normalizeSearch(e.phone).includes(nSearch)) ||
        (e.id_card_number && normalizeSearch(e.id_card_number).includes(nSearch))
      )
    : entries

  const handleAdd = async () => {
    if (!name.trim()) { setError('กรุณาระบุชื่อ'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/owner/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, idCardNumber, reason, photoUrl }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      setName(''); setPhone(''); setIdCardNumber(''); setReason(''); setPhotoUrl(''); setOcrHint('')
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, entryName: string) => {
    if (!confirm(`ปลด "${entryName}" ออกจากบัญชีดำ?`)) return
    await fetch('/api/owner/blacklist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    router.refresh()
  }

  return (
    <div className="app-wrap">

      <div className="app-header" style={{ background: '#111827' }}>
        <Link href="/owner/dashboard" className="app-header-back">←</Link>
        <div>
          <h1>⛔ บัญชีแบล็คลิสต์</h1>
          <div className="sub">มิจฉาชีพ/ขโมยรถ — ระบบเช็คอัตโนมัติตอนทำสัญญา</div>
        </div>
      </div>

      {/* Search — เช็คก่อนว่ามีอยู่แล้วหรือยัง กันเพิ่มซ้ำ */}
      <div style={{ margin: '16px 16px 0' }}>
        <input className="field-input" type="text" placeholder="🔍 ค้นหาชื่อ/เบอร์/เลขบัตร ก่อนเพิ่ม กันซ้ำ"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Add form */}
      <div style={{ margin: '16px', background: '#fff', borderRadius: '14px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '12px' }}>เพิ่มรายชื่อ</div>
        <div className="field-row">
          <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            แนบรูป (บัตร/โพสเตือนภัย) — ไม่บังคับ
            {ocrLoading && <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 400 }}>⏳ กำลังอ่านรูป...</span>}
          </label>
          <PhotoUpload
            icon="📎" hint="แตะเพื่อแนบรูป — ถ้าเป็นรูปบัตรจะกรอกชื่อ/เลขบัตรให้อัตโนมัติ"
            folder="blacklist" uploadEndpoint="/api/owner/upload"
            onUpload={handlePhotoUpload} onRemove={() => { setPhotoUrl(''); setOcrHint('') }}
          />
          {ocrHint && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{ocrHint}</div>}
        </div>
        <div className="field-row">
          <label className="field-label">ชื่อ - นามสกุล *</label>
          <input className="field-input" type="text" placeholder="สมชาย ใจร้าย"
            value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="field-row">
          <label className="field-label">เบอร์โทร (ถ้ามี)</label>
          <input className="field-input" type="tel" placeholder="08x-xxx-xxxx"
            value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
        <div className="field-row">
          <label className="field-label">เลขบัตรประชาชน/พาสปอร์ต (ถ้ามี)</label>
          <input className="field-input" type="text" placeholder="เช่น 1234567890123"
            value={idCardNumber} onChange={e => setIdCardNumber(e.target.value)} />
        </div>
        <div className="field-row">
          <label className="field-label">เหตุผล</label>
          <input className="field-input" type="text" placeholder="เช่น ขโมยรถร้าน XXX เกาะพะงัน"
            value={reason} onChange={e => setReason(e.target.value)} />
        </div>
        {error && <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '8px' }}>{error}</div>}
        <button onClick={handleAdd} disabled={loading} style={{
          width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
          background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: '14px',
          cursor: 'pointer', opacity: loading ? 0.6 : 1,
        }}>
          {loading ? 'กำลังบันทึก...' : '+ เพิ่มเข้าบัญชีดำ'}
        </button>
      </div>

      {/* List */}
      <div style={{ margin: '0 16px 80px', background: '#fff', borderRadius: '14px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '12px' }}>
          {nSearch ? `ผลค้นหา (${filteredEntries.length} / ${entries.length})` : `รายชื่อทั้งหมด (${entries.length})`}
        </div>
        {filteredEntries.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>
            {nSearch ? 'ไม่พบ — ยังไม่เคยเพิ่มคนนี้' : 'ยังไม่มีรายชื่อ'}
          </div>
        ) : filteredEntries.map((e, i) => (
          <div key={e.id} style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0',
            borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
          }}>
            {e.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.photo_url} alt={e.name} style={{
                width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0,
              }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#dc2626' }}>{e.name}</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                {e.phone && <span>{e.phone} • </span>}
                {e.reason ?? 'ไม่ระบุเหตุผล'}
              </div>
              {e.id_card_number && (
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>เลขบัตร: {e.id_card_number}</div>
              )}
              <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                เพิ่มเมื่อ {new Date(e.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
            <button onClick={() => handleDelete(e.id, e.name)} style={{
              background: 'none', border: '1px solid #e5e7eb', borderRadius: '8px',
              padding: '6px 10px', fontSize: '12px', color: '#6b7280', cursor: 'pointer',
            }}>ปลด</button>
          </div>
        ))}
      </div>

    </div>
  )
}
