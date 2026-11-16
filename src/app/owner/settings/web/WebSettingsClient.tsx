'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section, SettingsHeader, Toggle } from '../_shared'
import { compressImage } from '@/lib/compressImage'

export type ZoneRow = {
  id: string | null
  name_th: string; name_en: string; name_ja: string; name_zh: string
  short_fee: string; long_fee: string
  sort_order: number; active: boolean
}
export type ModelRow = {
  brand: string; model: string; bikeCount: number
  dailyRate: number | null; monthlyRate: number | null
  visible: boolean; photoUrl: string | null; fallbackPhoto: string | null; sortOrder: number
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e5e7eb',
  fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box',
}
const smallBtn: React.CSSProperties = {
  padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#111827', color: '#fff',
  fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
}

async function post(url: string, body: unknown): Promise<{ ok: boolean; error?: string; id?: string }> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => null)
  return res.ok ? { ok: true, id: data?.id } : { ok: false, error: data?.error ?? `HTTP ${res.status}` }
}

function ZoneCard({ branchId, initial, onDeleted }: { branchId: string; initial: ZoneRow; onDeleted: () => void }) {
  const [z, setZ] = useState(initial)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof ZoneRow>(k: K, v: ZoneRow[K]) => setZ(prev => ({ ...prev, [k]: v }))

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  const save = async () => {
    setBusy(true)
    const r = await post('/api/owner/web/zones', { branch_id: branchId, zone: z })
    setBusy(false)
    if (r.ok) { if (!z.id && r.id) set('id', r.id); flash('✅ บันทึกแล้ว') } else flash('❌ ' + r.error)
  }
  const remove = async () => {
    if (!z.id) { onDeleted(); return }
    if (!window.confirm(`ลบโซน "${z.name_th || z.name_en}" ?`)) return
    setBusy(true)
    const r = await post('/api/owner/web/zones', { branch_id: branchId, delete_id: z.id })
    setBusy(false)
    if (r.ok) onDeleted(); else flash('❌ ' + r.error)
  }

  return (
    <div style={{ border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '12px', margin: '0 16px 10px', opacity: z.active ? 1 : .6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <input style={inputStyle} placeholder="ชื่อโซน (ไทย) *" value={z.name_th} onChange={e => set('name_th', e.target.value)} />
        <input style={inputStyle} placeholder="Zone name (English) *" value={z.name_en} onChange={e => set('name_en', e.target.value)} />
        <input style={inputStyle} placeholder="日本語 (ไม่บังคับ)" value={z.name_ja} onChange={e => set('name_ja', e.target.value)} />
        <input style={inputStyle} placeholder="中文 (ไม่บังคับ)" value={z.name_zh} onChange={e => set('name_zh', e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '8px', marginTop: '8px' }}>
        <label style={{ fontSize: '11px', color: '#6b7280' }}>
          ค่าส่ง/รับ ต่อเที่ยว — รายวัน/สัปดาห์ (บาท)
          <input style={{ ...inputStyle, marginTop: '4px' }} inputMode="numeric" placeholder="ว่าง = ไม่ให้บริการ" value={z.short_fee}
            onChange={e => set('short_fee', e.target.value.replace(/[^\d.]/g, ''))} />
        </label>
        <label style={{ fontSize: '11px', color: '#6b7280' }}>
          ค่าส่ง/รับ ต่อเที่ยว — รายเดือน (บาท)
          <input style={{ ...inputStyle, marginTop: '4px' }} inputMode="numeric" placeholder="ว่าง = ให้เว็บบอกสอบถาม" value={z.long_fee}
            onChange={e => set('long_fee', e.target.value.replace(/[^\d.]/g, ''))} />
        </label>
        <label style={{ fontSize: '11px', color: '#6b7280' }}>
          ลำดับ
          <input style={{ ...inputStyle, marginTop: '4px' }} inputMode="numeric" value={z.sort_order}
            onChange={e => set('sort_order', parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)} />
        </label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
        <Toggle on={z.active} onClick={() => set('active', !z.active)} />
        <span style={{ fontSize: '12px', color: '#374151', flex: 1 }}>{z.active ? 'เปิดให้เลือกบนเว็บ' : 'ปิดอยู่'}</span>
        {msg && <span style={{ fontSize: '12px', color: msg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{msg}</span>}
        <button onClick={remove} disabled={busy} style={{ ...smallBtn, background: '#fff', color: '#dc2626', border: '1.5px solid #fecaca' }}>ลบ</button>
        <button onClick={save} disabled={busy} style={{ ...smallBtn, opacity: busy ? .7 : 1 }}>{busy ? '...' : 'บันทึก'}</button>
      </div>
    </div>
  )
}

function ModelCard({ branchId, initial }: { branchId: string; initial: ModelRow }) {
  const [m, setM] = useState(initial)
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState(false)
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 4000) }
  const hasPrice = m.dailyRate != null && m.dailyRate > 0

  const patch = async (fields: Record<string, unknown>) => {
    const r = await post('/api/owner/web/models', { branch_id: branchId, brand: m.brand, model: m.model, ...fields })
    if (r.ok) flash('✅ บันทึกแล้ว'); else flash('❌ ' + r.error)
    return r.ok
  }

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const blob = await compressImage(file, 300, 1200)
      const fd = new FormData()
      fd.append('file', new File([blob], 'model.jpg', { type: 'image/jpeg' }))
      fd.append('folder', 'web-models')
      const res = await fetch('/api/owner/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      if (await patch({ photo_url: data.url })) setM(prev => ({ ...prev, photoUrl: data.url }))
    } catch (e) {
      flash('❌ ' + (e instanceof Error ? e.message : 'อัพโหลดไม่สำเร็จ'))
    } finally {
      setUploading(false)
    }
  }

  const photo = m.photoUrl || m.fallbackPhoto
  return (
    <div style={{ border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '10px', margin: '0 16px 10px', display: 'flex', gap: '10px', opacity: m.visible ? 1 : .6 }}>
      <label style={{ width: '84px', height: '84px', flexShrink: 0, borderRadius: '8px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', position: 'relative', fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>
        {photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={photo} alt={`${m.brand} ${m.model}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : (uploading ? '...' : '+ รูป')}
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }} />
        {photo && <span style={{ position: 'absolute', bottom: 2, right: 2, background: 'rgba(17,24,39,.8)', color: '#fff', fontSize: '10px', padding: '1px 6px', borderRadius: '5px' }}>{uploading ? '...' : 'เปลี่ยน'}</span>}
      </label>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '13px', color: '#111827' }}>{m.brand} {m.model}</div>
        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
          {m.bikeCount} คัน · {hasPrice
            ? `฿${m.dailyRate!.toLocaleString()}/วัน · ${m.monthlyRate ? `฿${m.monthlyRate.toLocaleString()}/เดือน` : 'เดือน = วัน×30'}`
            : <span style={{ color: '#dc2626', fontWeight: 700 }}>ยังไม่ตั้งราคารายวัน — จะไม่ขึ้นเว็บ</span>}
        </div>
        {!m.photoUrl && m.fallbackPhoto && <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>ใช้รูปจากรถในระบบ — อัพโหลดรูปประจำรุ่นเพื่อใช้แทน</div>}
        {!photo && <div style={{ fontSize: '10px', color: '#d97706', marginTop: '2px' }}>ยังไม่มีรูป — เว็บจะแสดงช่องว่าง</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
          <Toggle on={m.visible} onClick={async () => { const next = !m.visible; setM(p => ({ ...p, visible: next })); if (!(await patch({ visible: next }))) setM(p => ({ ...p, visible: !next })) }} />
          <span style={{ fontSize: '11px', color: '#374151' }}>{m.visible ? 'โชว์บนเว็บ' : 'ซ่อน'}</span>
          <span style={{ flex: 1 }} />
          <label style={{ fontSize: '11px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
            ลำดับ
            <input style={{ ...inputStyle, width: '52px', padding: '4px 6px' }} inputMode="numeric" value={m.sortOrder}
              onChange={e => setM(p => ({ ...p, sortOrder: parseInt(e.target.value.replace(/\D/g, ''), 10) || 0 }))}
              onBlur={() => patch({ sort_order: m.sortOrder })} />
          </label>
        </div>
        {msg && <div style={{ fontSize: '11px', marginTop: '4px', color: msg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{msg}</div>}
      </div>
    </div>
  )
}

export default function WebSettingsClient({ branches, branchId, lineId, zones, models }: {
  branches: { id: string; name: string }[]; branchId: string; lineId: string | null; zones: ZoneRow[]; models: ModelRow[]
}) {
  const router = useRouter()
  const [rows, setRows] = useState<{ key: number; zone: ZoneRow }[]>(zones.map((zone, i) => ({ key: i, zone })))
  const [nextKey, setNextKey] = useState(zones.length)

  const addZone = () => {
    setRows(prev => [...prev, { key: nextKey, zone: { id: null, name_th: '', name_en: '', name_ja: '', name_zh: '', short_fee: '', long_fee: '', sort_order: prev.length, active: true } }])
    setNextKey(k => k + 1)
  }

  return (
    <>
      <SettingsHeader title="เว็บหน้าร้าน" sub="โซนค่าส่ง · รุ่นที่โชว์บนเว็บ" />

      <Section title="สาขา">
        <div style={{ padding: '10px 16px 14px' }}>
          <select value={branchId} onChange={e => router.push(`/owner/settings/web?branch=${e.target.value}`)} style={inputStyle}>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px', lineHeight: 1.6 }}>
            ปุ่มจองบนเว็บจะเด้งไปไลน์ {lineId ? <b>{lineId}</b> : <b style={{ color: '#dc2626' }}>(สาขานี้ยังไม่ได้ตั้ง LINE ID ใน ตั้งค่า &gt; ร้านค้า)</b>}
          </div>
        </div>
      </Section>

      <Section title="โซนค่าส่ง / รับคืน">
        <div style={{ padding: '10px 16px 12px', fontSize: '11px', color: '#6b7280', lineHeight: 1.7 }}>
          ค่าที่ตั้งคือ <b>ต่อเที่ยว</b> (ส่ง 1 เที่ยว + รับคืน 1 เที่ยว คิดแยกกัน) เว็บแสดงเป็น &quot;ค่าส่งโดยประมาณ&quot; และพนักงานยืนยันตัวเลขจริงในไลน์<br />
          • รายวัน/สัปดาห์: ช่องว่าง = โซนนี้ไม่ให้บริการส่งแบบสั้น<br />
          • รายเดือน: ช่องว่าง = ให้เว็บบอกลูกค้า &quot;สอบถามค่าส่ง&quot; (ใส่ 0 = ฟรี)<br />
          • เช่า 90 วันขึ้นไป ระบบคิดส่งฟรีให้อัตโนมัติ ไม่ต้องตั้งค่า
        </div>
        {rows.map(r => (
          <ZoneCard key={r.key} branchId={branchId} initial={r.zone} onDeleted={() => setRows(prev => prev.filter(x => x.key !== r.key))} />
        ))}
        <div style={{ padding: '0 16px 16px' }}>
          <button onClick={addZone} style={{ ...smallBtn, background: '#fff', color: '#111827', border: '1.5px dashed #9ca3af', width: '100%', padding: '10px' }}>+ เพิ่มโซน</button>
        </div>
      </Section>

      <Section title="รุ่นรถที่โชว์บนเว็บ">
        <div style={{ padding: '10px 16px 12px', fontSize: '11px', color: '#6b7280', lineHeight: 1.7 }}>
          แสดงเฉพาะรุ่นที่สาขามีรถจริงและตั้งราคารายวันไว้แล้ว (ตั้งราคาที่ ตั้งค่า &gt; ร้านค้า &gt; ราคา) ราคาบนเว็บดึงจากระบบอัตโนมัติ ไม่ต้องกรอกซ้ำ
        </div>
        {models.length === 0
          ? <div style={{ padding: '0 16px 16px', fontSize: '12px', color: '#9ca3af' }}>สาขานี้ยังไม่มีรถ</div>
          : models.map(m => <ModelCard key={`${m.brand}__${m.model}`} branchId={branchId} initial={m} />)}
      </Section>
    </>
  )
}
