'use client'

import { useState } from 'react'

type Bike = { id: string; license_plate: string; brand: string; model: string }
type DiscountType = 'percent' | 'fixed' | 'bonus_days' | 'flat_rate'

const TYPES: { type: DiscountType; icon: string; label: string; sub: string }[] = [
  { type: 'percent',    icon: '💯', label: 'ลดเป็น %',      sub: 'เช่น ลด 10%' },
  { type: 'fixed',      icon: '💵', label: 'ลดเงินสด',      sub: 'เช่น ลด ฿50' },
  { type: 'bonus_days', icon: '🎁', label: 'เช่า X แถม Y',  sub: 'เช่น 5 วัน แถม 2' },
  { type: 'flat_rate',  icon: '🏷️', label: 'ราคาพิเศษ/วัน', sub: 'เช่น ฿150/วัน' },
]

export default function CreatePromoForm({ bikes }: { bikes: Bike[] }) {
  const [name, setName]           = useState('')
  const [description, setDesc]    = useState('')
  const [type, setType]           = useState<DiscountType>('percent')
  const [value, setValue]         = useState('')
  const [minDays, setMinDays]     = useState('')
  const [bonusDays, setBonusDays] = useState('')
  const [code, setCode]           = useState('')
  const [isActive, setIsActive]         = useState(true)
  const [eligibleIds, setEligibleIds]   = useState<string[]>([]) // empty = ทุกคัน
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [success, setSuccess]           = useState(false)

  const toggleBike = (id: string) =>
    setEligibleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const allChecked = eligibleIds.length === 0

  const randomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    setCode(Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''))
  }

  const previewLabel = () => {
    if (type === 'percent' && value)    return `ลด ${value}%`
    if (type === 'fixed' && value)      return `ลด ฿${value}`
    if (type === 'bonus_days')          return `เช่า ${minDays || '?'} วัน แถม ${bonusDays || '?'} วัน`
    if (type === 'flat_rate' && value)  return `฿${value}/วัน`
    return '—'
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setError('กรุณาใส่ชื่อโปรโมชั่น'); return }
    if (type !== 'bonus_days' && (!value || parseFloat(value) <= 0)) { setError('กรุณาใส่ค่าส่วนลด'); return }
    if (type === 'bonus_days' && (!minDays || !bonusDays)) { setError('กรุณาใส่จำนวนวัน'); return }

    setLoading(true); setError('')
    const res = await fetch('/api/owner/settings/promo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        discount_type: type,
        discount_value: parseFloat(value) || 0,
        min_days: minDays ? parseInt(minDays) : null,
        bonus_days: bonusDays ? parseInt(bonusDays) : null,
        code: code.trim().toUpperCase() || null,
        is_active: isActive,
        eligible_bike_ids: eligibleIds.length > 0 ? eligibleIds : null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'เกิดข้อผิดพลาด'); setLoading(false); return }
    setSuccess(true)
  }

  if (success) return (
    <div style={{ padding: '40px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎁</div>
      <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>บันทึกโปรโมชั่นแล้ว!</div>
      <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>{name} — {previewLabel()}</div>
      <a href="/owner/settings" className="btn btn-primary" style={{ display: 'inline-block', background: '#7c3aed', textDecoration: 'none' }}>
        ← กลับ Settings
      </a>
    </div>
  )

  return (
    <div className="section-pad">

      {/* ข้อมูล */}
      <div className="card">
        <div className="card-title">ข้อมูลโปรโมชั่น</div>
        <div className="field-row">
          <label className="field-label">ชื่อโปรโมชั่น *</label>
          <input className="field-input" value={name} onChange={e => setName(e.target.value)} placeholder="เช่น โปรนักศึกษา" />
        </div>
        <div className="field-row" style={{ marginBottom: 0 }}>
          <label className="field-label">คำอธิบาย (แสดงให้ Staff เห็น)</label>
          <textarea className="field-input" rows={2} value={description} onChange={e => setDesc(e.target.value)} placeholder="เช่น ลด 10% สำหรับนักศึกษา แสดงบัตร" style={{ resize: 'none' }} />
        </div>
      </div>

      {/* ประเภทส่วนลด */}
      <div className="card">
        <div className="card-title">ประเภทส่วนลด *</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          {TYPES.map(t => (
            <div key={t.type} onClick={() => setType(t.type)} style={{
              border: `2px solid ${type === t.type ? '#be185d' : '#e5e7eb'}`,
              borderRadius: '10px', padding: '12px', textAlign: 'center', cursor: 'pointer',
              background: type === t.type ? '#fff1f2' : '#fff',
            }}>
              <div style={{ fontSize: '24px' }}>{t.icon}</div>
              <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '6px' }}>{t.label}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af' }}>{t.sub}</div>
            </div>
          ))}
        </div>

        {type === 'percent' && (
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">ลดกี่ % *</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input className="field-input" type="number" placeholder="10" style={{ flex: 1 }} value={value} onChange={e => setValue(e.target.value)} />
              <span style={{ fontWeight: 800, color: '#374151' }}>%</span>
            </div>
          </div>
        )}
        {type === 'fixed' && (
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">ลดกี่บาท *</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: 700 }}>฿</span>
              <input className="field-input" type="number" placeholder="50" style={{ flex: 1 }} value={value} onChange={e => setValue(e.target.value)} />
            </div>
          </div>
        )}
        {type === 'bonus_days' && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label className="field-label">เช่ากี่วัน</label>
              <input className="field-input" type="number" placeholder="5" value={minDays} onChange={e => setMinDays(e.target.value)} />
            </div>
            <div style={{ fontSize: '18px', paddingTop: '20px' }}>→</div>
            <div style={{ flex: 1 }}>
              <label className="field-label">แถมกี่วัน</label>
              <input className="field-input" type="number" placeholder="2" value={bonusDays} onChange={e => setBonusDays(e.target.value)} />
            </div>
          </div>
        )}
        {type === 'flat_rate' && (
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">ราคาพิเศษต่อวัน (บาท) *</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: 700 }}>฿</span>
              <input className="field-input" type="number" placeholder="150" style={{ flex: 1 }} value={value} onChange={e => setValue(e.target.value)} />
              <span style={{ color: '#6b7280' }}>/วัน</span>
            </div>
          </div>
        )}
      </div>

      {/* รหัส */}
      <div className="card">
        <div className="card-title">รหัสโปรโมชั่น</div>
        <div className="field-row" style={{ marginBottom: 0 }}>
          <label className="field-label">Promo Code (ไม่บังคับ)</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input className="field-input" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="เช่น STUDENT10" style={{ flex: 1, textTransform: 'uppercase' }} />
            <button onClick={randomCode} style={{ background: '#f3f4f6', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '0 12px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              สุ่มรหัส
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>ถ้าไม่ใส่ Staff กดเลือกได้เลยโดยไม่ต้องกรอกรหัส</div>
        </div>
      </div>

      {/* Preview */}
      <div style={{ background: 'linear-gradient(135deg,#be185d,#e11d48)', borderRadius: '14px', padding: '16px', marginBottom: '12px', color: '#fff' }}>
        <div style={{ fontSize: '12px', opacity: .8, marginBottom: '8px' }}>ตัวอย่างที่ Staff จะเห็นตอนส่งรถ</div>
        <div style={{ background: 'rgba(255,255,255,.15)', borderRadius: '10px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '28px' }}>{TYPES.find(t => t.type === type)?.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>{name || 'ชื่อโปรโมชั่น'}</div>
            <div style={{ fontSize: '12px', opacity: .85, marginTop: '2px' }}>{previewLabel()}{description ? ` • ${description}` : ''}</div>
          </div>
        </div>
      </div>

      {/* รถที่ร่วมรายการ */}
      {bikes.length > 0 && (
        <div className="card">
          <div className="card-title">รถที่ร่วมรายการ</div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
            {allChecked ? '✅ ทุกคัน (ค่าเริ่มต้น)' : `เลือกแล้ว ${eligibleIds.length} คัน`}
          </div>

          {/* ปุ่ม เลือกทั้งหมด / ล้าง */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              type="button"
              onClick={() => setEligibleIds([])}
              style={{
                flex: 1, padding: '8px', border: `1.5px solid ${allChecked ? '#be185d' : '#e5e7eb'}`,
                borderRadius: '8px', background: allChecked ? '#fff1f2' : '#fff',
                color: allChecked ? '#be185d' : '#6b7280', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              ✅ ทุกคัน
            </button>
            <button
              type="button"
              onClick={() => setEligibleIds(bikes.map(b => b.id))}
              style={{
                flex: 1, padding: '8px', border: `1.5px solid ${!allChecked ? '#be185d' : '#e5e7eb'}`,
                borderRadius: '8px', background: !allChecked ? '#fff1f2' : '#fff',
                color: !allChecked ? '#be185d' : '#6b7280', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              เลือกเอง
            </button>
          </div>

          {!allChecked && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {bikes.map(bike => {
                const checked = eligibleIds.includes(bike.id)
                return (
                  <label key={bike.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
                    padding: '10px 12px', borderRadius: '10px',
                    border: `1.5px solid ${checked ? '#be185d' : '#e5e7eb'}`,
                    background: checked ? '#fff1f2' : '#fff',
                  }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleBike(bike.id)}
                      style={{ width: '18px', height: '18px', accentColor: '#be185d', cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                        {bike.brand} {bike.model}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>{bike.license_plate}</div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Active toggle */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>เปิดใช้งานทันที</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>Staff จะเห็นโปรนี้ในหน้าส่งรถ</div>
          </div>
          <div onClick={() => setIsActive(!isActive)} style={{
            width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer',
            background: isActive ? '#7c3aed' : '#d1d5db', position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: '3px', left: isActive ? '23px' : '3px',
              width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
              transition: 'left .2s',
            }} />
          </div>
        </div>
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', color: '#dc2626', fontSize: '14px', marginBottom: '12px' }}>⚠️ {error}</div>}

      <button onClick={handleSubmit} disabled={loading} style={{
        width: '100%', padding: '16px', border: 'none', borderRadius: '12px',
        background: 'linear-gradient(135deg,#be185d,#e11d48)', color: '#fff',
        fontSize: '16px', fontWeight: 700, cursor: 'pointer', opacity: loading ? .7 : 1,
      }}>
        {loading ? '⏳ กำลังบันทึก...' : '🎁 บันทึกโปรโมชั่น'}
      </button>
    </div>
  )
}
