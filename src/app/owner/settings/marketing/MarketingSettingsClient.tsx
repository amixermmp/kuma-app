'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Section, SettingsHeader, type Branch } from '../_shared'
import { compressImagePng } from '@/lib/compressImage'

type BranchAssets = {
  branch_id: string; frame_url: string | null; frame2_url: string | null; sticker_url: string | null
  caption_facebook: string | null; caption_instagram: string | null; caption_tiktok: string | null
}
const CAPTION_CHANNELS = [
  { key: 'caption_facebook', label: 'เพจ Facebook' },
  { key: 'caption_instagram', label: 'Instagram' },
  { key: 'caption_tiktok', label: 'TikTok' },
] as const
type CaptionKey = typeof CAPTION_CHANNELS[number]['key']
type AssetKind = 'frame' | 'frame2' | 'sticker'

function BranchMarketingCard({ branch, initial }: { branch: Branch; initial?: BranchAssets }) {
  const [frameUrl, setFrameUrl] = useState(initial?.frame_url ?? '')
  const [frame2Url, setFrame2Url] = useState(initial?.frame2_url ?? '')
  const [stickerUrl, setStickerUrl] = useState(initial?.sticker_url ?? '')
  const [uploading, setUploading] = useState<AssetKind | null>(null)
  const [msg, setMsg] = useState('')
  const [captions, setCaptions] = useState<Record<CaptionKey, string>>({
    caption_facebook: initial?.caption_facebook ?? '',
    caption_instagram: initial?.caption_instagram ?? '',
    caption_tiktok: initial?.caption_tiktok ?? '',
  })

  const save = async (fields: { frame_url?: string; frame2_url?: string; sticker_url?: string; caption_facebook?: string; caption_instagram?: string; caption_tiktok?: string }) => {
    const res = await fetch('/api/owner/settings/branch-marketing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_id: branch.id, frame_url: frameUrl, frame2_url: frame2Url, sticker_url: stickerUrl, ...fields }),
    })
    if (res.ok) {
      setMsg('✅ บันทึกแล้ว')
    } else {
      const data = await res.json().catch(() => null)
      setMsg('❌ ' + (data?.error ?? `บันทึกไม่สำเร็จ (HTTP ${res.status})`))
    }
    setTimeout(() => setMsg(''), 5000)
  }

  const upload = async (kind: AssetKind, file: File) => {
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
      else if (kind === 'frame2') { setFrame2Url(data.url); await save({ frame2_url: data.url }) }
      else { setStickerUrl(data.url); await save({ sticker_url: data.url }) }
    } catch (e) {
      setMsg('❌ ' + (e instanceof Error ? e.message : 'อัพโหลดไม่สำเร็จ'))
      setTimeout(() => setMsg(''), 5000)
    } finally {
      setUploading(null)
    }
  }

  const AssetSlot = ({ kind, label, url }: { kind: AssetKind; label: string; url: string }) => (
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
      <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
        <AssetSlot kind="frame2" label="กรอบรวมสาขา (IG/TikTok) — ไม่บังคับ" url={frame2Url} />
        <div style={{ flex: 1, fontSize: '11px', color: '#6b7280', lineHeight: 1.6 }}>
          ถ้าอัปโหลด หน้ารูปโปรโมทของสาขานี้จะทำให้ 2 แบบพร้อมกัน (กรอบสาขา + กรอบรวม) ต้องเป็น PNG ที่ช่องใส่รูปโปร่งใส เหมือนกรอบสาขา
        </div>
      </div>

      {/* แคปชั่นสำหรับโพสต์ แยกตามช่องทาง — พนักงานกดปุ่ม "แคปชั่น" ในหน้ารูปโปรโมทแล้วคัดลอกไปวางได้เลย ช่องที่ว่างไม่ขึ้น */}
      <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>📝 แคปชั่นสำหรับโพสต์ (พนักงานกดคัดลอกจากหน้ารูปโปรโมท) — เว้นว่างถ้าไม่ใช้ช่องทางนั้น</div>
        {CAPTION_CHANNELS.map(c => (
          <div key={c.key} style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>{c.label}</div>
            <textarea
              value={captions[c.key]} rows={4}
              onChange={e => setCaptions(prev => ({ ...prev, [c.key]: e.target.value }))}
              placeholder={`ข้อความแคปชั่นสำหรับ ${c.label}`}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>
        ))}
        <button
          onClick={() => save({ caption_facebook: captions.caption_facebook, caption_instagram: captions.caption_instagram, caption_tiktok: captions.caption_tiktok })}
          style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#111827', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
        >💾 บันทึกแคปชั่น</button>
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
