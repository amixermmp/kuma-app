'use client'

import Link from 'next/link'

export type Branch = { id: string; name: string }

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '8px', background: '#fff' }}>
      <div style={{ padding: '12px 16px 8px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid #f3f4f6' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="field-row">
      <label className="field-label">{label}</label>
      {children}
      {hint && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{hint}</div>}
    </div>
  )
}

export function SaveBtn({ loading, onClick, label = '💾 บันทึก' }: { loading: boolean; onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} disabled={loading} className="btn btn-primary"
      style={{ opacity: loading ? .7 : 1 }}>
      {loading ? '⏳...' : label}
    </button>
  )
}

export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer',
      background: on ? '#111827' : '#d1d5db', position: 'relative', flexShrink: 0,
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

export function SettingsHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="app-header" style={{ background: '#111827' }}>
      <Link href="/owner/settings" className="app-header-back">←</Link>
      <div style={{ flex: 1 }}>
        <h1>{title}</h1>
        <div className="sub">{sub}</div>
      </div>
    </div>
  )
}
