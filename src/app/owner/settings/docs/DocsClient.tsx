'use client'

import { useState } from 'react'
import { Section, SettingsHeader } from '../_shared'

type BranchDocs = { terms_photo_url: string | null; manual_photo_url: string | null; contract_photo_url: string | null }

export default function DocsClient({ branchId, branchDocs }: { branchId: string; branchDocs: BranchDocs }) {
  const [docUrls, setDocUrls] = useState(branchDocs)
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
        body: JSON.stringify({ branch_id: branchId, field, url: upData.url }),
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
      body: JSON.stringify({ branch_id: branchId, field, url: null }),
    })
    setDocUrls(prev => ({ ...prev, [field]: null }))
  }

  return (
    <>
      <SettingsHeader title="📄 เอกสารร้าน" sub="สัญญา/ข้อกำหนด/คู่มือ ขึ้นทุกคัน" />

      <div style={{ paddingBottom: '40px' }}>
        <Section title="เอกสารร้าน (ขึ้นทุกคัน)">
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
              เอกสารเหล่านี้จะแสดงในหน้าสาธารณะของรถทุกคัน ไม่ต้องอัพโหลดซ้ำรายคัน
            </div>
            {([
              { field: 'contract_photo_url', icon: '📝', label: 'สัญญาการเช่า' },
              { field: 'terms_photo_url', icon: '📋', label: 'ข้อกำหนดการใช้รถ' },
              { field: 'manual_photo_url', icon: '📖', label: 'คู่มือเมื่อเกิดเหตุ' },
            ] as { field: keyof BranchDocs; icon: string; label: string }[]).map(({ field, icon, label }) => {
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
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={label} style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', display: 'block', borderRadius: '10px', border: '1px solid #e5e7eb' }} />
                      <button onClick={() => removeDoc(field)} style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                    </div>
                  ) : (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', border: '1.5px dashed #d1d5db', borderRadius: '10px', cursor: 'pointer', background: '#f9fafb' }}>
                      <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading}
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(field, f) }} />
                      {uploading
                        ? <><div style={{ width: '16px', height: '16px', border: '2px solid #e5e7eb', borderTopColor: '#e11d48', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} /><span style={{ fontSize: '13px', color: '#6b7280' }}>กำลังอัพโหลด...</span></>
                        : <><span style={{ fontSize: '20px' }}>⬆️</span><span style={{ fontSize: '13px', color: '#6b7280' }}>แตะเพื่ออัพโหลด {label}</span></>
                      }
                    </label>
                  )}
                </div>
              )
            })}
          </div>
        </Section>
      </div>
    </>
  )
}
