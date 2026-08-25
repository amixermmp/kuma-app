'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PhotoUpload from '@/components/PhotoUpload'

type LocationLogEntry = {
  date: string
  from_location: string | null
  from_address: string | null
  to_location: string
  to_address: string | null
  photo_url: string | null
}

type Repair = {
  id: string
  title: string
  description: string
  status: string
  created_at: string
  location_type: string | null
  location_address: string | null
  location_log: LocationLogEntry[] | null
  repair_photos: { url: string; label: string }[] | null
  bikes: { id: string; license_plate: string; brand: string; model: string }
}

function fmtLocation(type: string | null, address: string | null) {
  if (type === 'offsite') return `📍 นอกร้าน — ${address || 'ไม่ระบุที่อยู่'}`
  if (type === 'shop') return '🏠 อยู่ที่ร้าน'
  return '—'
}

type Props = { repair: Repair; staffId: string; isFromSwap?: boolean }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function RepairDoneForm({ repair, isFromSwap = false }: Props) {
  const router = useRouter()
  const bike = repair.bikes

  const [repairNotes, setRepairNotes] = useState('')
  const [repairShop, setRepairShop] = useState('')
  const [repairCost, setRepairCost] = useState('')
  const [lockForSwap, setLockForSwap] = useState(isFromSwap)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ย้ายรถไปซ่อม (อยู่ร้าน <-> นอกร้าน) — แก้ตำแหน่งของงานซ่อมใบนี้ ไม่สร้างใบใหม่
  const [movingOpen, setMovingOpen] = useState(false)
  const [moveLocationType, setMoveLocationType] = useState<'shop' | 'offsite'>(repair.location_type === 'offsite' ? 'shop' : 'offsite')
  const [moveAddress, setMoveAddress] = useState('')
  const [movePhotoUrl, setMovePhotoUrl] = useState('')
  const [moveSaving, setMoveSaving] = useState(false)
  const [moveMsg, setMoveMsg] = useState('')

  const handleMove = async () => {
    if (moveLocationType === 'offsite' && !moveAddress.trim()) { setMoveMsg('❌ กรุณาระบุว่ารถอยู่ที่ไหน'); return }
    setMoveSaving(true)
    setMoveMsg('')
    try {
      const res = await fetch('/api/staff/repair/update-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repairId: repair.id,
          locationType: moveLocationType,
          locationAddress: moveLocationType === 'offsite' ? moveAddress.trim() : null,
          photoUrl: movePhotoUrl || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setMoveMsg('❌ ' + (data.error ?? 'เกิดข้อผิดพลาด')); return }
      router.refresh()
      setMovingOpen(false)
      setMoveAddress('')
      setMovePhotoUrl('')
    } catch {
      setMoveMsg('❌ เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      setMoveSaving(false)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/staff/repair/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repairId: repair.id,
          bikeId: bike.id,
          repairNotes: repairNotes.trim() || null,
          repairShop: repairShop.trim() || null,
          repairCost: repairCost ? parseFloat(repairCost) : null,
          lockForSwap,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      router.push('/staff/jobs')
    } catch {
      setError('เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: '#7c3aed' }}>
        <Link href="/staff/jobs" className="app-header-back">←</Link>
        <div>
          <h1>ซ่อมเสร็จ</h1>
          <div className="sub">{bike.license_plate} {bike.brand} {bike.model}</div>
        </div>
      </div>

      <div className="section-pad">
        {/* Repair info */}
        <div className="card" style={{ borderTop: '3px solid #d97706' }}>
          <div className="card-title" style={{ color: '#d97706' }}>
            🔧 ส่งซ่อม — {bike.license_plate}
          </div>
          <div className="info-row">
            <span className="info-key">อาการ</span>
            <span className="info-val">{repair.description}</span>
          </div>
          <div className="info-row">
            <span className="info-key">วันที่แจ้ง</span>
            <span className="info-val">{fmtDate(repair.created_at)}</span>
          </div>
          <div className="info-row">
            <span className="info-key">ตำแหน่งรถ</span>
            <span className="info-val">{fmtLocation(repair.location_type, repair.location_address)}</span>
          </div>
          <div className="info-row">
            <span className="info-key">สถานะ</span>
            <span className="info-val">
              <span className="badge badge-red">กำลังซ่อม</span>
            </span>
          </div>
          {repair.repair_photos && repair.repair_photos.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={repair.repair_photos[0].url} alt="รูปตอนแจ้งซ่อม"
                style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', borderRadius: '10px', display: 'block' }} />
            </div>
          )}

          {!movingOpen ? (
            <button type="button" onClick={() => setMovingOpen(true)} style={{
              marginTop: '12px', width: '100%', background: '#eff6ff', color: '#2563eb',
              border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 12px',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              🚚 ย้ายรถไปซ่อม
            </button>
          ) : (
            <div style={{ marginTop: '12px', background: '#f9fafb', borderRadius: '10px', padding: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <button type="button" onClick={() => setMoveLocationType('shop')} style={{
                  flex: 1, padding: '10px', borderRadius: '10px',
                  border: `2px solid ${moveLocationType === 'shop' ? '#111827' : '#e5e7eb'}`,
                  background: moveLocationType === 'shop' ? '#f1f5f9' : '#fff',
                  color: moveLocationType === 'shop' ? '#111827' : '#6b7280',
                  fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                }}>🏠 ที่ร้าน</button>
                <button type="button" onClick={() => setMoveLocationType('offsite')} style={{
                  flex: 1, padding: '10px', borderRadius: '10px',
                  border: `2px solid ${moveLocationType === 'offsite' ? '#dc2626' : '#e5e7eb'}`,
                  background: moveLocationType === 'offsite' ? '#fef2f2' : '#fff',
                  color: moveLocationType === 'offsite' ? '#dc2626' : '#6b7280',
                  fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                }}>📍 นอกร้าน</button>
              </div>
              {moveLocationType === 'offsite' && (
                <div className="field-row">
                  <label className="field-label">ระบุว่าอยู่ที่ไหน *</label>
                  <input className="field-input" type="text"
                    placeholder="เช่น อู่ช่างแดง ถนน..."
                    value={moveAddress} onChange={e => setMoveAddress(e.target.value)} />
                </div>
              )}
              <div className="field-row" style={{ marginBottom: 0 }}>
                <label className="field-label">รูปหลักฐาน (ไม่บังคับ)</label>
                <PhotoUpload icon="📷" hint="เช่น รูปตอนส่งรถขึ้นรถ/ถึงอู่"
                  folder={`repair/${bike.id}`}
                  onUpload={url => setMovePhotoUrl(url)} onRemove={() => setMovePhotoUrl('')} />
              </div>
              {moveMsg && <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '8px' }}>{moveMsg}</div>}
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button type="button" onClick={() => setMovingOpen(false)} style={{
                  flex: 1, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px',
                  padding: '9px', fontSize: '13px', fontWeight: 700, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit',
                }}>ยกเลิก</button>
                <button type="button" onClick={handleMove} disabled={moveSaving} style={{
                  flex: 1, background: '#2563eb', border: 'none', borderRadius: '10px',
                  padding: '9px', fontSize: '13px', fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                  opacity: moveSaving ? 0.7 : 1,
                }}>{moveSaving ? '⏳...' : '✅ ยืนยันย้าย'}</button>
              </div>
            </div>
          )}

          {repair.location_log && repair.location_log.length > 0 && (
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', marginBottom: '8px' }}>ประวัติการย้าย</div>
              {[...repair.location_log].reverse().map((log, i) => (
                <div key={i} style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', lineHeight: 1.5 }}>
                  <span style={{ color: '#111827', fontWeight: 600 }}>
                    {new Date(log.date).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {' — '}{fmtLocation(log.to_location, log.to_address)}
                  {log.photo_url && (
                    <>
                      {' '}
                      <a href={log.photo_url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>📷 รูป</a>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">บันทึกผลการซ่อม</div>
          <div className="field-row">
            <label className="field-label">รายละเอียดงานซ่อม *</label>
            <textarea className="field-input" rows={3}
              placeholder="เช่น เปลี่ยนยาง เปลี่ยนน้ำมันเครื่อง ซ่อมไฟหน้า..."
              value={repairNotes}
              onChange={e => setRepairNotes(e.target.value)}
            />
          </div>
          <div className="field-row">
            <label className="field-label">ร้านซ่อม</label>
            <input className="field-input" type="text"
              placeholder="ร้านซ่อมมอเตอร์ไซค์เจริญ"
              value={repairShop}
              onChange={e => setRepairShop(e.target.value)}
            />
          </div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">ค่าซ่อม (บาท)</label>
            <input className="field-input" type="number" placeholder="850"
              value={repairCost}
              onChange={e => setRepairCost(e.target.value)}
            />
          </div>
        </div>

        {/* Toggle: ล็อครอสลับกลับ */}
        <div
          onClick={() => setLockForSwap(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            background: lockForSwap ? '#fef9c3' : '#f0fdf4',
            border: `2px solid ${lockForSwap ? '#ca8a04' : '#bbf7d0'}`,
            borderRadius: '12px', padding: '14px 16px',
            margin: '0 0 10px', cursor: 'pointer',
          }}
        >
          <div style={{
            width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
            border: `2px solid ${lockForSwap ? '#ca8a04' : '#16a34a'}`,
            background: lockForSwap ? '#ca8a04' : '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {lockForSwap && <span style={{ color: '#fff', fontSize: '13px', fontWeight: 900 }}>✓</span>}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: lockForSwap ? '#92400e' : '#16a34a' }}>
              {lockForSwap ? '🔒 ล็อครอสลับกลับ' : '✅ คืนสถานะว่าง'}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
              {lockForSwap
                ? 'รถจะอยู่ในสถานะ "ล็อค" รอ staff สลับกลับให้ลูกค้าคนเดิม'
                : 'รถจะกลับสู่สถานะ "ว่าง" พร้อมให้เช่าได้ทันที'}
            </div>
          </div>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '10px', padding: '12px', color: '#dc2626',
            fontSize: '14px', marginBottom: '12px',
          }}>⚠️ {error}</div>
        )}

        <button className="btn btn-success" onClick={handleSubmit} disabled={loading}
          style={{ width: '100%', opacity: loading ? 0.7 : 1 }}>
          {loading ? '⏳ กำลังบันทึก...' : '✅ ยืนยันซ่อมเสร็จ'}
        </button>
      </div>
    </div>
  )
}
