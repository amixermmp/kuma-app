'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type MyRequest = { id: string; status: 'pending_cover' | 'pending' | 'approved'; late: boolean; label: string; coverName: string | null; reason: string | null }
export type CoverRequest = { id: string; fromName: string; label: string; reason: string | null }

export const STATUS_TEXT = {
  pending_cover: { text: 'รอคนแทนรับ', color: '#b45309', bg: '#fffbeb' },
  pending: { text: 'รอผู้จัดการพิจารณา', color: '#b45309', bg: '#fffbeb' },
  approved: { text: 'ลาแล้ว', color: '#166534', bg: '#f0fdf4' },
} as const

export async function postLeave(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; route?: string }> {
  try {
    const res = await fetch('/api/staff/schedule/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    return res.ok ? { ok: true, route: data.route } : { ok: false, error: data.error ?? 'เกิดข้อผิดพลาด' }
  } catch {
    return { ok: false, error: 'เชื่อมต่อไม่สำเร็จ ลองอีกครั้ง' }
  }
}

// กล่องของพนักงานเหนือปฏิทิน: ขอให้ฉันทำแทน / คำขอของฉัน / ลาเป็นช่วง
export default function LeavePanels({ eligible, today, myRequests, coverRequests }: {
  eligible: boolean; today: string; myRequests: MyRequest[]; coverRequests: CoverRequest[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [rangeOpen, setRangeOpen] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')

  const run = async (key: string, body: Record<string, unknown>, okMsg: string) => {
    if (busy) return
    setBusy(key)
    const r = await postLeave(body)
    setBusy(null)
    setMsg(r.ok ? okMsg : '❌ ' + r.error)
    if (r.ok) router.refresh()
    return r
  }

  const submitRange = async () => {
    if (!from || !to) { setMsg('❌ เลือกวันเริ่มและวันสิ้นสุดให้ครบ'); return }
    if (!confirm(`ขอลาตั้งแต่ ${from} ถึง ${to}?\n\nระบบจะลาเฉพาะวันที่คุณมีงาน ลาเป็นช่วงจะส่งให้ผู้จัดการพิจารณาเมื่อยาวเกิน 14 วันหรือมีวันที่ใกล้กว่า 10 วัน`)) return
    const r = await run('range', { action: 'request', from, to, reason }, '')
    if (r?.ok) {
      setMsg(r.route === 'auto' ? '✅ ลาเป็นช่วงแล้ว อนุมัติทันที' : '✅ ส่งคำขอลาให้ผู้จัดการแล้ว รอพิจารณา')
      setRangeOpen(false); setFrom(''); setTo(''); setReason('')
    }
  }

  if (!eligible && coverRequests.length === 0 && myRequests.length === 0) return null

  return (
    <div style={{ margin: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {msg && <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#111827', color: '#fff', fontSize: '13px', fontWeight: 600 }}>{msg}</div>}

      {coverRequests.length > 0 && (
        <div style={{ background: '#fff', border: '1.5px solid #fcd34d', borderRadius: '12px', padding: '12px 14px' }}>
          <div style={{ fontWeight: 800, fontSize: '13px', color: '#92400e', marginBottom: '8px' }}>🤝 ขอให้คุณทำงานแทน ({coverRequests.length})</div>
          {coverRequests.map(c => (
            <div key={c.id} style={{ padding: '8px 0', borderTop: '1px solid #f3f4f6', fontSize: '13px' }}>
              <div><strong>{c.fromName}</strong> ขอให้คุณทำแทนวัน <strong>{c.label}</strong>{c.reason ? <span style={{ color: '#6b7280' }}> ({c.reason})</span> : null}</div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button disabled={busy !== null} onClick={() => { if (confirm(`รับทำงานแทน ${c.fromName} วัน ${c.label}?\n\nรับแล้วเป็นงานของคุณ ยกเลิกเองไม่ได้ ต้องลาตามเงื่อนไข`)) run('c' + c.id, { action: 'respond', id: c.id, accept: true }, '✅ รับทำงานแทนแล้ว') }}
                  style={{ padding: '7px 16px', borderRadius: '10px', border: 'none', background: '#0e7490', color: '#fff', fontWeight: 800, fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}>รับ</button>
                <button disabled={busy !== null} onClick={() => run('d' + c.id, { action: 'respond', id: c.id, accept: false }, 'ไม่รับแล้ว — คำขอกลับไปรอผู้จัดการพิจารณา')}
                  style={{ padding: '7px 16px', borderRadius: '10px', border: '1.5px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 700, fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}>ไม่รับ</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {myRequests.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px 14px' }}>
          <div style={{ fontWeight: 800, fontSize: '13px', marginBottom: '8px' }}>📝 คำขอลาของฉัน</div>
          {myRequests.map(r => {
            const st = STATUS_TEXT[r.status]
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 0', borderTop: '1px solid #f3f4f6', fontSize: '12px' }}>
                <div style={{ flex: 1 }}>
                  <strong>{r.label}</strong>
                  {r.coverName && <span style={{ color: '#6b7280' }}> • คนแทน {r.coverName}</span>}
                  {r.reason && <div style={{ color: '#6b7280' }}>{r.reason}</div>}
                </div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: st.color, background: st.bg, padding: '3px 8px', borderRadius: '999px' }}>{r.late ? 'ลาด่วน • ' : ''}{st.text}</span>
                {r.status !== 'approved' && (
                  <button disabled={busy !== null} onClick={() => { if (confirm('ยกเลิกคำขอลานี้?')) run('x' + r.id, { action: 'cancel', id: r.id }, 'ยกเลิกคำขอแล้ว') }}
                    style={{ padding: '4px 10px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fff', color: '#dc2626', fontSize: '11px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>ยกเลิก</button>
                )}
              </div>
            )
          })}
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px' }}>ลาที่อนุมัติแล้วยกเลิกเองไม่ได้ — ทักหาผู้จัดการ</div>
        </div>
      )}

      {eligible && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px 14px' }}>
          <button onClick={() => setRangeOpen(v => !v)} style={{ background: 'none', border: 'none', padding: 0, fontWeight: 800, fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', color: '#111827' }}>
            {rangeOpen ? '▾' : '▸'} ลาเป็นช่วง (หลายวันติดกัน)
          </button>
          {rangeOpen && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.6, marginBottom: '8px' }}>
                ลาเฉพาะวันที่คุณมีงาน • ล่วงหน้า 10 วันขึ้นไปและไม่เกิน 14 วัน อนุมัติทันที • นอกเหนือจากนี้ส่งให้ผู้จัดการพิจารณา • ลาล่วงหน้าน้อยกว่า 48 ชม. ทักหาผู้จัดการ
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><div className="field-label">ตั้งแต่วันที่</div><input className="field-input" type="date" min={today} value={from} onChange={e => setFrom(e.target.value)} /></div>
                <div><div className="field-label">ถึงวันที่</div><input className="field-input" type="date" min={from || today} value={to} onChange={e => setTo(e.target.value)} /></div>
              </div>
              <div style={{ marginTop: '8px' }}><div className="field-label">เหตุผล (ไม่บังคับ)</div><input className="field-input" value={reason} onChange={e => setReason(e.target.value)} placeholder="เช่น สอบ / กลับบ้าน" /></div>
              <button disabled={busy !== null} onClick={submitRange} style={{ marginTop: '10px', padding: '10px 18px', borderRadius: '10px', border: 'none', background: '#0e7490', color: '#fff', fontWeight: 800, fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}>
                {busy === 'range' ? '...' : 'ส่งคำขอลา'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
