'use client'

import { useState } from 'react'

// คัดลอกข้อความลงคลิปบอร์ด — มือถือบางรุ่น/บางเบราว์เซอร์ไม่ให้ใช้ clipboard API ตรงๆ เลยมีทางสำรองด้วยการเลือกข้อความในช่องชั่วคราว
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      ta.setSelectionRange(0, text.length)
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

export function CopyButton({ text, label = '📋 คัดลอก', small = false }: { text: string; label?: string; small?: boolean }) {
  const [state, setState] = useState<'idle' | 'done' | 'fail'>('idle')
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyText(text)
        setState(ok ? 'done' : 'fail')
        setTimeout(() => setState('idle'), 2000)
      }}
      style={{
        padding: small ? '5px 10px' : '10px 16px', borderRadius: '10px', fontSize: small ? '12px' : '14px', fontWeight: 700,
        fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
        border: '1.5px solid #16a34a', background: state === 'done' ? '#16a34a' : '#fff', color: state === 'done' ? '#fff' : '#16a34a',
      }}
    >
      {state === 'done' ? '✅ คัดลอกแล้ว' : state === 'fail' ? '❌ คัดลอกไม่ได้ ลองเลือกข้อความเอง' : label}
    </button>
  )
}

// กล่องข้อความพร้อมปุ่มคัดลอก — ข้อความแก้ไม่ได้ในกล่อง (แก้ที่ฟอร์ม) แต่เลือกก๊อปเองได้
export default function CopyBlock({ title, text, note, loading = false, error = '' }: {
  title: string
  text: string | null
  note?: string
  loading?: boolean
  error?: string
}) {
  return (
    <div className="card" style={{ borderTop: '3px solid #16a34a' }}>
      <div className="card-title">{title}</div>
      {loading ? (
        <div style={{ fontSize: '13px', color: '#9ca3af', padding: '8px 0' }}>⏳ กำลังเตรียมข้อความ...</div>
      ) : error ? (
        <div style={{ fontSize: '13px', color: '#dc2626', padding: '8px 0' }}>⚠️ {error}</div>
      ) : text ? (
        <>
          <div style={{
            background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px',
            fontSize: '14px', lineHeight: 1.7, color: '#111827', whiteSpace: 'pre-wrap', textAlign: 'left', marginBottom: '10px',
            userSelect: 'text',
          }}>{text}</div>
          <CopyButton text={text} label="📋 คัดลอกข้อความ" />
        </>
      ) : null}
      {note && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px', textAlign: 'left' }}>{note}</div>}
    </div>
  )
}
