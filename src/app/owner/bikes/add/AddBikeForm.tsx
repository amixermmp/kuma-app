'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PhotoUpload from '@/components/PhotoUpload'
import type { BikeModel } from '@/lib/bikeCatalog'


type Branch = { id: string; name: string }
type Routine = { task_name: string; interval_km: string; interval_days: string; last_done_date: string }

const DEFAULT_ROUTINES: Routine[] = [
  { task_name: 'เปลี่ยนน้ำมันเครื่อง', interval_km: '1000', interval_days: '30', last_done_date: '' },
  { task_name: 'เปลี่ยนน้ำมันเฟืองท้าย', interval_km: '3000', interval_days: '120', last_done_date: '' },
]

export default function AddBikeForm({ ownerId, branches, brands, models }: { ownerId: string; branches: Branch[]; brands: string[]; models: BikeModel[] }) {
  const router = useRouter()

  const [branchId, setBranchId] = useState(branches[0]?.id ?? '')
  const [licensePlate, setLicensePlate] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [color, setColor] = useState('')
  const [odometer, setOdometer] = useState('0')
  const [notes, setNotes] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [dailyRate, setDailyRate] = useState('')
  const [monthlyRate, setMonthlyRate] = useState('')

  const [regPhotoUrl, setRegPhotoUrl] = useState('')
  const [taxPhotoUrl, setTaxPhotoUrl] = useState('')
  const [taxExpiry, setTaxExpiry] = useState('')
  const [pobPhotoUrl, setPobPhotoUrl] = useState('')
  const [pobExpiry, setPobExpiry] = useState('')
  const [routines, setRoutines] = useState<Routine[]>(DEFAULT_ROUTINES)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const updateRoutine = (i: number, field: keyof Routine, val: string) =>
    setRoutines(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  const addRoutine = () => setRoutines(prev => [...prev, { task_name: '', interval_km: '', interval_days: '', last_done_date: '' }])
  const removeRoutine = (i: number) => setRoutines(prev => prev.filter((_, idx) => idx !== i))

  const handleSubmit = async () => {
    if (!branchId) { setError('กรุณาเลือกสาขา'); return }
    if (!licensePlate.trim()) { setError('กรุณาระบุทะเบียนรถ'); return }
    if (!brand.trim()) { setError('กรุณาระบุยี่ห้อรถ'); return }
    if (!model.trim()) { setError('กรุณาระบุรุ่นรถ'); return }
    if (!dailyRate || isNaN(Number(dailyRate))) { setError('กรุณาระบุราคาเช่า/วัน'); return }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/staff/bikes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: branchId,
          license_plate: licensePlate.trim().toUpperCase(),
          brand: brand.trim(),
          model: model.trim(),
          year: year ? parseInt(year) : null,
          color: color.trim() || null,
          odometer: odometer ? parseInt(odometer) : 0,
          notes: notes.trim() || null,
          photo_url: photoUrl || null,
          daily_rate: parseFloat(dailyRate),
          monthly_rate: monthlyRate ? parseFloat(monthlyRate) : null,
          deposit_amount: 0,
          docs: {
            registration: { photo_url: regPhotoUrl || null },
            tax: { photo_url: taxPhotoUrl || null, expiry_date: taxExpiry || null },
            pob: { photo_url: pobPhotoUrl || null, expiry_date: pobExpiry || null },
          },
          routines: routines
            .filter(r => r.task_name.trim())
            .map(r => ({
              task_name: r.task_name.trim(),
              interval_km: r.interval_km ? parseInt(r.interval_km) : null,
              interval_days: r.interval_days ? parseInt(r.interval_days) : null,
              last_done_date: r.last_done_date || null,
            })),
        }),
      })

      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'เกิดข้อผิดพลาด')
        return
      }

      const { bikeId } = await res.json()
      router.push(`/staff/bikes/${bikeId}/qr`)
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-wrap">
      <div className="app-header">
        <Link href="/owner/dashboard" className="app-header-back">←</Link>
        <div>
          <h1>เพิ่มรถ</h1>
          <div className="sub">ลงทะเบียนรถคันใหม่</div>
        </div>
      </div>

      <div className="section-pad" style={{ paddingTop: '12px' }}>

        {/* สาขา */}
        <div className="card-title" style={{ padding: '4px 0 8px' }}>สาขา</div>
        <div className="card">
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">รถคันนี้อยู่สาขาไหน *</label>
            <select className="field-input" value={branchId} onChange={e => setBranchId(e.target.value)}>
              {branches.length === 0 && <option value="">— ไม่พบสาขา —</option>}
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* รูปรถ */}
        <div className="card-title" style={{ padding: '12px 0 8px' }}>รูปรถ</div>
        <div className="card">
          <PhotoUpload icon="🛵" hint="ถ่ายหรือเลือกรูปรถ" folder="bikes"
            onUpload={url => setPhotoUrl(url)} onRemove={() => setPhotoUrl('')} />
        </div>

        {/* ข้อมูลพื้นฐาน */}
        <div className="card-title" style={{ padding: '12px 0 8px' }}>ข้อมูลพื้นฐาน</div>
        <div className="card">
          <div className="field-row">
            <label className="field-label">ทะเบียนรถ *</label>
            <input className="field-input" type="text" placeholder="เช่น กข 1234 ชม."
              value={licensePlate} onChange={e => setLicensePlate(e.target.value)} />
          </div>
          <div className="field-row">
            <label className="field-label">ยี่ห้อ *</label>
            <select className="field-input" value={brand} onChange={e => { setBrand(e.target.value); setModel('') }}>
              <option value="">— เลือกยี่ห้อ —</option>
              {brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="field-row">
            <label className="field-label">รุ่น *</label>
            <select className="field-input" value={model} onChange={e => setModel(e.target.value)} disabled={!brand}>
              <option value="">{brand ? '— เลือกรุ่น —' : '— เลือกยี่ห้อก่อน —'}</option>
              {models.filter(m => m.brand === brand).map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
            </select>
          </div>
          <div className="field-row">
            <label className="field-label">ปี</label>
            <input className="field-input" type="number" placeholder="2022"
              value={year} onChange={e => setYear(e.target.value)} />
          </div>
          <div className="field-row">
            <label className="field-label">สี</label>
            <input className="field-input" type="text" placeholder="ขาว / ดำ / แดง…"
              value={color} onChange={e => setColor(e.target.value)} />
          </div>
          <div className="field-row">
            <label className="field-label">เลขไมล์เริ่มต้น</label>
            <input className="field-input" type="number" placeholder="0"
              value={odometer} onChange={e => setOdometer(e.target.value)} />
          </div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">หมายเหตุ</label>
            <input className="field-input" type="text" placeholder="รายละเอียดเพิ่มเติม…"
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        {/* ราคา */}
        <div className="card-title" style={{ padding: '12px 0 8px' }}>ราคา</div>
        <div className="card">
          <div className="field-row">
            <label className="field-label">ราคา/วัน *</label>
            <input className="field-input" type="number" placeholder="250 บาท"
              value={dailyRate} onChange={e => setDailyRate(e.target.value)} />
          </div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">ราคา/เดือน</label>
            <input className="field-input" type="number" placeholder="3,000 บาท"
              value={monthlyRate} onChange={e => setMonthlyRate(e.target.value)} />
          </div>
        </div>

        {/* เอกสารรถ */}
        <div className="card-title" style={{ padding: '12px 0 4px' }}>เอกสารรถ</div>
        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>ลูกค้าดูผ่าน QR ได้</div>

        <div className="card" style={{ marginBottom: '8px' }}>
          <div style={{ padding: '10px 14px 4px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>📗 หน้าเล่มรถ</div>
          <div style={{ padding: '0 14px 12px' }}>
            <PhotoUpload icon="📗" hint="ถ่ายหรืออัพโหลดหน้าเล่มรถ" folder="docs/registration"
              onUpload={url => setRegPhotoUrl(url)} onRemove={() => setRegPhotoUrl('')} />
          </div>
        </div>

        <div className="card" style={{ marginBottom: '8px' }}>
          <div style={{ padding: '10px 14px 4px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>💰 ป้ายภาษีประจำปี</div>
          <div style={{ padding: '0 14px 0' }}>
            <div className="field-row">
              <label className="field-label">วันหมดอายุ</label>
              <input className="field-input" type="date" value={taxExpiry} onChange={e => setTaxExpiry(e.target.value)} />
            </div>
            <div className="field-row" style={{ marginBottom: '12px' }}>
              <label className="field-label">อัพโหลดรูป</label>
              <div style={{ flex: 1 }}>
                <PhotoUpload icon="💰" hint="ถ่ายป้ายภาษีประจำปี" folder="docs/tax"
                  onUpload={url => setTaxPhotoUrl(url)} onRemove={() => setTaxPhotoUrl('')} />
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '8px' }}>
          <div style={{ padding: '10px 14px 4px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>🛡️ พ.ร.บ. ประกันภัย</div>
          <div style={{ padding: '0 14px 0' }}>
            <div className="field-row">
              <label className="field-label">วันหมดอายุ</label>
              <input className="field-input" type="date" value={pobExpiry} onChange={e => setPobExpiry(e.target.value)} />
            </div>
            <div className="field-row" style={{ marginBottom: '12px' }}>
              <label className="field-label">อัพโหลดรูป</label>
              <div style={{ flex: 1 }}>
                <PhotoUpload icon="🛡️" hint="ถ่ายใบ พ.ร.บ." folder="docs/pob"
                  onUpload={url => setPobPhotoUrl(url)} onRemove={() => setPobPhotoUrl('')} />
              </div>
            </div>
          </div>
        </div>

        {/* รูทีน */}
        <div className="card-title" style={{ padding: '12px 0 4px' }}>ซ่อมบำรุงรูทีน</div>
        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>เตือนเมื่อถึงกิโลเมตร หรือ จำนวนวัน</div>

        {routines.map((r, i) => (
          <div key={i} className="card" style={{ marginBottom: '8px' }}>
            <div style={{ padding: '10px 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input className="field-input" type="text" placeholder="ชื่องาน เช่น เปลี่ยนน้ำมันเครื่อง"
                value={r.task_name} onChange={e => updateRoutine(i, 'task_name', e.target.value)}
                style={{ flex: 1, fontWeight: 600 }} />
              {i >= 2 && (
                <button onClick={() => removeRoutine(i)}
                  style={{ color: '#dc2626', background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', padding: '0 4px' }}>×</button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', padding: '8px 14px 4px' }}>
              <div style={{ paddingRight: '8px' }}>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>ทุก กี่ กม.</div>
                <input className="field-input" type="number" placeholder="1000"
                  value={r.interval_km} onChange={e => updateRoutine(i, 'interval_km', e.target.value)} />
              </div>
              <div style={{ paddingLeft: '8px' }}>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>หรือ ทุก กี่ วัน</div>
                <input className="field-input" type="number" placeholder="90"
                  value={r.interval_days} onChange={e => updateRoutine(i, 'interval_days', e.target.value)} />
              </div>
            </div>
            <div style={{ padding: '0 14px 12px' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>ทำล่าสุดเมื่อ (วันที่)</div>
              <input className="field-input" type="date"
                value={r.last_done_date} onChange={e => updateRoutine(i, 'last_done_date', e.target.value)} />
            </div>
          </div>
        ))}

        <button onClick={addRoutine} style={{
          width: '100%', padding: '12px', marginBottom: '16px',
          background: 'transparent', border: '1.5px dashed #d1d5db', borderRadius: '12px',
          color: '#6b7280', fontSize: '13px', cursor: 'pointer',
        }}>+ เพิ่มงานรูทีนอื่นๆ</button>

        {error && (
          <div style={{ color: '#dc2626', fontSize: '13px', padding: '10px', background: '#fef2f2', borderRadius: '10px', marginBottom: '12px' }}>
            ⚠️ {error}
          </div>
        )}

        <button className="btn btn-primary"
          style={{ width: '100%', opacity: loading ? 0.7 : 1, fontSize: '15px', padding: '14px' }}
          onClick={handleSubmit} disabled={loading}>
          {loading ? '⏳ กำลังเพิ่มรถ...' : '✅ เพิ่มรถและสร้าง QR Code'}
        </button>

      </div>
    </div>
  )
}
