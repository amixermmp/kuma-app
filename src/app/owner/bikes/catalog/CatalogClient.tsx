'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BikeModel } from '@/lib/bikeCatalog'

export default function CatalogClient({ brands, models }: { brands: string[]; models: BikeModel[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [newBrand, setNewBrand] = useState('')
  const [newModel, setNewModel] = useState<Record<string, string>>({})

  const call = async (method: 'POST' | 'DELETE', body: object) => {
    setBusy(true); setErr('')
    try {
      const res = await fetch('/api/owner/catalog', {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'เกิดข้อผิดพลาด'); return false }
      router.refresh()
      return true
    } finally { setBusy(false) }
  }

  const addBrand = async () => { if (await call('POST', { type: 'brand', name: newBrand })) setNewBrand('') }
  const addModel = async (brand: string) => {
    const name = newModel[brand] ?? ''
    if (await call('POST', { type: 'model', brand, name })) setNewModel(p => ({ ...p, [brand]: '' }))
  }

  return (
    <div className="section-pad" style={{ paddingTop: '12px' }}>
      {err && (
        <div style={{ color: '#dc2626', fontSize: '13px', padding: '10px', background: '#fef2f2', borderRadius: '10px', marginBottom: '12px' }}>⚠️ {err}</div>
      )}

      {/* เพิ่มยี่ห้อ */}
      <div className="card" style={{ marginBottom: '12px', padding: '12px 14px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>+ เพิ่มยี่ห้อใหม่</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input className="field-input" style={{ flex: 1 }} placeholder="เช่น Honda" value={newBrand} onChange={e => setNewBrand(e.target.value)} />
          <button className="btn btn-primary" disabled={busy || !newBrand.trim()} onClick={addBrand} style={{ whiteSpace: 'nowrap' }}>เพิ่ม</button>
        </div>
      </div>

      {/* รายยี่ห้อ + รุ่น */}
      {brands.map(brand => {
        const brandModels = models.filter(m => m.brand === brand)
        return (
          <div key={brand} className="card" style={{ marginBottom: '10px', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#111827', flex: 1 }}>🏍️ {brand}</span>
              <button disabled={busy} onClick={() => call('DELETE', { type: 'brand', brand })}
                style={{ color: '#dc2626', background: 'none', border: 'none', fontSize: '13px', cursor: 'pointer' }}>ลบยี่ห้อ</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
              {brandModels.length === 0 && <div style={{ fontSize: '12px', color: '#9ca3af' }}>ยังไม่มีรุ่น</div>}
              {brandModels.map(m => (
                <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#f9fafb', borderRadius: '8px' }}>
                  <span style={{ flex: 1, fontSize: '13px', color: '#374151' }}>{m.name}</span>
                  <button disabled={busy} onClick={() => call('DELETE', { type: 'model', brand, name: m.name })}
                    style={{ color: '#9ca3af', background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input className="field-input" style={{ flex: 1 }} placeholder="+ เพิ่มรุ่น"
                value={newModel[brand] ?? ''} onChange={e => setNewModel(p => ({ ...p, [brand]: e.target.value }))} />
              <button className="btn" disabled={busy || !(newModel[brand] ?? '').trim()} onClick={() => addModel(brand)}
                style={{ whiteSpace: 'nowrap', border: '1.5px solid #111827', color: '#111827' }}>เพิ่มรุ่น</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
