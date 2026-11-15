'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { BranchFilter } from '@/components/BranchFilter'
import { CopyButton } from '@/components/staff/CopyBlock'

type Captions = { facebook: string; instagram: string; tiktok: string }
const CAPTION_TABS: { key: keyof Captions; label: string }[] = [
  { key: 'facebook', label: 'เพจ Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
]

export type MarketingPhoto = {
  id: string
  branchId: string
  originalUrl: string
  processedUrl: string | null
  processedUrl2: string | null // ภาพกรอบรวมสาขา (IG/TikTok) — มีเฉพาะสาขาที่ตั้งกรอบรวมไว้
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

function PhotoCard({ photo, hasFrame, hasFrame2, selectMode, selected, onToggleSelect, onChanged }: {
  photo: MarketingPhoto
  hasFrame: boolean
  hasFrame2: boolean
  selectMode: boolean
  selected: boolean
  onToggleSelect: () => void
  onChanged: (updated: Partial<MarketingPhoto>) => void
  onDeleted: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [variant, setVariant] = useState<1 | 2>(1) // 1 = กรอบสาขา (เพจ) 2 = กรอบรวม (IG/TikTok)
  const [adjusting, setAdjusting] = useState(false)
  const [points, setPoints] = useState<Point[]>([])
  // เลื่อนเลือกส่วนของรูปที่จะอยู่ในกรอบ (0-1) — ไม่จำค่าเดิม เริ่มที่กึ่งกลางทุกครั้งที่กดปรับ
  const [cropPos, setCropPos] = useState(0.5)
  const [frameAspect, setFrameAspect] = useState<number | null>(null)
  const [imgAspect, setImgAspect] = useState<number | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // ใส่กรอบอัตโนมัติทันทีที่รูปเข้าคิว — ไม่ต้องกดเอง กดแค่ตอนอยากปรับตำแหน่งสติ๊กเกอร์
  // รูปที่ทำกรอบสาขาไปแล้วแต่ยังไม่มีกรอบรวม (เช่น เพิ่งตั้งกรอบรวม) — ทำเฉพาะกรอบรวมเพิ่มให้เอง ไม่แตะรูปกรอบสาขาเดิม
  useEffect(() => {
    if (!photo.processedUrl && hasFrame) process()
    else if (photo.processedUrl && hasFrame2 && !photo.processedUrl2) process(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.id])

  const process = async (onlySecond = false) => {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/owner/marketing/process', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId: photo.id, onlySecond }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (onlySecond) onChanged({ processedUrl2: data.processedUrl2 })
      else onChanged({ processedUrl: data.processedUrl, processedUrl2: data.processedUrl2 ?? null, stickerX: data.stickerX, stickerY: data.stickerY, stickerX2: data.stickerX2, stickerY2: data.stickerY2 })
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
    setCropPos(0.5)
    // สัดส่วนกรอบอ่านจากรูปที่ใส่กรอบแล้ว (ปุ่มปรับมีให้กดเฉพาะตอนมีรูปผลลัพธ์แล้ว)
    if (photo.processedUrl) {
      const im = new window.Image()
      im.onload = () => setFrameAspect(im.naturalWidth / im.naturalHeight)
      im.src = photo.processedUrl
    }
    setAdjusting(true)
  }

  // ช่วงของรูปต้นฉบับที่จะโผล่ในกรอบ: รูปสูงกว่ากรอบ → ตัดบน/ล่าง, กว้างกว่ากรอบ → ตัดซ้าย/ขวา
  const crop = (() => {
    if (!frameAspect || !imgAspect || Math.abs(imgAspect - frameAspect) < 0.01) return null
    return imgAspect < frameAspect
      ? { axis: 'y' as const, visible: imgAspect / frameAspect }
      : { axis: 'x' as const, visible: frameAspect / imgAspect }
  })()

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
        body: JSON.stringify({ photoId: photo.id, positions: points, cropPos }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onChanged({ processedUrl: data.processedUrl, processedUrl2: data.processedUrl2 ?? null, stickerX: data.stickerX, stickerY: data.stickerY, stickerX2: data.stickerX2, stickerY2: data.stickerY2 })
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
    // ตอนปรับตำแหน่งให้การ์ดกว้างเต็มแถว รูปใหญ่ขึ้นจะแตะโดนหน้าแม่นขึ้น โดยเฉพาะรูปแนวตั้ง
    <div
      onClick={selectMode && photo.processedUrl ? onToggleSelect : undefined}
      style={{
        background: '#fff', borderRadius: '14px', overflow: 'hidden', position: 'relative',
        boxShadow: selected ? '0 0 0 3px #16a34a' : '0 1px 4px rgba(0,0,0,.07)', gridColumn: adjusting ? '1 / -1' : undefined,
        cursor: selectMode && photo.processedUrl ? 'pointer' : undefined,
      }}
    >
      {selectMode && photo.processedUrl && (
        <div style={{
          position: 'absolute', top: '8px', left: '8px', zIndex: 2, width: '26px', height: '26px', borderRadius: '50%',
          background: selected ? '#16a34a' : 'rgba(255,255,255,.85)', border: `2px solid ${selected ? '#16a34a' : '#9ca3af'}`,
          color: '#fff', fontSize: '15px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{selected ? '✓' : ''}</div>
      )}
      {adjusting ? (
        <div style={{ position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef} src={photo.originalUrl} alt="ต้นฉบับ" onClick={e => tapAt(e.clientX, e.clientY)}
            onLoad={e => setImgAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
            style={{ width: '100%', display: 'block', cursor: busy ? 'wait' : 'crosshair', opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto' }}
          />
          {/* ส่วนมืด = ส่วนที่จะถูกตัดออกตอนใส่กรอบ */}
          {crop && (['before', 'after'] as const).map(side => {
            const share = (1 - crop.visible) * (side === 'before' ? cropPos : 1 - cropPos) * 100
            const style: React.CSSProperties = { position: 'absolute', background: 'rgba(0,0,0,.5)', pointerEvents: 'none' }
            if (crop.axis === 'y') Object.assign(style, { left: 0, right: 0, height: `${share}%`, ...(side === 'before' ? { top: 0 } : { bottom: 0 }) })
            else Object.assign(style, { top: 0, bottom: 0, width: `${share}%`, ...(side === 'before' ? { left: 0 } : { right: 0 }) })
            return <div key={side} style={style} />
          })}
          {points.map((p, i) => (
            <div key={i} style={{
              position: 'absolute', left: `${p.x * 100}%`, top: `${p.y * 100}%`,
              width: '24px', height: '24px', marginLeft: '-12px', marginTop: '-12px',
              border: '2px solid #e11d48', borderRadius: '50%', pointerEvents: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(225,29,72,.15)', color: '#e11d48', fontSize: '11px', fontWeight: 800,
            }}>{i + 1}</div>
          ))}
        </div>
      ) : photo.processedUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={variant === 2 && photo.processedUrl2 ? photo.processedUrl2 : photo.processedUrl} alt="ผลลัพธ์" style={{ width: '100%', display: 'block' }} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.originalUrl} alt="ต้นฉบับ" style={{ width: '100%', display: 'block', opacity: 0.7 }} />
      )}

      <div style={{ padding: '10px' }}>
        {photo.processedUrl && !adjusting && hasFrame2 && (
          // สลับดูทั้งสองแบบ: เพจ = กรอบสาขา, IG/TikTok = กรอบรวมสาขา
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }} onClick={e => e.stopPropagation()}>
            {([[1, 'เพจ'], [2, 'IG/TikTok']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setVariant(v)} style={{
                flex: 1, padding: '5px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                border: `1.5px solid ${variant === v ? '#111827' : '#e5e7eb'}`, background: variant === v ? '#111827' : '#fff', color: variant === v ? '#fff' : '#6b7280',
              }}>{label}{v === 2 && !photo.processedUrl2 ? ' ⏳' : ''}</button>
            ))}
          </div>
        )}
        {photo.processedUrl && !adjusting && (
          <div style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', marginBottom: '8px' }}>กดค้างที่รูปเพื่อบันทึกลงเครื่องได้เลย</div>
        )}
        <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px' }}>{fmtDate(photo.createdAt)}</div>
        {error && <div style={{ fontSize: '11px', color: '#dc2626', marginBottom: '8px' }}>{error}</div>}
        {/* คำอธิบายอยู่ใต้รูป ไม่ซ้อนบนรูป — เคยวางทับด้านบนแล้วบังหน้าคนในรูปแนวตั้งจนแตะเลือกจุดไม่ได้ */}
        {adjusting && (
          <div style={{ background: '#111827', color: '#fff', fontSize: '12px', padding: '8px 10px', borderRadius: '8px', textAlign: 'center', marginBottom: '8px' }}>
            {busy ? '⏳ กำลังบันทึก...'
              : points.length === 0 ? 'แตะตำแหน่งใบหน้าบนรูป (สูงสุด 2 จุด)'
              : points.length === 1 ? 'แตะเพิ่มอีกจุดได้ (ถ้ามี) หรือกดบันทึก'
              : 'ครบ 2 จุดแล้ว — แตะจุดเดิมเพื่อลบ หรือกดบันทึก'}
          </div>
        )}

        {adjusting && crop && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
              เลื่อนเลือกส่วนที่จะอยู่ในกรอบ ({crop.axis === 'y' ? 'ขึ้น-ลง' : 'ซ้าย-ขวา'}) — ส่วนที่มืดจะถูกตัดออก
            </div>
            <input
              type="range" min={0} max={100} value={Math.round(cropPos * 100)} disabled={busy}
              onChange={e => setCropPos(Number(e.target.value) / 100)} style={{ width: '100%' }}
            />
          </div>
        )}

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
          <button onClick={() => process()} disabled={busy || !hasFrame} style={{
            width: '100%', padding: '8px', borderRadius: '8px', border: 'none',
            background: hasFrame ? '#111827' : '#d1d5db', color: '#fff', fontSize: '12px', fontWeight: 700,
            cursor: hasFrame ? 'pointer' : 'default',
          }}>{busy ? '⏳ กำลังทำ...' : hasFrame ? '🖼️ ใส่กรอบ' : 'ยังไม่ตั้งค่ากรอบ'}</button>
        ) : (
          <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
            {hasFrame2 && photo.processedUrl2 ? (
              <>
                <a href={photo.processedUrl} download target="_blank" rel="noreferrer" style={{
                  flex: 1, padding: '8px 4px', borderRadius: '8px', border: 'none', textAlign: 'center',
                  background: '#16a34a', color: '#fff', fontSize: '11px', fontWeight: 700, textDecoration: 'none',
                }}>📥 เพจ</a>
                <a href={photo.processedUrl2} download target="_blank" rel="noreferrer" style={{
                  flex: 1, padding: '8px 4px', borderRadius: '8px', border: 'none', textAlign: 'center',
                  background: '#2563eb', color: '#fff', fontSize: '11px', fontWeight: 700, textDecoration: 'none',
                }}>📥 IG/TikTok</a>
              </>
            ) : (
              <a href={photo.processedUrl} download target="_blank" rel="noreferrer" style={{
                flex: 1, padding: '8px', borderRadius: '8px', border: 'none', textAlign: 'center',
                background: '#16a34a', color: '#fff', fontSize: '12px', fontWeight: 700, textDecoration: 'none',
              }}>📥 โหลด</a>
            )}
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

// staffMode = หน้าฝั่งพนักงาน: ไม่มีตัวเลือกสาขา (เห็นแค่สาขาตัวเอง — เซิร์ฟเวอร์กรองให้แล้ว) และกลับไปหน้าหลักพนักงาน
export default function MarketingClient({ photos: initialPhotos, branches, branch, branchHasFrame, branchHasFrame2 = [], captions = null, staffMode = false }: {
  photos: MarketingPhoto[]
  branches: { id: string; name: string }[]
  branch: string
  branchHasFrame: string[]
  branchHasFrame2?: string[]
  captions?: Captions | null   // แคปชั่นสำหรับโพสต์ของสาขานี้ (เจ้าของตั้งในหน้าตั้งค่า) — ช่องไหนว่างไม่ขึ้นแท็บ
  staffMode?: boolean
}) {
  const [photos, setPhotos] = useState(initialPhotos)

  // ── แคปชั่นสำหรับโพสต์ — ป๊อปอัพแผงด้านล่าง แท็บตามช่องทาง กดคัดลอกได้ ──
  const captionTabs = captions ? CAPTION_TABS.filter(t => captions[t.key].trim()) : []
  const [captionOpen, setCaptionOpen] = useState(false)
  const [captionTab, setCaptionTab] = useState<keyof Captions | null>(null)
  const activeCaptionTab = captionTab && captionTabs.some(t => t.key === captionTab) ? captionTab : captionTabs[0]?.key ?? null

  const updatePhoto = (id: string, updated: Partial<MarketingPhoto>) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p))
  }

  // ── เลือกหลายรูปแล้วเซฟรวดเดียว (เฉพาะสาขาที่ตั้งกรอบรวม) ──
  // ใช้หน้าต่างแชร์ของมือถือ (Web Share ส่งไฟล์) — ต้องเรียกใน "การกดของผู้ใช้" ทันที (iPhone ไม่ยอมถ้าต้องรอโหลดไฟล์ก่อน)
  // เลยโหลดไฟล์ของรูปที่ติ๊กไว้ล่วงหน้าตั้งแต่ตอนติ๊ก พอกดปุ่มไฟล์พร้อมแล้ว เครื่องที่แชร์ไฟล์ไม่ได้ก็ใช้ปุ่มโหลดทีละรูปเหมือนเดิม
  const anyFrame2 = branchHasFrame2.length > 0
  const [canShareFiles, setCanShareFiles] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [readyIds, setReadyIds] = useState<Set<string>>(new Set())
  const [shareMsg, setShareMsg] = useState('')
  const filesRef = useRef<Map<string, File[]>>(new Map())

  useEffect(() => {
    try {
      const probe = new File([new Blob(['x'])], 'a.jpg', { type: 'image/jpeg' })
      setCanShareFiles(typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] }))
    } catch { setCanShareFiles(false) }
  }, [])

  const prefetchFiles = async (p: MarketingPhoto) => {
    if (filesRef.current.has(p.id) || !p.processedUrl) return
    try {
      const day = new Date(p.createdAt).toISOString().slice(0, 10).replace(/-/g, '')
      const urls = [{ url: p.processedUrl, tag: 'page' }, ...(p.processedUrl2 ? [{ url: p.processedUrl2, tag: 'ig' }] : [])]
      const files: File[] = []
      for (const u of urls) {
        const res = await fetch(u.url)
        if (!res.ok) throw new Error('โหลดรูปไม่สำเร็จ')
        files.push(new File([await res.blob()], `kuma-${day}-${p.id.slice(0, 6)}-${u.tag}.jpg`, { type: 'image/jpeg' }))
      }
      filesRef.current.set(p.id, files)
      setReadyIds(prev => new Set(prev).add(p.id))
    } catch {
      setShareMsg('โหลดรูปเตรียมเซฟไม่สำเร็จ — ใช้ปุ่มโหลดทีละรูปแทนได้')
    }
  }

  const toggleSelect = (p: MarketingPhoto) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(p.id)) next.delete(p.id)
      else { next.add(p.id); void prefetchFiles(p) }
      return next
    })
  }

  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); setShareMsg('') }

  const shareSelected = async () => {
    const files = photos.filter(p => selected.has(p.id)).flatMap(p => filesRef.current.get(p.id) ?? [])
    if (files.length === 0) return
    try {
      await navigator.share({ files })
      exitSelect()
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return // ผู้ใช้กดยกเลิกเอง
      setShareMsg('เซฟรวดเดียวไม่สำเร็จ — ใช้ปุ่มโหลดทีละรูปแทนได้')
    }
  }

  const selectedPhotos = photos.filter(p => selected.has(p.id))
  const allReady = selectedPhotos.length > 0 && selectedPhotos.every(p => readyIds.has(p.id))
  const imageCount = selectedPhotos.reduce((n, p) => n + (p.processedUrl2 ? 2 : 1), 0)

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: '#111827', alignItems: 'center' }}>
        <Link href={staffMode ? '/staff/home' : '/owner/dashboard'} className="app-header-back">←</Link>
        <div style={{ flex: 1 }}>
          <h1>🖼️ รูปโปรโมท</h1>
          <div className="sub">รูปคู่รถลูกค้า — ใส่กรอบ/ปิดหน้าให้พร้อมโพส</div>
        </div>
      </div>

      {captionTabs.length > 0 && (
        <div style={{ margin: '12px 16px 0' }}>
          <button onClick={() => setCaptionOpen(true)} style={{
            width: '100%', padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            border: '1.5px solid #2563eb', background: '#eff6ff', color: '#2563eb',
          }}>📝 แคปชั่นสำหรับโพสต์</button>
        </div>
      )}

      {anyFrame2 && canShareFiles && photos.some(p => p.processedUrl) && (
        <div style={{ margin: '12px 16px 0' }}>
          <button onClick={() => (selectMode ? exitSelect() : setSelectMode(true))} style={{
            width: '100%', padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            border: '1.5px solid #111827', background: selectMode ? '#111827' : '#fff', color: selectMode ? '#fff' : '#111827',
          }}>{selectMode ? '✕ เลิกเลือก' : '☑️ เลือกหลายรูป เซฟทีเดียว'}</button>
          {shareMsg && <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '6px' }}>{shareMsg}</div>}
        </div>
      )}

      {!staffMode && <BranchFilter branches={branches} current={branch} basePath="/owner/marketing" theme="light" />}

      {branch && !branchHasFrame.includes(branch) && (
        <div style={{ margin: '12px 16px 0', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', color: '#9a3412' }}>
          {staffMode ? (
            'สาขานี้ยังไม่ได้อัปโหลดกรอบ — ทักหาผู้จัดการให้ตั้งค่ากรอบก่อน'
          ) : (
            <>
              สาขานี้ยังไม่ได้อัปโหลดกรอบ — ไปตั้งค่าที่{' '}
              <Link href="/owner/settings" style={{ color: '#9a3412', fontWeight: 700 }}>Settings</Link>
            </>
          )}
        </div>
      )}

      <div style={{ margin: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingBottom: '24px' }}>
        {photos.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#9ca3af', fontSize: '13px', padding: '40px 0' }}>
            ยังไม่มีรูปในคิว — รูปคู่รถจากการส่งรถจะเข้ามาที่นี่อัตโนมัติ
          </div>
        ) : photos.map(p => (
          <PhotoCard
            key={p.id} photo={p} hasFrame={branchHasFrame.includes(p.branchId)} hasFrame2={branchHasFrame2.includes(p.branchId)}
            selectMode={selectMode} selected={selected.has(p.id)} onToggleSelect={() => toggleSelect(p)}
            onChanged={updated => {
              // รูปที่ติ๊กไว้แล้วถูกทำใหม่ (ปรับตำแหน่ง) — ไฟล์ที่โหลดเตรียมไว้เป็นของเก่า ทิ้งแล้วโหลดใหม่
              filesRef.current.delete(p.id)
              setReadyIds(prev => { const n = new Set(prev); n.delete(p.id); return n })
              updatePhoto(p.id, updated)
              if (selected.has(p.id)) void prefetchFiles({ ...p, ...updated })
            }}
            onDeleted={() => setPhotos(prev => prev.filter(x => x.id !== p.id))}
          />
        ))}
      </div>

      {captionOpen && captions && activeCaptionTab && (
        <div onClick={() => setCaptionOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(17,24,39,.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: '430px', maxHeight: '80vh', overflowY: 'auto', background: '#fff', borderRadius: '20px 20px 0 0',
            padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ flex: 1, fontSize: '16px', fontWeight: 800, color: '#111827' }}>📝 แคปชั่นสำหรับโพสต์</div>
              <button onClick={() => setCaptionOpen(false)} style={{ border: 'none', background: '#f3f4f6', borderRadius: '50%', width: '32px', height: '32px', fontSize: '16px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              {captionTabs.map(t => (
                <button key={t.key} onClick={() => setCaptionTab(t.key)} style={{
                  flex: 1, padding: '8px 4px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  border: `1.5px solid ${activeCaptionTab === t.key ? '#111827' : '#e5e7eb'}`,
                  background: activeCaptionTab === t.key ? '#111827' : '#fff', color: activeCaptionTab === t.key ? '#fff' : '#6b7280',
                }}>{t.label}</button>
              ))}
            </div>
            <div style={{
              background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px', marginBottom: '12px',
              fontSize: '14px', lineHeight: 1.7, color: '#111827', whiteSpace: 'pre-wrap', userSelect: 'text',
            }}>{captions[activeCaptionTab]}</div>
            <CopyButton text={captions[activeCaptionTab]} label="📋 คัดลอกแคปชั่น" />
          </div>
        </div>
      )}

      {selectMode && (
        <div style={{
          position: 'sticky', bottom: 0, padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
          background: '#fff', borderTop: '1px solid #e5e7eb', boxShadow: '0 -4px 12px rgba(0,0,0,.08)',
        }}>
          <button onClick={shareSelected} disabled={!allReady} style={{
            width: '100%', padding: '14px', borderRadius: '12px', border: 'none', fontSize: '15px', fontWeight: 800, fontFamily: 'inherit',
            background: allReady ? '#16a34a' : '#e5e7eb', color: allReady ? '#fff' : '#9ca3af', cursor: allReady ? 'pointer' : 'default',
          }}>
            {selectedPhotos.length === 0
              ? 'แตะรูปที่ต้องการเซฟ'
              : allReady
                ? `💾 บันทึก ${selectedPhotos.length} รูป (${imageCount} ภาพ)`
                : '⏳ กำลังเตรียมรูป...'}
          </button>
          <div style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', marginTop: '6px' }}>
            กดแล้วเลือก “บันทึกรูปภาพ” ในหน้าต่างที่เด้งขึ้นมา
          </div>
        </div>
      )}
    </div>
  )
}
