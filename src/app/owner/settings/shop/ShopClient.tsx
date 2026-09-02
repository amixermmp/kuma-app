'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section, Field, SaveBtn, SettingsHeader, type Branch } from '../_shared'

type Shop = Record<string, any>

function BranchCloseTimeRow({ branch }: { branch: Branch }) {
  const router = useRouter()
  const [time, setTime] = useState(branch.closeTimeEarliest ?? '')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const [branchName, setBranchName] = useState(branch.name)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(branch.name)
  const [nameLoading, setNameLoading] = useState(false)
  const [nameError, setNameError] = useState('')

  const save = async () => {
    setLoading(true)
    const res = await fetch('/api/owner/settings/branch-closetime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_id: branch.id, close_time_earliest: time || null }),
    })
    setLoading(false)
    setMsg(res.ok ? '✅' : '❌')
    setTimeout(() => setMsg(''), 2000)
  }

  const saveName = async () => {
    if (!nameInput.trim()) { setNameError('กรุณาใส่ชื่อสาขา'); return }
    setNameLoading(true)
    setNameError('')
    try {
      const res = await fetch('/api/owner/settings/branch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: branch.id, name: nameInput.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setNameError(data.error ?? `เกิดข้อผิดพลาด (${res.status})`); return }
      setBranchName(nameInput.trim())
      setEditingName(false)
      router.refresh()
    } catch {
      setNameError('เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setNameLoading(false)
    }
  }

  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
      {editingName ? (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input className="field-input" value={nameInput} onChange={e => setNameInput(e.target.value)} style={{ flex: 1 }} />
            <button onClick={saveName} disabled={nameLoading} className="btn" style={{ padding: '8px 12px', fontSize: '12px', width: 'auto' }}>
              {nameLoading ? '⏳' : '✅'}
            </button>
            <button onClick={() => { setEditingName(false); setNameInput(branchName); setNameError('') }} className="btn" style={{ padding: '8px 12px', fontSize: '12px', width: 'auto', background: '#f3f4f6', color: '#374151' }}>
              ✕
            </button>
          </div>
          {nameError && <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>{nameError}</div>}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, flex: 1 }}>{branchName}</div>
          <button onClick={() => { setEditingName(true); setNameInput(branchName) }} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: '4px 8px' }}>
            แก้ไข
          </button>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ flex: 1, fontSize: '11px', color: '#9ca3af' }}>เวลาปิดร้านเร็วสุด</div>
        <input type="time" className="field-input" style={{ width: '110px' }} value={time} onChange={e => setTime(e.target.value)} />
        <button onClick={save} disabled={loading} className="btn" style={{ padding: '8px 12px', fontSize: '12px', width: 'auto' }}>
          {loading ? '⏳' : msg || '💾'}
        </button>
      </div>
    </div>
  )
}

function BranchQrRow({ branch }: { branch: Branch }) {
  const [dailyUrl, setDailyUrl] = useState(branch.paymentQrDailyUrl ?? '')
  const [monthlyUrl, setMonthlyUrl] = useState(branch.paymentQrMonthlyUrl ?? '')
  const [uploading, setUploading] = useState<'daily' | 'monthly' | null>(null)
  const [msg, setMsg] = useState('')

  const save = async (fields: { payment_qr_daily_url?: string; payment_qr_monthly_url?: string }) => {
    const res = await fetch('/api/owner/settings/branch-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_id: branch.id,
        payment_qr_daily_url: dailyUrl,
        payment_qr_monthly_url: monthlyUrl,
        ...fields,
      }),
    })
    setMsg(res.ok ? '✅ บันทึกแล้ว' : '❌ เกิดข้อผิดพลาด')
    setTimeout(() => setMsg(''), 3000)
  }

  const upload = async (kind: 'daily' | 'monthly', file: File) => {
    setUploading(kind)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'branch-payment-qr')
      const res = await fetch('/api/owner/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      if (kind === 'daily') { setDailyUrl(data.url); await save({ payment_qr_daily_url: data.url }) }
      else { setMonthlyUrl(data.url); await save({ payment_qr_monthly_url: data.url }) }
    } catch (e) {
      setMsg('❌ ' + (e instanceof Error ? e.message : 'อัพโหลดไม่สำเร็จ'))
      setTimeout(() => setMsg(''), 3000)
    } finally {
      setUploading(null)
    }
  }

  const QrSlot = ({ kind, label, url }: { kind: 'daily' | 'monthly'; label: string; url: string }) => (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>{label}</div>
      {url ? (
        <div style={{ position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} style={{ width: '100%', height: '90px', objectFit: 'contain', background: '#f3f4f6', borderRadius: '8px' }} />
          <label style={{
            position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(17,24,39,.8)', color: '#fff',
            fontSize: '11px', padding: '3px 8px', borderRadius: '6px', cursor: 'pointer',
          }}>
            {uploading === kind ? '...' : 'เปลี่ยน'}
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) upload(kind, f) }} />
          </label>
        </div>
      ) : (
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', height: '90px',
          border: '1.5px dashed #d1d5db', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: '#9ca3af',
        }}>
          {uploading === kind ? 'กำลังอัพโหลด...' : '+ อัพโหลด'}
          <input type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) upload(kind, f) }} />
        </label>
      )}
    </div>
  )

  return (
    <div style={{ border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '14px', margin: '0 16px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <span style={{ fontWeight: 800, fontSize: '14px', color: '#111827', flex: 1 }}>📍 {branch.name}</span>
        {msg && <span style={{ fontSize: '12px', color: msg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{msg}</span>}
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <QrSlot kind="daily" label="QR รายวัน" url={dailyUrl} />
        <QrSlot kind="monthly" label="QR รายเดือน" url={monthlyUrl} />
      </div>
    </div>
  )
}

function BranchLineRow({ branch }: { branch: Branch }) {
  const [qrUrl, setQrUrl] = useState(branch.lineQrUrl ?? '')
  const [lineId, setLineId] = useState(branch.lineId ?? '')
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')

  const save = async (fields: { line_qr_url?: string; line_id?: string }) => {
    const res = await fetch('/api/owner/settings/branch-line-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_id: branch.id,
        line_qr_url: qrUrl,
        line_id: lineId,
        ...fields,
      }),
    })
    setMsg(res.ok ? '✅ บันทึกแล้ว' : '❌ เกิดข้อผิดพลาด')
    setTimeout(() => setMsg(''), 3000)
  }

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'branch-line-qr')
      const res = await fetch('/api/owner/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setQrUrl(data.url)
      await save({ line_qr_url: data.url })
    } catch (e) {
      setMsg('❌ ' + (e instanceof Error ? e.message : 'อัพโหลดไม่สำเร็จ'))
      setTimeout(() => setMsg(''), 3000)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '14px', margin: '0 16px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <span style={{ fontWeight: 800, fontSize: '14px', color: '#111827', flex: 1 }}>📍 {branch.name}</span>
        {msg && <span style={{ fontSize: '12px', color: msg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{msg}</span>}
      </div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>QR ไลน์ร้าน</div>
          {qrUrl ? (
            <div style={{ position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt="QR ไลน์" style={{ width: '100%', height: '90px', objectFit: 'contain', background: '#f3f4f6', borderRadius: '8px' }} />
              <label style={{
                position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(17,24,39,.8)', color: '#fff',
                fontSize: '11px', padding: '3px 8px', borderRadius: '6px', cursor: 'pointer',
              }}>
                {uploading ? '...' : 'เปลี่ยน'}
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }} />
              </label>
            </div>
          ) : (
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', height: '90px',
              border: '1.5px dashed #d1d5db', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: '#9ca3af',
            }}>
              {uploading ? 'กำลังอัพโหลด...' : '+ อัพโหลด'}
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }} />
            </label>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>LINE ID</div>
          <input className="field-input" value={lineId} onChange={e => setLineId(e.target.value)} placeholder="@kumabike" />
        </div>
        <button onClick={() => save({})} className="btn" style={{ padding: '10px 14px', fontSize: '12px', width: 'auto' }}>
          💾
        </button>
      </div>
    </div>
  )
}

function BranchReceiptRow({ branch }: { branch: Branch }) {
  const [shopName, setShopName] = useState(branch.receiptShopName ?? '')
  const [address, setAddress] = useState(branch.receiptAddress ?? '')
  const [phone, setPhone] = useState(branch.receiptPhone ?? '')
  const [logoUrl, setLogoUrl] = useState(branch.receiptLogoUrl ?? '')
  const [logoUploading, setLogoUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const save = async (overrideLogoUrl?: string) => {
    setLoading(true)
    const res = await fetch('/api/owner/settings/branch-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_id: branch.id,
        receipt_shop_name: shopName,
        receipt_address: address,
        receipt_phone: phone,
        receipt_logo_url: overrideLogoUrl ?? logoUrl,
      }),
    })
    setLoading(false)
    setMsg(res.ok ? '✅ บันทึกแล้ว' : '❌ เกิดข้อผิดพลาด')
    setTimeout(() => setMsg(''), 3000)
  }

  const uploadLogo = async (file: File) => {
    setLogoUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'branch-receipt-logo')
      const res = await fetch('/api/owner/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setLogoUrl(data.url)
      await save(data.url)
    } catch (e) {
      setMsg('❌ ' + (e instanceof Error ? e.message : 'อัพโหลดไม่สำเร็จ'))
      setTimeout(() => setMsg(''), 3000)
    } finally {
      setLogoUploading(false)
    }
  }

  return (
    <div style={{ border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '14px', margin: '0 16px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <span style={{ fontWeight: 800, fontSize: '14px', color: '#111827', flex: 1 }}>📍 {branch.name}</span>
        {msg && <span style={{ fontSize: '12px', color: msg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{msg}</span>}
      </div>
      <Field label="โลโก้ในใบเสร็จ" hint="ว่าง = ใช้โลโก้ร้านกลาง">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="logo" style={{ width: '56px', height: '56px', objectFit: 'contain', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#f9fafb' }} />
          ) : (
            <div style={{ width: '56px', height: '56px', borderRadius: '10px', border: '2px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', background: '#f9fafb' }}>🖼️</div>
          )}
          <label style={{ cursor: 'pointer' }}>
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f) }} />
            <span style={{ background: '#f1f5f9', color: '#374151', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600 }}>
              {logoUploading ? '⏳ กำลังอัพโหลด...' : '📤 เปลี่ยนโลโก้'}
            </span>
          </label>
        </div>
      </Field>
      <Field label="ชื่อร้านในใบเสร็จ" hint="ว่าง = ใช้ชื่อร้านกลาง">
        <input className="field-input" value={shopName} onChange={e => setShopName(e.target.value)} placeholder="Kuma Rental บางแสน" />
      </Field>
      <Field label="ที่อยู่ในใบเสร็จ" hint="ว่าง = ใช้ที่อยู่กลาง">
        <textarea className="field-input" rows={2} value={address} onChange={e => setAddress(e.target.value)} style={{ resize: 'none' }} />
      </Field>
      <Field label="เบอร์โทรในใบเสร็จ" hint="ว่าง = ใช้เบอร์กลาง">
        <input className="field-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="038-000-000" />
      </Field>
      <button onClick={() => save()} disabled={loading} className="btn" style={{ width: '100%' }}>
        {loading ? '⏳' : '💾 บันทึก'}
      </button>
    </div>
  )
}

function BranchStudentPromoRow({ branch }: { branch: Branch }) {
  const [university, setUniversity] = useState(branch.studentPromoUniversity ?? '')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const save = async () => {
    setLoading(true)
    const res = await fetch('/api/owner/settings/branch-student-promo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_id: branch.id, student_promo_university: university }),
    })
    setLoading(false)
    setMsg(res.ok ? '✅ บันทึกแล้ว' : '❌ เกิดข้อผิดพลาด')
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, flex: 1 }}>📍 {branch.name}</div>
        {msg && <span style={{ fontSize: '12px', color: msg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{msg}</span>}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input className="field-input" value={university} onChange={e => setUniversity(e.target.value)}
          placeholder="เช่น ม.บูรพา (ว่าง = ไม่ถามเพิ่ม)" style={{ flex: 1 }} />
        <button onClick={save} disabled={loading} className="btn" style={{ padding: '10px 14px', fontSize: '12px', width: 'auto' }}>
          {loading ? '⏳' : '💾'}
        </button>
      </div>
    </div>
  )
}

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

export default function ShopClient({ shop, branches: initialBranches }: { shop: Shop; branches: Branch[] }) {
  const [shopName, setShopName] = useState(shop.shop_name ?? '')
  const [address, setAddress] = useState(shop.address ?? '')
  const [taxId, setTaxId] = useState(shop.tax_id ?? '')
  const [phone, setPhone] = useState(shop.phone ?? '')
  const [logoUrl, setLogoUrl] = useState(shop.logo_url ?? '')
  const [logoUploading, setLogoUploading] = useState(false)
  const [overtimeRate, setOvertimeRate] = useState(String(shop.overtime_rate ?? 50))
  const [hoursPerDay, setHoursPerDay] = useState(String(shop.hours_per_day ?? 5))
  const [shopLoading, setShopLoading] = useState(false)
  const [shopMsg, setShopMsg] = useState('')

  const [branches, setBranches] = useState(initialBranches)
  const [branchModal, setBranchModal] = useState(false)

  const saveShop = async () => {
    setShopLoading(true); setShopMsg('')
    const res = await fetch('/api/owner/settings/shop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop_name: shopName, address, tax_id: taxId, phone, logo_url: logoUrl,
        overtime_rate: parseFloat(overtimeRate) || 50,
        hours_per_day: parseInt(hoursPerDay) || 5,
      }),
    })
    setShopLoading(false)
    setShopMsg(res.ok ? '✅ บันทึกแล้ว' : '❌ เกิดข้อผิดพลาด')
    setTimeout(() => setShopMsg(''), 3000)
  }

  return (
    <>
      <SettingsHeader title="🏢 ร้านค้า" sub="ข้อมูลร้าน, สาขา, ราคา/ค่าล่วงเวลา" />

      <div style={{ paddingBottom: '40px' }}>
        <Section title="ข้อมูลบริษัท / ร้าน">
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
                  <span style={{ background: '#f1f5f9', color: '#374151', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600 }}>
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

        <Section title="จัดการสาขา">
          {branches.map(b => (
            <BranchCloseTimeRow key={b.id} branch={b} />
          ))}
          <div style={{ padding: '12px 16px' }}>
            <button onClick={() => setBranchModal(true)} className="btn" style={{ border: '1.5px solid #374151', color: '#374151', background: '#fff', width: '100%' }}>
              + เพิ่มสาขา
            </button>
          </div>
        </Section>

        <Section title="QR รับเงิน">
          <div style={{ padding: '12px 16px 0', fontSize: '12px', color: '#6b7280' }}>
            แสดงตอนพนักงานทำรายการเช่า (ส่งรถ/สร้างสัญญา) และในสัญญาเช่าที่แชร์ให้ลูกค้า — สาขาไหนไม่อัพโหลดจะไม่มี QR โชว์เลย
          </div>
          <div style={{ padding: '12px 0' }}>
            {branches.map(b => (
              <BranchQrRow key={b.id} branch={b} />
            ))}
          </div>
        </Section>

        <Section title="ไลน์ร้าน">
          <div style={{ padding: '12px 16px 0', fontSize: '12px', color: '#6b7280' }}>
            แสดงท้ายฟอร์มส่งรถ เตือนพนักงานให้ลูกค้าแอดไลน์ร้าน — สาขาไหนไม่ตั้งค่าจะไม่มีโชว์เลย
          </div>
          <div style={{ padding: '12px 0' }}>
            {branches.map(b => (
              <BranchLineRow key={b.id} branch={b} />
            ))}
          </div>
        </Section>

        <Section title="โปรนักศึกษา — มหาลัยที่ให้สิทธิ์">
          <div style={{ padding: '12px 16px 0', fontSize: '12px', color: '#6b7280' }}>
            ตั้งชื่อมหาลัยที่สาขานี้ให้สิทธิ์โปรนักศึกษา — ตอนส่งรถถ้ารุ่นนั้นมีโปรนักศึกษาอยู่แล้ว จะถามพนักงานว่าเป็นมหาลัยนี้ไหม แล้วผูกโปรให้อัตโนมัติ ไม่ต้องกดซ้ำ (ว่าง = ไม่ถามเพิ่ม เหมือนเดิม)
          </div>
          {branches.map(b => (
            <BranchStudentPromoRow key={b.id} branch={b} />
          ))}
        </Section>

        <Section title="ใบเสร็จรับเงิน">
          <div style={{ padding: '12px 16px 0', fontSize: '12px', color: '#6b7280' }}>
            ชื่อร้าน/ที่อยู่/เบอร์โทร ที่จะขึ้นในใบเสร็จของแต่ละสาขา — สาขาไหนไม่ตั้งค่าจะใช้ข้อมูล &quot;ข้อมูลบริษัท / ร้าน&quot; ด้านบนแทน
          </div>
          <div style={{ padding: '12px 0' }}>
            {branches.map(b => (
              <BranchReceiptRow key={b.id} branch={b} />
            ))}
          </div>
        </Section>

        <Section title="ราคาและค่าล่วงเวลา">
          <div style={{ padding: '12px 16px' }}>
            <Field label="ค่าล่วงเวลา (บาท/ชั่วโมง)">
              <input className="field-input" type="number" value={overtimeRate} onChange={e => setOvertimeRate(e.target.value)} />
            </Field>
            <Field label="กี่ชั่วโมงเท่ากับ 1 วัน">
              <input className="field-input" type="number" value={hoursPerDay} onChange={e => setHoursPerDay(e.target.value)} />
            </Field>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <SaveBtn loading={shopLoading} onClick={saveShop} />
              {shopMsg && <span style={{ fontSize: '13px', color: shopMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{shopMsg}</span>}
            </div>
          </div>
        </Section>
      </div>

      {branchModal && (
        <BranchModal
          onClose={() => setBranchModal(false)}
          onSaved={(saved) => {
            setBranchModal(false)
            setBranches(prev => [...prev, saved])
          }}
        />
      )}
    </>
  )
}
