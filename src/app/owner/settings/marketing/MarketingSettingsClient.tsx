'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Section, SettingsHeader, type Branch } from '../_shared'
import { compressImagePng } from '@/lib/compressImage'

type BranchAssets = { branch_id: string; frame_url: string | null; sticker_url: string | null }

function BranchMarketingCard({ branch, initial }: { branch: Branch; initial?: BranchAssets }) {
  const [frameUrl, setFrameUrl] = useState(initial?.frame_url ?? '')
  const [stickerUrl, setStickerUrl] = useState(initial?.sticker_url ?? '')
  const [uploading, setUploading] = useState<'frame' | 'sticker' | null>(null)
  const [msg, setMsg] = useState('')

  const save = async (fields: { frame_url?: string; sticker_url?: string }) => {
    const res = await fetch('/api/owner/settings/branch-marketing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_id: branch.id, frame_url: frameUrl, sticker_url: stickerUrl, ...fields }),
    })
    if (res.ok) {
      setMsg('✅ บันทึกแล้ว')
    } else {
      const data = await res.json().catch(() => null)
      setMsg('❌ ' + (data?.error ?? `บันทึกไม่สำเร็จ (HTTP ${res.status})`))
    }
    setTimeout(() => setMsg(''), 5000)
  }

  const upload = async (kind: 'frame' | 'sticker', file: File) => {
    setUploading(kind)
    try {
      const compressed = await compressImagePng(file)
      const fd = new FormData()
      fd.append('file', new File([compressed], 'image.png', { type: 'image/png' }))
      fd.append('folder', 'branch-marketing')
      const res = await fetch('/api/owner/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? data.detail ?? `HTTP ${res.status}`)
      if (kind === 'frame') { setFrameUrl(data.url); await save({ frame_url: data.url }) }
      else { setStickerUrl(data.url); await save({ sticker_url: data.url }) }
    } catch (e) {
      setMsg('❌ ' + (e instanceof Error ? e.message : 'อัพโหลดไม่สำเร็จ'))
      setTimeout(() => setMsg(''), 5000)
    } finally {
      setUploading(null)
    }
  }

  const AssetSlot = ({ kind, label, url }: { kind: 'frame' | 'sticker'; label: string; url: string }) => (
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
    <div style={{ border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <span style={{ fontWeight: 800, fontSize: '14px', color: '#111827', flex: 1 }}>📍 {branch.name}</span>
        {msg && <span style={{ fontSize: '12px', color: msg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{msg}</span>}
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <AssetSlot kind="frame" label="กรอบรูป" url={frameUrl} />
        <AssetSlot kind="sticker" label="สติ๊กเกอร์ปิดหน้า" url={stickerUrl} />
      </div>
    </div>
  )
}

export default function MarketingSettingsClient({ branches, branchAssets }: { branches: Branch[]; branchAssets: BranchAssets[] }) {
  return (
    <>
      <SettingsHeader title="🖼️ รูปโปรโมท" sub="กรอบ/สติ๊กเกอร์ปิดหน้า รายสาขา" />

      <div style={{ paddingBottom: '40px' }}>
        <Section title="กรอบ+สติ๊กเกอร์ปิดหน้า รูปคู่รถ (รายสาขา)">
          <div style={{ margin: '12px 16px 0', background: '#f0fdf4', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#166534', border: '1px solid #bbf7d0' }}>
            ใช้ตอนเตรียมรูปคู่รถลูกค้าไว้โพสรีวิว — ดูผลลัพธ์และดาวน์โหลดได้ที่หน้า{' '}
            <Link href="/owner/marketing" style={{ color: '#166534', fontWeight: 700 }}>รูปโปรโมท</Link>
          </div>
          <div style={{ padding: '12px 16px' }}>
            {branches.map(b => (
              <BranchMarketingCard key={b.id} branch={b} initial={branchAssets.find(l => l.branch_id === b.id)} />
            ))}
          </div>
        </Section>
      </div>
    </>
  )
}
