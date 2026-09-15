'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { compressImagePng } from '@/lib/compressImage'
import type { BikeModel } from '@/lib/bikeCatalog'

type Branch = { id: string; name: string }
type Hotspot = { id: string; brand: string; model: string; x_pct: number; y_pct: number; width_pct: number; height_pct: number }
type PendingRegion = { xPct: number; yPct: number; widthPct: number; heightPct: number }

export default function PosterSetupClient({ branch, templateUrl, models, hotspots }: {
  branch: Branch
  templateUrl: string | null
  models: BikeModel[]
  hotspots: Hotspot[]
}) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null)
  const [pendingRegion, setPendingRegion] = useState<PendingRegion | null>(null)
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
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
        body: JSON.stringify({ branchId: branch.id, imageUrl: data.url }),
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

  const getPct = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect()
    return {
      x: Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)),
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (pendingRegion) return // ยังไม่จบกรอบก่อนหน้า วาดใหม่ไม่ได้
    const p = getPct(e.clientX, e.clientY)
    setDragStart(p); setDragCurrent(p)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart) return
    setDragCurrent(getPct(e.clientX, e.clientY))
  }
  const onPointerUp = () => {
    if (!dragStart || !dragCurrent) { setDragStart(null); setDragCurrent(null); return }
    const xPct = Math.min(dragStart.x, dragCurrent.x)
    const yPct = Math.min(dragStart.y, dragCurrent.y)
    const widthPct = Math.abs(dragCurrent.x - dragStart.x)
    const heightPct = Math.abs(dragCurrent.y - dragStart.y)
    setDragStart(null); setDragCurrent(null)
    if (widthPct < 2 || heightPct < 2) return // ลากสั้นเกินไป ถือว่าคลิกพลาด
    setPendingRegion({ xPct, yPct, widthPct, heightPct })
  }

  const saveHotspot = async () => {
    if (!pendingRegion || !selectedBrand || !selectedModel) { setMsg('❌ กรุณาเลือกรุ่น'); return }
    setSaving(true)
    const res = await fetch('/api/owner/settings/poster-hotspots', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: branch.id, brand: selectedBrand, model: selectedModel, ...pendingRegion }),
    })
    setSaving(false)
    if (res.ok) {
      setPendingRegion(null); setSelectedBrand(''); setSelectedModel('')
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
  const modelChoices = models.filter(m => m.brand === selectedBrand).map(m => m.name).sort()

  const previewRect = dragStart && dragCurrent ? {
    left: Math.min(dragStart.x, dragCurrent.x), top: Math.min(dragStart.y, dragCurrent.y),
    width: Math.abs(dragCurrent.x - dragStart.x), height: Math.abs(dragCurrent.y - dragStart.y),
  } : null

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
              ลากบนรูปเพื่อวาดกรอบตำแหน่งรุ่น แล้วเลือกว่ากรอบนี้คือรุ่นอะไร ทำจนครบทุกรุ่นที่มีบนโปสเตอร์
            </div>
            <div
              ref={containerRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              style={{ position: 'relative', width: '100%', touchAction: 'none', userSelect: 'none', cursor: pendingRegion ? 'default' : 'crosshair' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={templateUrl} alt="โปสเตอร์" draggable={false} style={{ width: '100%', display: 'block', borderRadius: '8px' }} />

              {hotspots.map(h => (
                <div key={h.id} style={{
                  position: 'absolute', left: `${h.x_pct}%`, top: `${h.y_pct}%`,
                  width: `${h.width_pct}%`, height: `${h.height_pct}%`,
                  border: '2px solid #16a34a', background: 'rgba(22,163,74,.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ background: '#16a34a', color: '#fff', fontSize: '10px', padding: '2px 5px', borderRadius: '4px' }}>
                    {h.brand} {h.model}
                  </span>
                </div>
              ))}

              {previewRect && (
                <div style={{
                  position: 'absolute', left: `${previewRect.left}%`, top: `${previewRect.top}%`,
                  width: `${previewRect.width}%`, height: `${previewRect.height}%`,
                  border: '2px dashed #dc2626', background: 'rgba(220,38,38,.15)',
                }} />
              )}

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
                <div style={{ fontSize: '12px', color: '#374151', marginBottom: '8px', fontWeight: 700 }}>กรอบนี้คือรุ่นอะไร?</div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <select className="field-input" style={{ flex: 1 }} value={selectedBrand} onChange={e => { setSelectedBrand(e.target.value); setSelectedModel('') }}>
                    <option value="">เลือกยี่ห้อ</option>
                    {brandChoices.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <select className="field-input" style={{ flex: 1 }} value={selectedModel} onChange={e => setSelectedModel(e.target.value)} disabled={!selectedBrand}>
                    <option value="">เลือกรุ่น</option>
                    {modelChoices.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={saveHotspot} disabled={saving} className="btn btn-primary" style={{ flex: 1, padding: '8px', fontSize: '13px' }}>
                    {saving ? '⏳' : '💾 บันทึกตำแหน่งนี้'}
                  </button>
                  <button onClick={() => { setPendingRegion(null); setSelectedBrand(''); setSelectedModel('') }} style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}

            {msg && <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '8px' }}>{msg}</div>}

            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>ตำแหน่งที่ตั้งไว้ ({hotspots.length})</div>
              {hotspots.map(h => (
                <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: '12px' }}>
                  <span>{h.brand} {h.model}</span>
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
