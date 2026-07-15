'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Entry = { id: string; name: string; phone: string | null; reason: string | null; created_at: string }

export default function BlacklistClient({ entries }: { entries: Entry[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAdd = async () => {
    if (!name.trim()) { setError('กรุณาระบุชื่อ'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/owner/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, reason }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      setName(''); setPhone(''); setReason('')
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

      {/* Add form */}
      <div style={{ margin: '16px', background: '#fff', borderRadius: '14px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '12px' }}>เพิ่มรายชื่อ</div>
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
          รายชื่อทั้งหมด ({entries.length})
        </div>
        {entries.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>ยังไม่มีรายชื่อ</div>
        ) : entries.map((e, i) => (
          <div key={e.id} style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0',
            borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#dc2626' }}>{e.name}</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                {e.phone && <span>{e.phone} • </span>}
                {e.reason ?? 'ไม่ระบุเหตุผล'}
              </div>
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
