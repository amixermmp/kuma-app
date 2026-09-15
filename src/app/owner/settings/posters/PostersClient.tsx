'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SettingsHeader } from '../_shared'
import { compressImagePng } from '@/lib/compressImage'

type Branch = { id: string; name: string }
type Poster = { id: string; branch_id: string; image_url: string; out_of_stock_models: string[] }

function modelLabel(key: string) {
  const [brand, model] = key.split('||')
  return `${brand} ${model}`
}

function AddPosterForm({ branchId, models }: { branchId: string; models: string[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const toggle = (key: string) =>
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const compressed = await compressImagePng(file)
      const fd = new FormData()
      fd.append('file', new File([compressed], 'poster.png', { type: 'image/png' }))
      fd.append('folder', 'availability-posters')
      const res = await fetch('/api/owner/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setImageUrl(data.url)
    } catch (e) {
      setMsg('❌ ' + (e instanceof Error ? e.message : 'อัพโหลดไม่สำเร็จ'))
      setTimeout(() => setMsg(''), 4000)
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    if (!imageUrl) { setMsg('❌ กรุณาอัพโหลดรูปก่อน'); return }
    setSaving(true)
    const res = await fetch('/api/owner/settings/posters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId, imageUrl, outOfStockModels: selected }),
    })
    setSaving(false)
    if (res.ok) {
      setImageUrl(''); setSelected([]); setOpen(false)
      router.refresh()
    } else {
      const data = await res.json().catch(() => null)
      setMsg('❌ ' + (data?.error ?? 'บันทึกไม่สำเร็จ'))
      setTimeout(() => setMsg(''), 4000)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn" style={{ width: '100%', padding: '10px', fontSize: '13px' }}>
        + เพิ่มโปสเตอร์ใหม่
      </button>
    )
  }

  return (
    <div style={{ border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '14px', background: '#f9fafb' }}>
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>รูปโปสเตอร์ (กากบาทแล้ว)</div>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="โปสเตอร์" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }} />
        ) : (
          <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px',
            border: '1.5px dashed #d1d5db', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: '#9ca3af',
          }}>
            {uploading ? 'กำลังอัพโหลด...' : '+ อัพโหลดรูป'}
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }} />
          </label>
        )}
      </div>

      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px' }}>ติ๊กรุ่นที่ "หมด" ในรูปนี้ (ไม่ติ๊ก = ว่างทุกรุ่น)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {models.map(key => (
            <label key={key} style={{
              display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px',
              background: selected.includes(key) ? '#fee2e2' : '#fff',
              color: selected.includes(key) ? '#b91c1c' : '#374151',
              border: '1px solid #e5e7eb', borderRadius: '8px', padding: '5px 8px', cursor: 'pointer',
            }}>
              <input type="checkbox" checked={selected.includes(key)} onChange={() => toggle(key)} style={{ margin: 0 }} />
              {modelLabel(key)}
            </label>
          ))}
        </div>
      </div>

      {msg && <div style={{ fontSize: '12px', color: '#dc2626', marginBottom: '8px' }}>{msg}</div>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={save} disabled={saving || uploading} className="btn btn-primary" style={{ flex: 1, padding: '8px', fontSize: '13px' }}>
          {saving ? '⏳' : '💾 บันทึก'}
        </button>
        <button onClick={() => { setOpen(false); setImageUrl(''); setSelected([]) }} style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>
          ยกเลิก
        </button>
      </div>
    </div>
  )
}

function PosterCard({ poster }: { poster: Poster }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const remove = async () => {
    if (!confirm('ลบโปสเตอร์นี้?')) return
    setDeleting(true)
    await fetch('/api/owner/settings/posters', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: poster.id }),
    })
    router.refresh()
  }

  return (
    <div style={{ border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '10px', marginBottom: '10px', display: 'flex', gap: '10px' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={poster.image_url} alt="โปสเตอร์" style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', color: '#374151', marginBottom: '4px' }}>
          {poster.out_of_stock_models.length === 0
            ? 'ว่างทุกรุ่น'
            : `รุ่นที่หมด: ${poster.out_of_stock_models.map(modelLabel).join(', ')}`}
        </div>
        <button onClick={remove} disabled={deleting} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '11px', cursor: 'pointer', padding: 0 }}>
          {deleting ? 'กำลังลบ...' : '🗑️ ลบ'}
        </button>
      </div>
    </div>
  )
}

function BranchSection({ branch, models, posters }: { branch: Branch; models: string[]; posters: Poster[] }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827', marginBottom: '10px' }}>📍 {branch.name}</div>
      {models.length === 0 ? (
        <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '10px' }}>สาขานี้ยังไม่มีรถในระบบ</div>
      ) : (
        <>
          {posters.map(p => <PosterCard key={p.id} poster={p} />)}
          <AddPosterForm branchId={branch.id} models={models} />
        </>
      )}
    </div>
  )
}

export default function PostersClient({ branches, modelsByBranch, posters }: {
  branches: Branch[]
  modelsByBranch: Record<string, string[]>
  posters: Poster[]
}) {
  return (
    <>
      <SettingsHeader title="🖼️ โปสเตอร์รถว่าง" sub="อัพโหลดรูปที่กากบาทไว้แล้ว + ติ๊กรุ่นที่หมดในรูปนั้น" />
      <div style={{ padding: '12px 16px 40px' }}>
        <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#166534', border: '1px solid #bbf7d0', marginBottom: '16px' }}>
          ระบบจะเลือกโชว์รูปที่ตรงกับรุ่นที่หมดจริงในหน้าค้นหารถของพนักงานให้อัตโนมัติ — ถ้าค้นหาแล้วรุ่นที่หมดไม่ตรงกับรูปไหนเลย จะไม่โชว์รูป
        </div>
        {branches.map(b => (
          <BranchSection
            key={b.id}
            branch={b}
            models={modelsByBranch[b.id] ?? []}
            posters={posters.filter(p => p.branch_id === b.id)}
          />
        ))}
      </div>
    </>
  )
}
