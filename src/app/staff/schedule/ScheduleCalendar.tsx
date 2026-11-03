'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WEEKDAY_SHORT } from '@/lib/scheduleCalc'

export type CalendarDay = {
  date: string
  weekday: number
  label: string
  isToday: boolean
  mine: boolean
  people: { id: string; name: string; mine: boolean; extra: boolean }[]
  open: number        // ที่ว่างเหลือ (ถึงเป้าแล้ว = 0)
  canClaim: boolean   // มีสิทธิ์ลง + ยังว่าง + ไม่ใช่เวรเรา + เป็นวันอนาคต
}

// ปฏิทินเวรของพนักงาน — วันที่ยังไม่เต็มมีปุ่ม "ลงเวรนี้" (ใครไวได้ก่อน ลงแล้วถอนเองไม่ได้ ต้องใช้ระบบลา)
export default function ScheduleCalendar({ days }: { days: CalendarDay[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const claim = async (d: CalendarDay) => {
    if (busy) return
    if (!confirm(`ลงเวรวัน${WEEKDAY_SHORT[d.weekday]} ${d.label}?\n\nลงแล้วเป็นการยืนยันว่าจะมาทำงาน ยกเลิกเองไม่ได้ ถ้าจะถอนต้องแจ้งลาตามเงื่อนไข`)) return
    setBusy(d.date)
    setMsg('')
    try {
      const res = await fetch('/api/staff/schedule/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ day: d.date }) })
      const data = await res.json().catch(() => ({}))
      setMsg(res.ok ? `✅ ลงเวรวันที่ ${d.label} แล้ว` : `❌ ${data.error ?? 'ลงเวรไม่สำเร็จ'}`)
      router.refresh()   // เต็ม/ลงสำเร็จ รีเฟรชข้อมูลล่าสุด
    } catch {
      setMsg('❌ เชื่อมต่อไม่สำเร็จ ลองอีกครั้ง')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ margin: '12px 16px 24px' }}>
      {msg && (
        <div style={{ position: 'sticky', top: 0, zIndex: 5, marginBottom: '8px', padding: '10px 14px', borderRadius: '10px', background: '#111827', color: '#fff', fontSize: '13px', fontWeight: 600 }}>{msg}</div>
      )}
      {days.map(d => (
        <div key={d.date} style={{
          display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', marginBottom: '5px', borderRadius: '10px',
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
          </div>
          {d.isToday && <span style={{ fontSize: '10px', fontWeight: 800, color: '#e11d48' }}>วันนี้</span>}
          {d.canClaim && (
            <button onClick={() => claim(d)} disabled={busy !== null} style={{
              padding: '7px 12px', borderRadius: '10px', border: 'none', background: '#0e7490', color: '#fff',
              fontSize: '12px', fontWeight: 800, fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1, whiteSpace: 'nowrap',
            }}>{busy === d.date ? '...' : 'ลงเวรนี้'}</button>
          )}
        </div>
      ))}
    </div>
  )
}
