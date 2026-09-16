'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { compressImagePng } from '@/lib/compressImage'
import type { BikeModel } from '@/lib/bikeCatalog'

type Branch = { id: string; name: string }
type HotspotModel = { brand: string; model: string }
type Hotspot = { id: string; x_pct: number; y_pct: number; width_pct: number; height_pct: number; models: HotspotModel[] }
type PendingRegion = { xPct: number; yPct: number; widthPct: number; heightPct: number }

// ขนาดกากบาทตายตัวทุกรุ่น — กันปัญหาลากกรอบเองแล้วขนาดไม่เท่ากันระหว่างรุ่น
const MARK_WIDTH_PCT = 16
const MARK_HEIGHT_PCT = 16

export default function PosterSetupClient({ branch, templateUrl, xMarkUrl, models, hotspots }: {
  branch: Branch
  templateUrl: string | null
  xMarkUrl: string | null
  models: BikeModel[]
  hotspots: Hotspot[]
}) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [uploadingXMark, setUploadingXMark] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDraggingPoint, setIsDraggingPoint] = useState(false)
  const [pendingRegion, setPendingRegion] = useState<PendingRegion | null>(null)
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const uploadTemplate = async (file: File) => {
    setUploading(true)
    try {
      const compressed = await compressImagePng(file)
      const fd = new FormData()
      fd.append('file', new File([compressed], 'template.png', { type: 'image/png' }))
      fd.append('folder', 'poster-templates')
      const res = await fetch('/api/owner/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      const saveRes = await fetch('/api/owner/settings/poster-template', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: branch.id, imageUrl: data.url, field: 'poster_template_url' }),
      })
      if (!saveRes.ok) throw new Error('บันทึกรูปไม่สำเร็จ')
      router.refresh()
    } catch (e) {
      setMsg('❌ ' + (e instanceof Error ? e.message : 'อัพโหลดไม่สำเร็จ'))
      setTimeout(() => setMsg(''), 4000)
    } finally {
      setUploading(false)
    }
  }

  const uploadXMark = async (file: File) => {
    setUploadingXMark(true)
    try {
      const compressed = await compressImagePng(file)
      const fd = new FormData()
      fd.append('file', new File([compressed], 'xmark.png', { type: 'image/png' }))
      fd.append('folder', 'poster-templates')
      const res = await fetch('/api/owner/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      const saveRes = await fetch('/api/owner/settings/poster-template', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: branch.id, imageUrl: data.url, field: 'poster_x_mark_url' }),
      })
      if (!saveRes.ok) throw new Error('บันทึกรูปไม่สำเร็จ')
      router.refresh()
    } catch (e) {
      setMsg('❌ ' + (e instanceof Error ? e.message : 'อัพโหลดไม่สำเร็จ'))
      setTimeout(() => setMsg(''), 4000)
    } finally {
      setUploadingXMark(false)
    }
  }

  const getPct = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect()
    return {
      x: Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)),
    }
  }

  const centeredRegion = (cx: number, cy: number): PendingRegion => ({
    xPct: Math.min(100 - MARK_WIDTH_PCT, Math.max(0, cx - MARK_WIDTH_PCT / 2)),
    yPct: Math.min(100 - MARK_HEIGHT_PCT, Math.max(0, cy - MARK_HEIGHT_PCT / 2)),
    widthPct: MARK_WIDTH_PCT,
    heightPct: MARK_HEIGHT_PCT,
  })

  const onPointerDown = (e: React.PointerEvent) => {
    if (pendingRegion) return // ยังไม่จบตำแหน่งก่อนหน้า วางใหม่ไม่ได้
    const p = getPct(e.clientX, e.clientY)
    setPendingRegion(centeredRegion(p.x, p.y))
    setIsDraggingPoint(true)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingPoint) return
    const p = getPct(e.clientX, e.clientY)
    setPendingRegion(centeredRegion(p.x, p.y))
  }
  const onPointerUp = () => {
    setIsDraggingPoint(false)
  }

  const toggleModel = (key: string) => {
    setSelectedModels(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const saveHotspot = async () => {
    if (!pendingRegion || selectedModels.size === 0) { setMsg('❌ กรุณาเลือกรุ่นอย่างน้อย 1 รุ่น'); return }
    setSaving(true)
    const modelsPayload = Array.from(selectedModels).map(key => {
      const [brand, model] = key.split('||')
      return { brand, model }
    })
    const res = await fetch('/api/owner/settings/poster-hotspots', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: branch.id, models: modelsPayload, ...pendingRegion }),
    })
    setSaving(false)
    if (res.ok) {
      setPendingRegion(null); setSelectedModels(new Set())
      router.refresh()
    } else {
      const data = await res.json().catch(() => null)
      setMsg('❌ ' + (data?.error ?? 'บันทึกไม่สำเร็จ'))
      setTimeout(() => setMsg(''), 4000)
    }
  }

  const deleteHotspot = async (id: string) => {
    if (!confirm('ลบตำแหน่งนี้?')) return
    await fetch('/api/owner/settings/poster-hotspots', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    router.refresh()
  }

  const brandChoices = Array.from(new Set(models.map(m => m.brand))).sort()

  return (
    <>
      <div className="app-header" style={{ background: '#111827' }}>
        <Link href="/owner/settings/poster-setup" className="app-header-back">←</Link>
        <div style={{ flex: 1 }}>
          <h1>🖼️ {branch.name}</h1>
          <div className="sub">ตั้งค่าตำแหน่งรุ่นบนโปสเตอร์</div>
        </div>
      </div>

      <div style={{ padding: '12px 16px 40px' }}>
        {!templateUrl ? (
          <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px',
            border: '1.5px dashed #d1d5db', borderRadius: '12px', cursor: 'pointer', fontSize: '13px', color: '#9ca3af',
          }}>
            {uploading ? 'กำลังอัพโหลด...' : '+ อัพโหลดรูปโปสเตอร์ต้นฉบับ (ไม่มีกากบาท)'}
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadTemplate(f) }} />
          </label>
        ) : (
          <>
            <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '10px 12px', fontSize: '12px', color: '#1e40af', marginBottom: '10px' }}>
              แตะ/คลิกตรงตำแหน่งรุ่นบนรูป (ลากปรับตำแหน่งได้ก่อนปล่อยนิ้ว) ขนาดกากบาทจะเท่ากันทุกรุ่นอัตโนมัติ แล้วเลือกว่าจุดนี้คือรุ่นอะไร ทำจนครบทุกรุ่นที่มีบนโปสเตอร์
            </div>
            <div
              ref={containerRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onContextMenu={e => e.preventDefault()}
              style={{ position: 'relative', width: '100%', touchAction: 'none', userSelect: 'none', cursor: pendingRegion ? 'default' : 'crosshair' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={templateUrl} alt="โปสเตอร์" draggable={false} style={{
                width: '100%', display: 'block', borderRadius: '8px', pointerEvents: 'none',
                WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none',
              } as React.CSSProperties} />

              {hotspots.map(h => (
                <div key={h.id} style={{
                  position: 'absolute', left: `${h.x_pct}%`, top: `${h.y_pct}%`,
                  width: `${h.width_pct}%`, height: `${h.height_pct}%`,
                  border: '2px dashed #16a34a',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {xMarkUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={xMarkUrl} alt="ตัวอย่างกากบาท" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                  ) : (
                    <svg viewBox="0 0 100 100" style={{ width: '80%', height: '80%', pointerEvents: 'none' }}>
                      <line x1="10" y1="10" x2="90" y2="90" stroke="#dc2626" strokeWidth="14" strokeLinecap="round" />
                      <line x1="90" y1="10" x2="10" y2="90" stroke="#dc2626" strokeWidth="14" strokeLinecap="round" />
                    </svg>
                  )}
                  <span style={{
                    position: 'absolute', bottom: '-16px', left: '50%', transform: 'translateX(-50%)',
                    background: '#16a34a', color: '#fff', fontSize: '9px', padding: '1px 4px', borderRadius: '3px',
                    whiteSpace: 'nowrap', pointerEvents: 'none',
                  }}>
                    {h.models.map(m => m.model).join(', ')}
                  </span>
                </div>
              ))}

              {pendingRegion && (
                <div style={{
                  position: 'absolute', left: `${pendingRegion.xPct}%`, top: `${pendingRegion.yPct}%`,
                  width: `${pendingRegion.widthPct}%`, height: `${pendingRegion.heightPct}%`,
                  border: '2px solid #dc2626', background: 'rgba(220,38,38,.15)',
                }} />
              )}
            </div>

            {pendingRegion && (
              <div style={{ marginTop: '10px', background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '12px', color: '#374151', marginBottom: '4px', fontWeight: 700 }}>จุดนี้คือรุ่นอะไร? (เลือกได้หลายรุ่น ถ้าราคาเท่ากันใช้จุดร่วมกันได้ — กากบาทเมื่อทุกรุ่นในจุดนี้หมดพร้อมกัน)</div>
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', marginBottom: '8px', background: '#fff' }}>
                  {brandChoices.map(brand => (
                    <div key={brand} style={{ marginBottom: '6px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', marginBottom: '2px' }}>{brand}</div>
                      {models.filter(m => m.brand === brand).map(m => {
                        const key = `${brand}||${m.name}`
                        return (
                          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '3px 0', cursor: 'pointer' }}>
                            <input type="checkbox" checked={selectedModels.has(key)} onChange={() => toggleModel(key)} />
                            {m.name}
                          </label>
                        )
                      })}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={saveHotspot} disabled={saving} className="btn btn-primary" style={{ flex: 1, padding: '8px', fontSize: '13px' }}>
                    {saving ? '⏳' : '💾 บันทึกตำแหน่งนี้'}
                  </button>
                  <button onClick={() => { setPendingRegion(null); setSelectedModels(new Set()) }} style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}

            {msg && <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '8px' }}>{msg}</div>}

            <div style={{ marginTop: '16px', border: '1.5px solid #e5e7eb', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>รูปกากบาท (ไม่บังคับ)</div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px' }}>
                ถ้าไม่อัพโหลด จะใช้กากบาทสีแดงมาตรฐานแทน
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {xMarkUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={xMarkUrl} alt="รูปกากบาท" style={{ width: '48px', height: '48px', objectFit: 'contain', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }} />
                )}
                <label style={{ fontSize: '12px', color: '#2563eb', cursor: 'pointer' }}>
                  {uploadingXMark ? 'กำลังอัพโหลด...' : xMarkUrl ? '🔄 เปลี่ยนรูปกากบาท' : '+ อัพโหลดรูปกากบาท'}
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadXMark(f) }} />
                </label>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>ตำแหน่งที่ตั้งไว้ ({hotspots.length})</div>
              {hotspots.map(h => (
                <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: '12px' }}>
                  <span>{h.models.map(m => `${m.brand} ${m.model}`).join(', ')}</span>
                  <button onClick={() => deleteHotspot(h.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '11px', cursor: 'pointer' }}>🗑️ ลบ</button>
                </div>
              ))}
            </div>

            <label style={{ display: 'block', marginTop: '16px', textAlign: 'center', fontSize: '12px', color: '#2563eb', cursor: 'pointer' }}>
              {uploading ? 'กำลังอัพโหลด...' : '🔄 เปลี่ยนรูปโปสเตอร์ต้นฉบับ'}
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadTemplate(f) }} />
            </label>
          </>
        )}
      </div>
    </>
  )
}
