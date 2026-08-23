'use client'

import { useState } from 'react'
import { Section, Field, SaveBtn, SettingsHeader, type Branch } from '../_shared'

type Shop = Record<string, any>

function BranchCloseTimeRow({ branch }: { branch: Branch }) {
  const [time, setTime] = useState(branch.closeTimeEarliest ?? '')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

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

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 600 }}>{branch.name}</div>
        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>เวลาปิดร้านเร็วสุด</div>
      </div>
      <input type="time" className="field-input" style={{ width: '110px' }} value={time} onChange={e => setTime(e.target.value)} />
      <button onClick={save} disabled={loading} className="btn" style={{ padding: '8px 12px', fontSize: '12px', width: 'auto' }}>
        {loading ? '⏳' : msg || '💾'}
      </button>
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
