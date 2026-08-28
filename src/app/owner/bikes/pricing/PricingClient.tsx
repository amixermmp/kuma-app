'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BikeModel } from '@/lib/bikeCatalog'
import { BranchFilter } from '@/components/BranchFilter'

type PricingEntry = { dailyRate: number | null; monthlyRate: number | null; promoPayDays: number | null; fuelReferencePhotoUrl?: string | null }
type Branch = { id: string; name: string }

export default function PricingClient({ branches, selectedBranchId, brands, models, pricingByKey }: {
  branches: Branch[]
  selectedBranchId: string
  brands: string[]
  models: BikeModel[]
  pricingByKey: Record<string, PricingEntry>
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const [form, setForm] = useState<Record<string, { daily: string; monthly: string; promo: string }>>(
    Object.fromEntries(models.map(m => {
      const key = `${m.brand}__${m.name}`
      const p = pricingByKey[key]
      return [key, {
        daily: p?.dailyRate != null ? String(p.dailyRate) : '',
        monthly: p?.monthlyRate != null ? String(p.monthlyRate) : '',
        promo: p?.promoPayDays != null ? String(p.promoPayDays) : '',
      }]
    }))
  )
  const [msg, setMsg] = useState<Record<string, string>>({})

  const [fuelPhotos, setFuelPhotos] = useState<Record<string, string>>(
    Object.fromEntries(models.map(m => {
      const key = `${m.brand}__${m.name}`
      return [key, pricingByKey[key]?.fuelReferencePhotoUrl ?? '']
    }))
  )
  const [fuelUploading, setFuelUploading] = useState<Record<string, boolean>>({})

  const uploadFuelPhoto = async (brand: string, name: string, file: File) => {
    const key = `${brand}__${name}`
    setFuelUploading(p => ({ ...p, [key]: true }))
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'fuel-reference')
      const res = await fetch('/api/owner/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setFuelPhotos(p => ({ ...p, [key]: data.url }))
      await fetch('/api/owner/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'branch_pricing', branchId: selectedBranchId, brand, name, fuelReferencePhotoUrl: data.url }),
      })
      setMsg(p => ({ ...p, [key]: '✅' }))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'อัพโหลดไม่สำเร็จ')
    } finally {
      setFuelUploading(p => ({ ...p, [key]: false }))
      setTimeout(() => setMsg(p => ({ ...p, [key]: '' })), 2000)
    }
  }

  const save = async (brand: string, name: string) => {
    const key = `${brand}__${name}`
    const f = form[key] ?? { daily: '', monthly: '', promo: '' }
    setBusy(true); setErr(''); setMsg(p => ({ ...p, [key]: '' }))
    try {
      const res = await fetch('/api/owner/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'branch_pricing',
          branchId: selectedBranchId,
          brand, name,
          dailyRate: f.daily.trim() === '' ? null : f.daily,
          monthlyRate: f.monthly.trim() === '' ? null : f.monthly,
          promoPayDays: f.promo.trim() === '' ? null : f.promo,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'เกิดข้อผิดพลาด'); setMsg(p => ({ ...p, [key]: '❌' })); return }
      setMsg(p => ({ ...p, [key]: '✅' }))
      router.refresh()
    } finally {
      setBusy(false)
      setTimeout(() => setMsg(p => ({ ...p, [key]: '' })), 2000)
    }
  }

  return (
    <div className="section-pad" style={{ paddingTop: '12px' }}>
      <BranchFilter branches={branches} current={selectedBranchId} basePath="/owner/bikes/pricing" theme="light" includeAll={false} />

      {err && (
        <div style={{ color: '#dc2626', fontSize: '13px', padding: '10px', background: '#fef2f2', borderRadius: '10px', marginBottom: '12px' }}>⚠️ {err}</div>
      )}

      {brands.map(brand => {
        const brandModels = models.filter(m => m.brand === brand)
        if (brandModels.length === 0) return null
        return (
          <div key={brand} className="card" style={{ marginBottom: '10px', padding: '12px 14px' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#111827', marginBottom: '10px' }}>🏍️ {brand}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {brandModels.map(m => {
                const key = `${brand}__${m.name}`
                const f = form[key] ?? { daily: '', monthly: '', promo: '' }
                return (
                  <div key={m.name} style={{ padding: '8px 10px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>{m.name}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                      <div>
                        <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '2px' }}>ราคา/วัน</div>
                        <input type="number" className="field-input" style={{ padding: '6px 8px', fontSize: '12px' }}
                          placeholder="—" value={f.daily}
                          onChange={e => setForm(p => ({ ...p, [key]: { ...f, daily: e.target.value } }))} />
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '2px' }}>ราคา/เดือน</div>
                        <input type="number" className="field-input" style={{ padding: '6px 8px', fontSize: '12px' }}
                          placeholder="—" value={f.monthly}
                          onChange={e => setForm(p => ({ ...p, [key]: { ...f, monthly: e.target.value } }))} />
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '2px' }}>โปรจ่าย (จาก 7)</div>
                        <input type="number" min={1} max={7} className="field-input" style={{ padding: '6px 8px', fontSize: '12px' }}
                          placeholder="5" value={f.promo}
                          onChange={e => setForm(p => ({ ...p, [key]: { ...f, promo: e.target.value } }))} />
                      </div>
                    </div>
                    <button disabled={busy} onClick={() => save(brand, m.name)}
                      style={{ width: '100%', color: '#111827', background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', fontWeight: 700, padding: '6px 8px', cursor: 'pointer', marginBottom: '8px' }}>
                      {msg[key] || 'บันทึก'}
                    </button>

                    <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>รูปกำกับราคาน้ำมัน (โชว์ตอนคืนรถไม่เต็ม)</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {fuelPhotos[key] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={fuelPhotos[key]} alt="รูปกำกับราคาน้ำมัน" style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e5e7eb' }} />
                      ) : (
                        <div style={{ width: '56px', height: '56px', borderRadius: '6px', border: '1.5px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', background: '#fff' }}>🛢️</div>
                      )}
                      <label style={{ cursor: 'pointer' }}>
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={e => { const file = e.target.files?.[0]; if (file) uploadFuelPhoto(brand, m.name, file) }} />
                        <span style={{ background: '#f1f5f9', color: '#374151', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', fontWeight: 600 }}>
                          {fuelUploading[key] ? 'กำลังอัพโหลด...' : fuelPhotos[key] ? 'เปลี่ยนรูป' : 'อัพโหลดรูป'}
                        </span>
                      </label>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
