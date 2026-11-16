'use client'

import { useState } from 'react'
import Link from 'next/link'

export type Inquiry = {
  id: string; code: string; brand: string; model: string
  start_date: string; end_date: string; total_days: number; pickup_time: string | null
  send_type: 'shop' | 'delivery'; send_zone_name: string | null
  return_type: 'shop' | 'delivery'; return_zone_name: string | null
  est_rent: number | null; est_delivery_fee: number | null; delivery_fee_unknown: boolean
  est_total: number | null; deposit: number | null
  status: string; staff_note: string | null; created_at: string
}

const STATUS: { key: string; label: string; color: string }[] = [
  { key: 'clicked', label: 'กดจองบนเว็บ', color: '#6b7280' },
  { key: 'chatted', label: 'ทักมาแล้ว', color: '#2563eb' },
  { key: 'confirmed', label: 'ยืนยันแล้ว', color: '#16a34a' },
  { key: 'unavailable', label: 'ไม่ว่าง', color: '#dc2626' },
  { key: 'moved_branch', label: 'โยกสาขา', color: '#7c3aed' },
  { key: 'silent', label: 'ลูกค้าเงียบ', color: '#b45309' },
  { key: 'cancelled', label: 'ยกเลิก', color: '#9ca3af' },
]
const OPEN = ['clicked', 'chatted']

const fmtDate = (d: string) => new Date(d + 'T00:00:00+07:00').toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit' })
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const baht = (n: number | null) => (n == null ? '—' : `฿${n.toLocaleString()}`)

function Card({ initial }: { initial: Inquiry }) {
  const [q, setQ] = useState(initial)
  const [note, setNote] = useState(initial.staff_note ?? '')
  const [msg, setMsg] = useState('')
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500) }

  const send = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/staff/inquiries/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: q.id, ...body }) })
    if (res.ok) { flash('✅ บันทึกแล้ว'); return true }
    const d = await res.json().catch(() => null)
    flash('❌ ' + (d?.error ?? `HTTP ${res.status}`))
    return false
  }
  const setStatus = async (status: string) => { if (await send({ status })) setQ(p => ({ ...p, status })) }

  const leg = (type: string, zone: string | null) => (type === 'delivery' ? `ให้ไปส่ง/รับ: ${zone ?? '—'}` : 'ที่ร้าน')
  const st = STATUS.find(s => s.key === q.status)

  return (
    <div style={{ background: '#fff', borderRadius: '14px', padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,.07)', borderLeft: `4px solid ${st?.color ?? '#9ca3af'}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '1px', color: '#111827' }}>{q.code}</span>
        <span style={{ fontSize: '11px', fontWeight: 700, color: st?.color }}>{st?.label}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: '11px', color: '#9ca3af' }}>{fmtDateTime(q.created_at)}</span>
      </div>
      <div style={{ fontWeight: 700, fontSize: '14px', marginTop: '6px' }}>{q.brand} {q.model}</div>
      <div style={{ fontSize: '12px', color: '#374151', marginTop: '4px', lineHeight: 1.7 }}>
        📅 {fmtDate(q.start_date)} → {fmtDate(q.end_date)} ({q.total_days} วัน){q.pickup_time ? ` · รับ ~${q.pickup_time}` : ''}<br />
        🚚 รับรถ: {leg(q.send_type, q.send_zone_name)}<br />
        🏁 คืนรถ: {leg(q.return_type, q.return_zone_name)}<br />
        💰 ค่าเช่าประมาณ {baht(q.est_rent)} · ค่าส่ง {q.delivery_fee_unknown ? <b style={{ color: '#d97706' }}>ต้องแจ้งลูกค้า</b> : baht(q.est_delivery_fee)} · รวม {baht(q.est_total)} · มัดจำ {baht(q.deposit)}
      </div>
      <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>ตัวเลขนี้เป็นค่าประมาณจากเว็บ — ตรวจคิวว่างและยืนยันราคาจริงกับลูกค้าก่อนเสมอ</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
        {STATUS.map(s => (
          <button key={s.key} onClick={() => setStatus(s.key)} style={{
            padding: '6px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            border: `1.5px solid ${q.status === s.key ? s.color : '#e5e7eb'}`,
            background: q.status === s.key ? s.color : '#fff', color: q.status === s.key ? '#fff' : '#374151',
          }}>{s.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '6px', marginTop: '10px', alignItems: 'center' }}>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="โน้ต เช่น เสนอ Qbix แทน / ย้ายไปบางแสน"
          style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '12px', fontFamily: 'inherit', minWidth: 0 }} />
        <button onClick={() => send({ staff_note: note }).then(ok => { if (ok) setQ(p => ({ ...p, staff_note: note })) })}
          style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: '#111827', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>บันทึก</button>
      </div>
      {msg && <div style={{ fontSize: '11px', marginTop: '6px', color: msg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{msg}</div>}
    </div>
  )
}

export default function InquiriesClient({ rows }: { rows: Inquiry[] }) {
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const [search, setSearch] = useState('')

  const term = search.trim().toUpperCase()
  const shown = rows.filter(r => (term ? r.code.includes(term) : filter === 'all' || OPEN.includes(r.status)))

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: '#1976d4' }}>
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div style={{ flex: 1 }}>
          <h1>คำขอจากเว็บ</h1>
          <div className="sub">ลูกค้ากดจองจากเว็บ — ค้นด้วยรหัสในข้อความไลน์</div>
        </div>
      </div>

      <div style={{ margin: '12px 16px 0', display: 'flex', gap: '8px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหารหัส เช่น Z-4821"
          style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '14px', fontFamily: 'inherit', minWidth: 0 }} />
      </div>
      {!term && (
        <div style={{ margin: '10px 16px 0', display: 'flex', gap: '8px' }}>
          {([['open', 'ที่ยังรอจัดการ'], ['all', 'ทั้งหมด']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding: '7px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              border: '1.5px solid ' + (filter === k ? '#1976d4' : '#e5e7eb'), background: filter === k ? '#1976d4' : '#fff', color: filter === k ? '#fff' : '#374151',
            }}>{label}</button>
          ))}
        </div>
      )}

      <div style={{ margin: '12px 16px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {shown.length === 0
          ? <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', padding: '32px 0' }}>{term ? 'ไม่พบรหัสนี้' : 'ยังไม่มีคำขอ'}</div>
          : shown.map(r => <Card key={r.id} initial={r} />)}
      </div>
    </div>
  )
}
