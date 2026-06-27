'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

type Shop = Record<string, any>
type Staff = { id: string; name: string; pin: string; branch_id: string | null; is_active: boolean; branches?: { name: string } | null }
type Branch = { id: string; name: string }
type Promo = { id: string; name: string | null; code: string | null; description: string | null; discount_type: string; discount_value: number; min_days: number | null; bonus_days: number | null; is_active: boolean }

type BranchDocs = { terms_photo_url: string | null; manual_photo_url: string | null; contract_photo_url: string | null }
type Props = { shop: Shop; staff: Staff[]; branches: Branch[]; promotions: Promo[]; branchDocs: BranchDocs }

// ─── helpers ────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '8px', background: '#fff' }}>
      <div style={{ padding: '12px 16px 8px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid #f3f4f6' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="field-row">
      <label className="field-label">{label}</label>
      {children}
      {hint && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{hint}</div>}
    </div>
  )
}

function SaveBtn({ loading, onClick, label = '💾 บันทึก' }: { loading: boolean; onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} disabled={loading} className="btn btn-primary"
      style={{ background: '#7c3aed', opacity: loading ? .7 : 1 }}>
      {loading ? '⏳...' : label}
    </button>
  )
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer',
      background: on ? '#7c3aed' : '#d1d5db', position: 'relative', flexShrink: 0,
      transition: 'background .2s',
    }}>
      <div style={{
        position: 'absolute', top: '3px', left: on ? '23px' : '3px',
        width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
        transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
      }} />
    </div>
  )
}

// ─── StaffModal ──────────────────────────────────────────────────────────────

function StaffModal({ branches, onClose, onSaved, editing }: {
  branches: Branch[]
  onClose: () => void
  onSaved: (staff: Staff) => void
  editing?: Staff
}) {
  const [name, setName] = useState(editing?.name ?? '')
  const [pin, setPin] = useState(editing?.pin ?? '')
  const [branchId, setBranchId] = useState(editing?.branch_id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!name.trim()) { setError('กรุณาใส่ชื่อ'); return }
    if (pin.length !== 6) { setError('PIN ต้องมี 6 หลัก'); return }
    setLoading(true); setError('')
    const url = editing ? `/api/owner/settings/staff/${editing.id}` : '/api/owner/settings/staff'
    const payload = { name: name.trim(), pin, branch_id: branchId || null }
    const res = await fetch(url, {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'เกิดข้อผิดพลาด'); setLoading(false); return }
    // return updated/new staff object for optimistic update
    const result: Staff = editing
      ? { ...editing, ...payload }
      : { id: data.id ?? crypto.randomUUID(), ...payload, is_active: true, branches: null }
    onSaved(result)
  }

  const deactivate = async () => {
    if (!editing) return
    if (!confirm(`ปิดการใช้งาน ${editing.name}?`)) return
    await fetch(`/api/owner/settings/staff/${editing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: false }),
    })
    onSaved({ ...editing, is_active: false })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 999, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', width: '100%', borderRadius: '16px 16px 0 0', padding: '20px 16px 32px' }}>
        <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '16px' }}>
          {editing ? 'แก้ไขพนักงาน' : '+ เพิ่มพนักงาน'}
        </div>
        <Field label="ชื่อ - นามสกุล *">
          <input className="field-input" value={name} onChange={e => setName(e.target.value)} placeholder="สมชาย มีดี" />
        </Field>
        <Field label="PIN (6 หลัก) *" hint="พนักงานใช้ PIN นี้ scan QR รถเพื่อเข้าระบบ">
          <input className="field-input" type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" />
        </Field>
        <Field label="สาขา">
          <select className="field-input" value={branchId} onChange={e => setBranchId(e.target.value)}>
            <option value="">ไม่ระบุสาขา</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        {error && <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>⚠️ {error}</div>}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose} className="btn" style={{ flex: 1, background: '#f3f4f6', color: '#374151' }}>ยกเลิก</button>
          <SaveBtn loading={loading} onClick={save} label={editing ? '💾 บันทึก' : '+ เพิ่ม'} />
        </div>
        {editing && editing.is_active && (
          <button onClick={deactivate} style={{ marginTop: '10px', width: '100%', background: 'none', border: 'none', color: '#dc2626', fontSize: '13px', cursor: 'pointer' }}>
            ปิดการใช้งานพนักงานคนนี้
          </button>
        )}
      </div>
    </div>
  )
}

// ─── BranchModal ─────────────────────────────────────────────────────────────

function BranchModal({ onClose, onSaved }: { onClose: () => void; onSaved: (branch: Branch) => void }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!name.trim()) { setError('กรุณาใส่ชื่อสาขา'); return }
    setLoading(true)
    const res = await fetch('/api/owner/settings/branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'เกิดข้อผิดพลาด'); setLoading(false); return }
    onSaved({ id: data.id ?? crypto.randomUUID(), name: name.trim() })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 999, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', width: '100%', borderRadius: '16px 16px 0 0', padding: '20px 16px 32px' }}>
        <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '16px' }}>+ เพิ่มสาขา</div>
        <Field label="ชื่อสาขา *">
          <input className="field-input" value={name} onChange={e => setName(e.target.value)} placeholder="เช่น สาขาป่าตอง" />
        </Field>
        {error && <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>⚠️ {error}</div>}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose} className="btn" style={{ flex: 1, background: '#f3f4f6', color: '#374151' }}>ยกเลิก</button>
          <SaveBtn loading={loading} onClick={save} label="+ เพิ่มสาขา" />
        </div>
      </div>
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function SettingsClient({ shop, staff: initialStaff, branches: initialBranches, promotions: initialPromos, branchDocs }: Props) {

  // ── Shop state ──
  const [shopName, setShopName] = useState(shop.shop_name ?? '')
  const [address, setAddress] = useState(shop.address ?? '')
  const [taxId, setTaxId] = useState(shop.tax_id ?? '')
  const [phone, setPhone] = useState(shop.phone ?? '')
  const [logoUrl, setLogoUrl] = useState(shop.logo_url ?? '')
  const [logoUploading, setLogoUploading] = useState(false)
  const [shopLoading, setShopLoading] = useState(false)
  const [shopMsg, setShopMsg] = useState('')

  // ── Notification state ──
  const [docDays, setDocDays] = useState(String(shop.doc_alert_days ?? 30))
  const [overdueHours, setOverdueHours] = useState(String(shop.overdue_alert_hours ?? 2))
  const [overtimeRate, setOvertimeRate] = useState(String(shop.overtime_rate ?? 50))
  const [hoursPerDay, setHoursPerDay] = useState(String(shop.hours_per_day ?? 5))

  // ── LINE state ──
  const [lineToken, setLineToken] = useState(shop.line_token ?? '')
  const [lineTarget, setLineTarget] = useState(shop.line_target_id ?? '')
  const [lineOverdue, setLineOverdue] = useState(shop.line_notify_overdue ?? true)
  const [lineDocs, setLineDocs] = useState(shop.line_notify_docs ?? true)
  const [lineMonthly, setLineMonthly] = useState(shop.line_notify_monthly ?? true)
  const [lineBroken, setLineBroken] = useState(shop.line_notify_broken ?? false)
  const [lineLoading, setLineLoading] = useState(false)
  const [lineMsg, setLineMsg] = useState('')

  // ── Shop Documents state ──
  const [docUrls, setDocUrls] = useState({
    contract_photo_url: branchDocs.contract_photo_url,
    terms_photo_url: branchDocs.terms_photo_url,
    manual_photo_url: branchDocs.manual_photo_url,
  })
  const [docUploading, setDocUploading] = useState<string | null>(null)
  const [docMsg, setDocMsg] = useState<Record<string, string>>({})

  const uploadDoc = async (field: string, file: File) => {
    setDocUploading(field)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'shop-docs')
      const upRes = await fetch('/api/staff/upload', { method: 'POST', body: fd })
      const upData = await upRes.json()
      if (!upRes.ok) throw new Error(upData.error)

      const saveRes = await fetch('/api/owner/settings/branch-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, url: upData.url }),
      })
      if (!saveRes.ok) throw new Error('บันทึกไม่สำเร็จ')

      setDocUrls(prev => ({ ...prev, [field]: upData.url }))
      setDocMsg(prev => ({ ...prev, [field]: '✅ บันทึกแล้ว' }))
    } catch {
      setDocMsg(prev => ({ ...prev, [field]: '❌ เกิดข้อผิดพลาด' }))
    } finally {
      setDocUploading(null)
      setTimeout(() => setDocMsg(prev => ({ ...prev, [field]: '' })), 3000)
    }
  }

  const removeDoc = async (field: string) => {
    await fetch('/api/owner/settings/branch-doc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, url: null }),
    })
    setDocUrls(prev => ({ ...prev, [field]: null }))
  }

  // ── Staff/Branch state ──
  const [staff, setStaff] = useState(initialStaff)
  const [branches, setBranches] = useState(initialBranches)
  const [promos, setPromos] = useState(initialPromos)
  const [staffModal, setStaffModal] = useState<Staff | null | 'new'>(null)
  const [branchModal, setBranchModal] = useState(false)

  // ── Save shop info ──
  const saveShop = async () => {
    setShopLoading(true); setShopMsg('')
    const res = await fetch('/api/owner/settings/shop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop_name: shopName, address, tax_id: taxId, phone, logo_url: logoUrl,
        overtime_rate: parseFloat(overtimeRate) || 50,
        hours_per_day: parseInt(hoursPerDay) || 5,
        doc_alert_days: parseInt(docDays) || 30,
        overdue_alert_hours: parseInt(overdueHours) || 2,
      }),
    })
    setShopLoading(false)
    setShopMsg(res.ok ? '✅ บันทึกแล้ว' : '❌ เกิดข้อผิดพลาด')
    setTimeout(() => setShopMsg(''), 3000)
  }

  // ── Save LINE ──
  const saveLine = async () => {
    setLineLoading(true); setLineMsg('')
    const res = await fetch('/api/owner/settings/shop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        line_token: lineToken, line_target_id: lineTarget,
        line_notify_overdue: lineOverdue, line_notify_docs: lineDocs,
        line_notify_monthly: lineMonthly, line_notify_broken: lineBroken,
      }),
    })
    setLineLoading(false)
    setLineMsg(res.ok ? '✅ บันทึกแล้ว' : '❌ เกิดข้อผิดพลาด')
    setTimeout(() => setLineMsg(''), 3000)
  }

  // ── Toggle promo ──
  const togglePromo = async (id: string, current: boolean) => {
    setPromos(prev => prev.map(p => p.id === id ? { ...p, is_active: !current } : p))
    await fetch(`/api/owner/settings/promo/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !current }),
    })
  }

  const discountLabel = (p: Promo) => {
    if (p.discount_type === 'percent') return `ลด ${p.discount_value}%`
    if (p.discount_type === 'fixed') return `ลด ฿${p.discount_value}`
    if (p.discount_type === 'bonus_days') return `เช่า ${p.min_days} วัน แถม ${p.bonus_days} วัน`
    if (p.discount_type === 'flat_rate') return `฿${p.discount_value}/วัน`
    return ''
  }

  return (
    <div style={{ paddingBottom: '40px' }}>

      {/* ── ข้อมูลร้าน ── */}
      <Section title="🏢 ข้อมูลบริษัท / ร้าน">
        <div style={{ padding: '12px 16px' }}>
          <Field label="ชื่อบริษัท / ร้าน">
            <input className="field-input" value={shopName} onChange={e => setShopName(e.target.value)} placeholder="Kuma Rental Co., Ltd." />
          </Field>
          <Field label="ที่อยู่">
            <textarea className="field-input" rows={2} value={address} onChange={e => setAddress(e.target.value)} placeholder="123/4 ถ.วิชิตสงคราม ต.กะรน อ.เมือง จ.ภูเก็ต 83100" style={{ resize: 'none' }} />
          </Field>
          <Field label="เลขประจำตัวผู้เสียภาษี" hint="ใส่เมื่อจดทะเบียน VAT แล้ว">
            <input className="field-input" value={taxId} onChange={e => setTaxId(e.target.value)} placeholder="0-0000-00000-00-0" maxLength={17} />
          </Field>
          <Field label="เบอร์โทรศัพท์">
            <input className="field-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="076-000-000" />
          </Field>
          <Field label="โลโก้ร้าน">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="logo" style={{ width: '64px', height: '64px', objectFit: 'contain', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#f9fafb' }} />
              ) : (
                <div style={{ width: '64px', height: '64px', borderRadius: '10px', border: '2px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', background: '#f9fafb' }}>🖼️</div>
              )}
              <label style={{ cursor: 'pointer' }}>
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={async e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setLogoUploading(true)
                    const fd = new FormData()
                    fd.append('file', file)
                    fd.append('folder', 'shop-logo')
                    const res = await fetch('/api/owner/upload', { method: 'POST', body: fd })
                    const data = await res.json()
                    if (res.ok) {
                      setLogoUrl(data.url)
                      // Auto-save logo_url immediately after upload
                      await fetch('/api/owner/settings/shop', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ logo_url: data.url }),
                      })
                      setShopMsg('✅ บันทึกโลโก้แล้ว')
                    }
                    setLogoUploading(false)
                  }}
                />
                <span style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600 }}>
                  {logoUploading ? '⏳ กำลังอัพโหลด...' : '📤 เปลี่ยนโลโก้'}
                </span>
              </label>
            </div>
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <SaveBtn loading={shopLoading} onClick={saveShop} />
            {shopMsg && <span style={{ fontSize: '13px', color: shopMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{shopMsg}</span>}
          </div>
        </div>
      </Section>

      {/* ── พนักงาน ── */}
      <Section title="👤 จัดการพนักงาน">
        {staff.filter(s => s.is_active).map(s => {
          const branchName = (s as any).branches?.name
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                {s.name[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>PIN: {'•'.repeat(6)} {branchName ? `• ${branchName}` : ''}</div>
              </div>
              <button onClick={() => setStaffModal(s)} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '13px', cursor: 'pointer' }}>แก้ไข</button>
            </div>
          )
        })}
        <div style={{ padding: '12px 16px' }}>
          <button onClick={() => setStaffModal('new')} className="btn" style={{ border: '1.5px solid #7c3aed', color: '#7c3aed', background: '#fff', width: '100%' }}>
            + เพิ่มพนักงาน
          </button>
        </div>
      </Section>

      {/* ── สาขา ── */}
      <Section title="🏢 จัดการสาขา">
        {branches.map(b => (
          <div key={b.id} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>{b.name}</div>
            </div>
          </div>
        ))}
        <div style={{ padding: '12px 16px' }}>
          <button onClick={() => setBranchModal(true)} className="btn" style={{ border: '1.5px solid #7c3aed', color: '#7c3aed', background: '#fff', width: '100%' }}>
            + เพิ่มสาขา
          </button>
        </div>
      </Section>

      {/* ── ราคาและล่วงเวลา ── */}
      <Section title="💰 ราคาและค่าล่วงเวลา">
        <div style={{ padding: '12px 16px' }}>
          <Field label="ค่าล่วงเวลา (บาท/ชั่วโมง)">
            <input className="field-input" type="number" value={overtimeRate} onChange={e => setOvertimeRate(e.target.value)} />
          </Field>
          <Field label="กี่ชั่วโมงเท่ากับ 1 วัน">
            <input className="field-input" type="number" value={hoursPerDay} onChange={e => setHoursPerDay(e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* ── เอกสารร้าน ── */}
      <Section title="📄 เอกสารร้าน (ขึ้นทุกคัน)">
        <div style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
            เอกสารเหล่านี้จะแสดงในหน้าสาธารณะของรถทุกคัน ไม่ต้องอัพโหลดซ้ำรายคัน
          </div>
          {([
            { field: 'contract_photo_url', icon: '📝', label: 'สัญญาการเช่า' },
            { field: 'terms_photo_url', icon: '📋', label: 'ข้อกำหนดการใช้รถ' },
            { field: 'manual_photo_url', icon: '📖', label: 'คู่มือเมื่อเกิดเหตุ' },
          ] as { field: keyof typeof docUrls; icon: string; label: string }[]).map(({ field, icon, label }) => {
            const url = docUrls[field]
            const uploading = docUploading === field
            const msg = docMsg[field]
            return (
              <div key={field} style={{ padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '20px' }}>{icon}</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, flex: 1 }}>{label}</span>
                  {msg && <span style={{ fontSize: '12px', color: msg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{msg}</span>}
                </div>
                {url ? (
                  <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden' }}>
                    <img src={url} alt={label} style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', display: 'block', borderRadius: '10px', border: '1px solid #e5e7eb' }} />
                    <button onClick={() => removeDoc(field)} style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                  </div>
                ) : (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', border: '1.5px dashed #d1d5db', borderRadius: '10px', cursor: 'pointer', background: '#f9fafb' }}>
                    <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(field, f) }} />
                    {uploading
                      ? <><div style={{ width: '16px', height: '16px', border: '2px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} /><span style={{ fontSize: '13px', color: '#6b7280' }}>กำลังอัพโหลด...</span></>
                      : <><span style={{ fontSize: '20px' }}>⬆️</span><span style={{ fontSize: '13px', color: '#6b7280' }}>แตะเพื่ออัพโหลด {label}</span></>
                    }
                  </label>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      {/* ── โปรโมชั่น ── */}
      <Section title="🎁 โปรโมชั่น">
        <div style={{ padding: '12px 16px' }}>
          {promos.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{p.name ?? p.description ?? p.code}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>{discountLabel(p)}</div>
              </div>
              <Toggle on={p.is_active} onClick={() => togglePromo(p.id, p.is_active)} />
            </div>
          ))}
          <Link href="/owner/settings/promos/create" className="btn" style={{ display: 'block', textAlign: 'center', marginTop: '12px', border: '1.5px solid #7c3aed', color: '#7c3aed', background: '#fff', textDecoration: 'none' }}>
            + สร้างโปรโมชั่นใหม่
          </Link>
        </div>
      </Section>

      {/* ── การแจ้งเตือน ── */}
      <Section title="🔔 การแจ้งเตือน">
        <div style={{ padding: '12px 16px' }}>
          <Field label="แจ้งเตือนก่อนเอกสารหมดอายุ (วัน)">
            <input className="field-input" type="number" value={docDays} onChange={e => setDocDays(e.target.value)} />
          </Field>
          <Field label="แจ้งเตือนเมื่อลูกค้าเกินกำหนดคืน (ชม.)">
            <input className="field-input" type="number" value={overdueHours} onChange={e => setOverdueHours(e.target.value)} />
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <SaveBtn loading={shopLoading} onClick={saveShop} />
            {shopMsg && <span style={{ fontSize: '13px', color: shopMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{shopMsg}</span>}
          </div>
        </div>
      </Section>

      {/* ── LINE Notification ── */}
      <Section title="💬 LINE Notification">
        <div style={{ margin: '12px 16px 0', background: '#f0fdf4', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#166534', border: '1px solid #bbf7d0' }}>
          ระบบจะส่งแจ้งเตือนเข้า LINE OA อัตโนมัติสำหรับ event สำคัญ
        </div>
        <div style={{ padding: '12px 16px' }}>
          <Field label="LINE Channel Access Token">
            <input className="field-input" type="password" value={lineToken} onChange={e => setLineToken(e.target.value)} placeholder="วางได้จาก LINE Developers Console" />
          </Field>
          <Field label="LINE Group / User ID" hint="เพิ่มบอทเข้ากลุ่มไลน์ Staff แล้ว copy Group ID มาใส่">
            <input className="field-input" value={lineTarget} onChange={e => setLineTarget(e.target.value)} placeholder="C... หรือ U..." />
          </Field>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>เปิดแจ้งเตือนสำหรับ</div>
          {[
            { label: '⏰ ลูกค้าเกินกำหนดคืนรถ', val: lineOverdue, set: setLineOverdue },
            { label: '📄 เอกสารรถใกล้หมดอายุ', val: lineDocs, set: setLineDocs },
            { label: '💜 ค่าเช่ารายเดือนค้างชำระ', val: lineMonthly, set: setLineMonthly },
            { label: '🛵💥 มีแจ้งรถเสียใหม่', val: lineBroken, set: setLineBroken },
          ].map(({ label, val, set }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
              <span style={{ flex: 1, fontSize: '14px' }}>{label}</span>
              <Toggle on={val} onClick={() => set(!val)} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button className="btn" style={{ flex: 1, border: '1.5px solid #00b900', color: '#00b900', background: '#fff' }}>
              🧪 ทดสอบส่ง LINE
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
            <SaveBtn loading={lineLoading} onClick={saveLine} />
            {lineMsg && <span style={{ fontSize: '13px', color: lineMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{lineMsg}</span>}
          </div>
        </div>
      </Section>

      {/* Modals */}
      {staffModal && (
        <StaffModal
          branches={branches}
          editing={staffModal === 'new' ? undefined : staffModal as Staff}
          onClose={() => setStaffModal(null)}
          onSaved={(saved) => {
            setStaffModal(null)
            setStaff(prev => {
              const exists = prev.find(s => s.id === saved.id)
              if (exists) return prev.map(s => s.id === saved.id ? saved : s)
              return [...prev, saved]
            })
          }}
        />
      )}
      {branchModal && (
        <BranchModal
          onClose={() => setBranchModal(false)}
          onSaved={(saved) => {
            setBranchModal(false)
            setBranches(prev => [...prev, saved])
          }}
        />
      )}
    </div>
  )
}
