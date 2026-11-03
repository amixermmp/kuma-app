'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WEEKDAY_SHORT } from '@/lib/scheduleCalc'
import { STATUS_TEXT, postLeave } from './LeavePanels'

export type CalendarDay = {
  date: string
  weekday: number
  label: string
  isToday: boolean
  mine: boolean
  people: { id: string; name: string; mine: boolean; extra: boolean }[]
  open: number        // ที่ว่างเหลือ (ถึงเป้าแล้ว = 0)
  canClaim: boolean   // มีสิทธิ์ลง + ยังว่าง + ไม่ใช่งานเรา + เป็นวันอนาคต
  returning: boolean  // เราลาวันนี้ไว้ (อนุมัติแล้ว) — กดลงตอนนี้ = กลับมาลงงานวันเดิม
  canLeave: boolean   // เป็นงานของเรา + ล่วงหน้าพอ (≥48 ชม.) + ยังไม่มีคำขอลา
  tooLate: boolean    // เป็นงานของเราแต่ใกล้กว่า 48 ชม. → ลาในแอปไม่ได้
  noticeAuto: boolean // ล่วงหน้า ≥10 วัน = อนุมัติทันที
  surplusOk: boolean  // วันนั้นคนเกินเป้า ลาแล้วยังเหลือถึงเป้า = อนุมัติทันที (<10 วัน ก็ได้)
  coverOptions: { id: string; name: string }[]   // คนแทนที่เลือกได้ (เฉพาะกรณี <10 วัน)
  myLeave: { id: string; status: 'pending_cover' | 'pending' | 'approved' } | null
}

// ปฏิทินงานของพนักงาน — ลงงานที่ว่าง (ใครไวได้ก่อน ลงแล้วถอนเองไม่ได้) และลา (วันเดียว + ระบุคนแทนได้)
export default function ScheduleCalendar({ days }: { days: CalendarDay[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [leaveDay, setLeaveDay] = useState<string | null>(null)
  const [cover, setCover] = useState('')
  const [reason, setReason] = useState('')

  const claim = async (d: CalendarDay) => {
    if (busy) return
    const returnNote = d.returning ? 'คุณเคยลางานวันนี้ไว้ — จะกลับมาลงงานวันเดิม\n\n' : ''
    if (!confirm(`${d.returning ? 'กลับมาลงงาน' : 'ลงงาน'}วัน${WEEKDAY_SHORT[d.weekday]} ${d.label}?\n\n${returnNote}ลงแล้วเป็นการยืนยันว่าจะมาทำงาน ยกเลิกเองไม่ได้ ถ้าจะถอนต้องแจ้งลาตามเงื่อนไข`)) return
    setBusy(d.date)
    setMsg('')
    try {
      const res = await fetch('/api/staff/schedule/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ day: d.date }) })
      const data = await res.json().catch(() => ({}))
      setMsg(res.ok ? `✅ ลงงานวันที่ ${d.label} แล้ว` : `❌ ${data.error ?? 'ลงงานไม่สำเร็จ'}`)
      router.refresh()   // เต็ม/ลงสำเร็จ รีเฟรชข้อมูลล่าสุด
    } catch {
      setMsg('❌ เชื่อมต่อไม่สำเร็จ ลองอีกครั้ง')
    } finally {
      setBusy(null)
    }
  }

  const openLeave = (d: CalendarDay) => { setLeaveDay(leaveDay === d.date ? null : d.date); setCover(''); setReason('') }

  const submitLeave = async (d: CalendarDay) => {
    if (busy) return
    const hasCover = cover !== ''
    const how = d.noticeAuto || d.surplusOk ? 'อนุมัติทันที' : hasCover ? 'รอคนแทนกดรับ' : 'ส่งให้ผู้จัดการพิจารณา'
    if (!confirm(`ลาวัน${WEEKDAY_SHORT[d.weekday]} ${d.label}?\n\n${how} — ลาที่อนุมัติแล้วยกเลิกเองไม่ได้`)) return
    setBusy('leave' + d.date)
    const r = await postLeave({ action: 'request', from: d.date, to: d.date, coverStaffId: cover || undefined, reason })
    setBusy(null)
    if (!r.ok) { setMsg('❌ ' + r.error); return }
    setMsg(r.route === 'auto' ? `✅ ลาวันที่ ${d.label} แล้ว อนุมัติทันที` : r.route === 'cover' ? '✅ ส่งคำขอให้คนแทนแล้ว รอเขากดรับ' : d.surplusOk ? '⚠️ มีคนลาพร้อมกันจนวันนั้นเหลือต่ำกว่าเป้า — ส่งคำขอให้ผู้จัดการพิจารณาแทน' : '✅ ส่งคำขอลาให้ผู้จัดการแล้ว รอพิจารณา')
    setLeaveDay(null)
    router.refresh()
  }

  return (
    <div style={{ margin: '12px 16px 24px' }}>
      {msg && (
        <div style={{ position: 'sticky', top: 0, zIndex: 5, marginBottom: '8px', padding: '10px 14px', borderRadius: '10px', background: '#111827', color: '#fff', fontSize: '13px', fontWeight: 600 }}>{msg}</div>
      )}
      {days.map(d => (
        <div key={d.date} style={{ marginBottom: '5px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '10px',
            background: d.mine ? '#ecfeff' : '#fff', border: `1.5px solid ${d.mine ? '#22d3ee' : '#f3f4f6'}`,
          }}>
            <div style={{ width: '70px', fontSize: '12px', fontWeight: 800, color: d.weekday === 0 || d.weekday === 6 ? '#be123c' : '#111827' }}>
              {WEEKDAY_SHORT[d.weekday]} {d.label}
            </div>
            <div style={{ flex: 1, fontSize: '12px', color: '#374151', lineHeight: 1.5 }}>
              {d.people.length === 0 ? <span style={{ color: '#9ca3af' }}>— ยังไม่มีคน —</span> : d.people.map((p, i) => (
                <span key={p.id}>{i > 0 && ', '}<span style={{ fontWeight: p.mine ? 800 : 500, color: p.mine ? '#0e7490' : undefined }}>{p.name}{p.extra ? ' ➕' : ''}</span></span>
              ))}
              {d.open > 0 && <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 700 }}>ว่าง {d.open} ที่</div>}
              {d.myLeave && (
                <div style={{ fontSize: '11px', fontWeight: 800, color: STATUS_TEXT[d.myLeave.status].color }}>
                  {d.myLeave.status === 'approved' ? (d.mine ? '🔁 กลับมาลงงานแล้ว (เคยลาไว้)' : '🏖️ คุณลาวันนี้แล้ว') : `📝 ขอลา — ${STATUS_TEXT[d.myLeave.status].text}`}
                </div>
              )}
              {d.tooLate && <div style={{ fontSize: '11px', color: '#9ca3af' }}>ลาด่วน (น้อยกว่า 48 ชม.) → ทักหาผู้จัดการ</div>}
            </div>
            {d.isToday && <span style={{ fontSize: '10px', fontWeight: 800, color: '#e11d48' }}>วันนี้</span>}
            {d.canClaim && (
              <button onClick={() => claim(d)} disabled={busy !== null} style={{
                padding: '7px 12px', borderRadius: '10px', border: 'none', background: '#0e7490', color: '#fff',
                fontSize: '12px', fontWeight: 800, fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1, whiteSpace: 'nowrap',
              }}>{busy === d.date ? '...' : d.returning ? 'กลับมาลงงานนี้' : 'ลงงานนี้'}</button>
            )}
            {d.canLeave && (
              <button onClick={() => openLeave(d)} disabled={busy !== null} style={{
                padding: '7px 12px', borderRadius: '10px', border: '1.5px solid #0e7490', background: leaveDay === d.date ? '#ecfeff' : '#fff', color: '#0e7490',
                fontSize: '12px', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
              }}>ลา</button>
            )}
          </div>

          {leaveDay === d.date && d.canLeave && (
            <div style={{ margin: '4px 0 6px', padding: '12px', borderRadius: '10px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '12px', color: '#374151', lineHeight: 1.6, marginBottom: '8px' }}>
                {d.noticeAuto
                  ? <>ล่วงหน้า 10 วันขึ้นไป — <strong>อนุมัติทันที</strong> งานนี้จะกลายเป็นที่ว่างให้คนอื่นกดลง</>
                  : d.surplusOk
                    ? <>วันนี้คนเกินเป้า — ลาแล้วยังเหลือครบเป้า <strong>อนุมัติทันที</strong> ไม่ต้องหาคนแทน</>
                    : <>ล่วงหน้าน้อยกว่า 10 วัน — เลือก<strong>คนแทน</strong>ที่คุยกันแล้ว (เขากดรับแล้วอนุมัติทันที) หรือไม่เลือกก็ได้ แล้วส่งให้<strong>ผู้จัดการพิจารณา</strong></>}
              </div>
              {!d.noticeAuto && !d.surplusOk && (
                <select className="field-input" value={cover} onChange={e => setCover(e.target.value)} style={{ marginBottom: '8px' }}>
                  <option value="">— ไม่ระบุคนแทน (ส่งให้ผู้จัดการ) —</option>
                  {d.coverOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <input className="field-input" value={reason} onChange={e => setReason(e.target.value)} placeholder="เหตุผล (ไม่บังคับ)" style={{ marginBottom: '8px' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => submitLeave(d)} disabled={busy !== null} style={{ padding: '9px 16px', borderRadius: '10px', border: 'none', background: '#0e7490', color: '#fff', fontWeight: 800, fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}>
                  {busy === 'leave' + d.date ? '...' : 'ส่งคำขอลา'}
                </button>
                <button onClick={() => setLeaveDay(null)} style={{ padding: '9px 16px', borderRadius: '10px', border: '1.5px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 700, fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}>ปิด</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
