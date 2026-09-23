'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { BranchFilter } from '@/components/BranchFilter'

export type MarketingPhoto = {
  id: string
  branchId: string
  originalUrl: string
  processedUrl: string | null
  stickerX: number | null
  stickerY: number | null
  stickerX2: number | null
  stickerY2: number | null
  createdAt: string
}

type Point = { x: number; y: number }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })
}

function PhotoCard({ photo, hasFrame, onChanged }: {
  photo: MarketingPhoto
  hasFrame: boolean
  onChanged: (updated: Partial<MarketingPhoto>) => void
  onDeleted: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const [points, setPoints] = useState<Point[]>([])
  const imgRef = useRef<HTMLImageElement>(null)

  // ใส่กรอบอัตโนมัติทันทีที่รูปเข้าคิว — ไม่ต้องกดเอง กดแค่ตอนอยากปรับตำแหน่งสติ๊กเกอร์
  useEffect(() => {
    if (!photo.processedUrl && hasFrame) process()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.id])

  const process = async () => {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/owner/marketing/process', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId: photo.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onChanged({ processedUrl: data.processedUrl, stickerX: data.stickerX, stickerY: data.stickerY, stickerX2: data.stickerX2, stickerY2: data.stickerY2 })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setBusy(false)
    }
  }

  const startAdjusting = () => {
    const initial: Point[] = []
    if (photo.stickerX != null && photo.stickerY != null) initial.push({ x: photo.stickerX, y: photo.stickerY })
    if (photo.stickerX2 != null && photo.stickerY2 != null) initial.push({ x: photo.stickerX2, y: photo.stickerY2 })
    setPoints(initial)
    setAdjusting(true)
  }

  // แตะเพิ่มจุด (สูงสุด 2) — แตะใกล้จุดเดิมคือลบจุดนั้นแทน, แตะตอนครบ 2 แล้วคือเริ่มใหม่จากจุดนี้
  const tapAt = (clientX: number, clientY: number) => {
    if (busy) return
    const el = imgRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (clientX - rect.left) / rect.width
    const y = (clientY - rect.top) / rect.height

    const hitIndex = points.findIndex(p => Math.hypot(p.x - x, p.y - y) < 0.06)
    if (hitIndex !== -1) {
      setPoints(prev => prev.filter((_, i) => i !== hitIndex))
      return
    }
    setPoints(prev => (prev.length >= 2 ? [{ x, y }] : [...prev, { x, y }]))
  }

  const savePositions = async () => {
    if (busy) return // กันกดซ้ำระหว่างบันทึกค่าเดิมยังไม่เสร็จ — ไม่งั้น request ซ้อนกันแล้วผลลัพธ์กลับมาไม่เรียงลำดับ
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/owner/marketing/adjust', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId: photo.id, positions: points }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onChanged({ processedUrl: data.processedUrl, stickerX: data.stickerX, stickerY: data.stickerY, stickerX2: data.stickerX2, stickerY2: data.stickerY2 })
      setAdjusting(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirm('ลบรูปนี้?')) return
    setBusy(true)
    await fetch('/api/owner/marketing/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId: photo.id }),
    })
    location.reload()
  }

  return (
    <div style={{ background: '#fff', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
      {adjusting ? (
        <div style={{ position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef} src={photo.originalUrl} alt="ต้นฉบับ" onClick={e => tapAt(e.clientX, e.clientY)}
            style={{ width: '100%', display: 'block', cursor: busy ? 'wait' : 'crosshair', opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto' }}
          />
          {points.map((p, i) => (
            <div key={i} style={{
              position: 'absolute', left: `${p.x * 100}%`, top: `${p.y * 100}%`,
              width: '24px', height: '24px', marginLeft: '-12px', marginTop: '-12px',
              border: '2px solid #e11d48', borderRadius: '50%', pointerEvents: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(225,29,72,.15)', color: '#e11d48', fontSize: '11px', fontWeight: 800,
            }}>{i + 1}</div>
          ))}
          <div style={{ position: 'absolute', top: '8px', left: '8px', right: '8px', background: 'rgba(17,24,39,.8)', color: '#fff', fontSize: '11px', padding: '6px 10px', borderRadius: '8px', textAlign: 'center' }}>
            {busy ? '⏳ กำลังบันทึก...'
              : points.length === 0 ? 'แตะตำแหน่งใบหน้า (สูงสุด 2 จุด)'
              : points.length === 1 ? 'แตะเพิ่มอีกจุดได้ (ถ้ามี) หรือกดบันทึก'
              : 'ครบ 2 จุดแล้ว — แตะจุดเดิมเพื่อลบ หรือกดบันทึก'}
          </div>
        </div>
      ) : photo.processedUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.processedUrl} alt="ผลลัพธ์" style={{ width: '100%', display: 'block' }} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.originalUrl} alt="ต้นฉบับ" style={{ width: '100%', display: 'block', opacity: 0.7 }} />
      )}

      <div style={{ padding: '10px' }}>
        <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px' }}>{fmtDate(photo.createdAt)}</div>
        {error && <div style={{ fontSize: '11px', color: '#dc2626', marginBottom: '8px' }}>{error}</div>}

        {adjusting ? (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={savePositions} disabled={busy} style={{
              flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
              background: '#111827', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
            }}>{busy ? '⏳' : '💾 บันทึก'}</button>
            <button onClick={() => setAdjusting(false)} disabled={busy} style={{
              padding: '8px 14px', borderRadius: '8px', border: '1px solid #e5e7eb',
              background: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}>ยกเลิก</button>
          </div>
        ) : !photo.processedUrl ? (
          <button onClick={process} disabled={busy || !hasFrame} style={{
            width: '100%', padding: '8px', borderRadius: '8px', border: 'none',
            background: hasFrame ? '#111827' : '#d1d5db', color: '#fff', fontSize: '12px', fontWeight: 700,
            cursor: hasFrame ? 'pointer' : 'default',
          }}>{busy ? '⏳ กำลังทำ...' : hasFrame ? '🖼️ ใส่กรอบ' : 'ยังไม่ตั้งค่ากรอบ'}</button>
        ) : (
          <div style={{ display: 'flex', gap: '6px' }}>
            <a href={photo.processedUrl} download target="_blank" rel="noreferrer" style={{
              flex: 1, padding: '8px', borderRadius: '8px', border: 'none', textAlign: 'center',
              background: '#16a34a', color: '#fff', fontSize: '12px', fontWeight: 700, textDecoration: 'none',
            }}>📥 โหลด</a>
            <button onClick={startAdjusting} disabled={busy} style={{
              padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', fontSize: '12px', cursor: 'pointer',
            }}>✏️</button>
            <button onClick={remove} disabled={busy} style={{
              padding: '8px 10px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: '12px', cursor: 'pointer',
            }}>🗑️</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MarketingClient({ photos: initialPhotos, branches, branch, branchHasFrame }: {
  photos: MarketingPhoto[]
  branches: { id: string; name: string }[]
  branch: string
  branchHasFrame: string[]
}) {
  const [photos, setPhotos] = useState(initialPhotos)

  const updatePhoto = (id: string, updated: Partial<MarketingPhoto>) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p))
  }

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: '#111827', alignItems: 'center' }}>
        <Link href="/owner/dashboard" className="app-header-back">←</Link>
        <div style={{ flex: 1 }}>
          <h1>🖼️ รูปโปรโมท</h1>
          <div className="sub">รูปคู่รถลูกค้า — ใส่กรอบ/ปิดหน้าให้พร้อมโพส</div>
        </div>
      </div>

      <BranchFilter branches={branches} current={branch} basePath="/owner/marketing" theme="light" />

      {branch && !branchHasFrame.includes(branch) && (
        <div style={{ margin: '12px 16px 0', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', color: '#9a3412' }}>
          สาขานี้ยังไม่ได้อัปโหลดกรอบ — ไปตั้งค่าที่{' '}
          <Link href="/owner/settings" style={{ color: '#9a3412', fontWeight: 700 }}>Settings</Link>
        </div>
      )}

      <div style={{ margin: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingBottom: '24px' }}>
        {photos.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#9ca3af', fontSize: '13px', padding: '40px 0' }}>
            ยังไม่มีรูปในคิว — รูปคู่รถจากการส่งรถจะเข้ามาที่นี่อัตโนมัติ
          </div>
        ) : photos.map(p => (
          <PhotoCard
            key={p.id} photo={p} hasFrame={branchHasFrame.includes(p.branchId)}
            onChanged={updated => updatePhoto(p.id, updated)}
            onDeleted={() => setPhotos(prev => prev.filter(x => x.id !== p.id))}
          />
        ))}
      </div>
    </div>
  )
}
