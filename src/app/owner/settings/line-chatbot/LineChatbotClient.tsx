'use client'

import { useState } from 'react'
import { Toggle, SettingsHeader } from '../_shared'
import { isBotActiveNow, describeRule, type DayKey, type DayMode, type DayRule, type WeekSchedule, type TodayOverride } from '@/lib/botSchedule'

type BranchRow = {
  id: string
  name: string
  enabled: boolean
  schedule: WeekSchedule | null
  today: TodayOverride | null
}

// เรียงจันทร์→อาทิตย์ ให้อ่านง่าย (ค่า key ตรงกับ DAY_KEYS ในไลบรารี)
const WEEK: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'จันทร์' }, { key: 'tue', label: 'อังคาร' }, { key: 'wed', label: 'พุธ' },
  { key: 'thu', label: 'พฤหัสบดี' }, { key: 'fri', label: 'ศุกร์' }, { key: 'sat', label: 'เสาร์' }, { key: 'sun', label: 'อาทิตย์' },
]
const MODE_LABEL: Record<DayMode, string> = { all: 'ตอบทั้งวัน', range: 'ตอบเป็นช่วงเวลา', off: 'ไม่ตอบทั้งวัน' }

const bkkToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)

const selectStyle: React.CSSProperties = { padding: '7px 8px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', background: '#fff', fontFamily: 'inherit' }
const timeStyle: React.CSSProperties = { padding: '6px 6px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', fontFamily: 'inherit' }

// แถวเลือกโหมด + เวลา (ใช้ทั้งรายวันและ "วันนี้")
function RuleEditor({ rule, onChange, extraModes }: {
  rule: { mode: DayMode | 'schedule'; start: string; end: string }
  onChange: (r: { mode: DayMode | 'schedule'; start: string; end: string }) => void
  extraModes?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
      <select value={rule.mode} onChange={e => onChange({ ...rule, mode: e.target.value as DayMode | 'schedule' })} style={selectStyle}>
        {extraModes && <option value="schedule">ตามตารางประจำสัปดาห์</option>}
        {(Object.keys(MODE_LABEL) as DayMode[]).map(m => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
      </select>
      {rule.mode === 'range' && (
        <>
          <input type="time" value={rule.start} onChange={e => onChange({ ...rule, start: e.target.value })} style={timeStyle} />
          <span style={{ fontSize: '12px', color: '#6b7280' }}>ถึง</span>
          <input type="time" value={rule.end} onChange={e => onChange({ ...rule, end: e.target.value })} style={timeStyle} />
        </>
      )}
    </div>
  )
}

function SchedulePanel({ branch, enabled }: { branch: BranchRow; enabled: boolean }) {
  const initialWeek = (): Record<DayKey, { mode: DayMode; start: string; end: string }> =>
    Object.fromEntries(WEEK.map(({ key }) => {
      const r: DayRule | undefined = branch.schedule?.[key]
      return [key, { mode: r?.mode ?? 'all', start: r?.start ?? '09:00', end: r?.end ?? '20:00' }]
    })) as Record<DayKey, { mode: DayMode; start: string; end: string }>

  const todayOverride = branch.today && branch.today.date === bkkToday() ? branch.today : null
  const [open, setOpen] = useState(false)
  const [week, setWeek] = useState(initialWeek)
  const [today, setToday] = useState<{ mode: DayMode | 'schedule'; start: string; end: string }>({
    mode: todayOverride?.mode ?? 'schedule', start: todayOverride?.start ?? '18:00', end: todayOverride?.end ?? '23:00',
  })
  const [saved, setSaved] = useState<{ schedule: WeekSchedule | null; today: TodayOverride | null }>({ schedule: branch.schedule, today: todayOverride })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true); setMsg('')
    const res = await fetch('/api/owner/settings/line-bot-schedule', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ branch_id: branch.id, ...payload }),
    })
    setBusy(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setMsg(`❌ ${d.error ?? 'บันทึกไม่สำเร็จ'}`); return false }
    setMsg('✅ บันทึกแล้ว'); setTimeout(() => setMsg(''), 2500)
    return true
  }

  const saveWeek = async () => {
    const schedule: WeekSchedule = Object.fromEntries(WEEK.map(({ key }) => {
      const w = week[key]
      return [key, w.mode === 'range' ? { mode: 'range', start: w.start, end: w.end } : { mode: w.mode }]
    }))
    if (await post({ schedule })) setSaved(s => ({ ...s, schedule }))
  }

  const saveToday = async () => {
    const payload = today.mode === 'schedule' ? null : { date: bkkToday(), ...(today.mode === 'range' ? { mode: 'range', start: today.start, end: today.end } : { mode: today.mode }) }
    if (await post({ today: payload })) setSaved(s => ({ ...s, today: payload as TodayOverride | null }))
  }

  const activeNow = enabled && isBotActiveNow(saved.schedule, saved.today)
  const todayRule: DayRule | undefined = saved.today ?? saved.schedule?.[(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[new Date(Date.now() + 7 * 3600_000).getUTCDay()]]

  return (
    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ fontSize: '12px', color: '#374151', lineHeight: 1.5 }}>
          <div>วันนี้: <strong>{describeRule(todayRule)}</strong>{saved.today ? ' (ตั้งเฉพาะวันนี้)' : ''}</div>
          <div style={{ color: activeNow ? '#16a34a' : '#6b7280' }}>
            {!enabled ? '⚪ สวิตช์ปิดอยู่ — ไม่ตอบเลย' : activeNow ? '🟢 ตอนนี้บอทตอบอยู่' : '⚪ ตอนนี้นอกเวลา — บอทเงียบ (พนักงานตอบเอง)'}
          </div>
        </div>
        <button onClick={() => setOpen(o => !o)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
          ⏰ {open ? 'ซ่อน' : 'ตั้งเวลา'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>เฉพาะวันนี้ (หมดอายุเองตอนเที่ยงคืน)</div>
            <RuleEditor rule={today} onChange={setToday} extraModes />
            <button onClick={saveToday} disabled={busy} style={{ marginTop: '8px', background: '#111827', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
              บันทึกวันนี้
            </button>
          </div>

          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>ตารางประจำสัปดาห์</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {WEEK.map(({ key, label }) => (
                <div key={key} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ width: '72px', fontSize: '13px', fontWeight: 600 }}>{label}</div>
                  <RuleEditor rule={week[key]} onChange={r => setWeek(w => ({ ...w, [key]: { mode: r.mode as DayMode, start: r.start, end: r.end } }))} />
                </div>
              ))}
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px' }}>
              ช่วงเวลาข้ามเที่ยงคืนได้ เช่น 20:00 ถึง 02:00 (วันถัดไป) / นอกช่วงบอทจะเงียบ ไม่ส่งข้อความอะไร
            </div>
            <button onClick={saveWeek} disabled={busy} style={{ marginTop: '8px', background: '#111827', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
              บันทึกตารางประจำสัปดาห์
            </button>
          </div>

          {msg && <div style={{ fontSize: '12px' }}>{msg}</div>}
        </div>
      )}
    </div>
  )
}

export default function LineChatbotClient({ branches }: { branches: BranchRow[] }) {
  const [states, setStates] = useState<Record<string, boolean>>(
    Object.fromEntries(branches.map(b => [b.id, b.enabled]))
  )
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [msgs, setMsgs] = useState<Record<string, string>>({})

  const toggle = async (branchId: string) => {
    const next = !states[branchId]
    setStates(s => ({ ...s, [branchId]: next }))
    setSaving(s => ({ ...s, [branchId]: true }))
    setMsgs(s => ({ ...s, [branchId]: '' }))

    const res = await fetch('/api/owner/settings/line-bot-toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_id: branchId, enabled: next }),
    })

    setSaving(s => ({ ...s, [branchId]: false }))
    if (!res.ok) {
      // revert on error
      setStates(s => ({ ...s, [branchId]: !next }))
      setMsgs(s => ({ ...s, [branchId]: '❌ บันทึกไม่สำเร็จ' }))
    } else {
      setMsgs(s => ({ ...s, [branchId]: next ? '✅ เปิดแล้ว' : '✅ ปิดแล้ว' }))
    }
    setTimeout(() => setMsgs(s => ({ ...s, [branchId]: '' })), 2500)
  }

  return (
    <div className="app-wrap">
      <SettingsHeader title="LINE Chatbot" sub="เปิด/ปิด AI ตอบแชท และตั้งเวลาตอบ รายสาขา" />

      <div style={{ margin: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px', lineHeight: 1.6 }}>
          สวิตช์ปิด — บอทไม่ตอบเลย (พนักงานตอบเอง)<br />
          สวิตช์เปิด — บอทตอบเฉพาะวัน-เวลาที่ตั้งไว้ (ถ้ายังไม่ตั้ง ตอบทั้งวัน) ข้อความจะถูกรับเสมอ
        </div>

        {branches.map(b => {
          const on = states[b.id]
          const isSaving = saving[b.id]
          const msg = msgs[b.id]
          return (
            <div key={b.id} style={{
              background: '#fff', borderRadius: '14px', padding: '16px',
              boxShadow: '0 1px 4px rgba(0,0,0,.07)',
              borderLeft: `4px solid ${on ? '#00b900' : '#d1d5db'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                  background: on ? '#f0fdf4' : '#f9fafb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
                }}>💬</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>{b.name}</div>
                  <div style={{ fontSize: '12px', marginTop: '2px', color: on ? '#16a34a' : '#9ca3af' }}>
                    {isSaving ? '⏳ กำลังบันทึก...' : msg || (on ? 'สวิตช์เปิด — ตอบตามเวลาที่ตั้ง' : 'Bot ปิดอยู่ — staff ตอบเอง')}
                  </div>
                </div>
                <Toggle on={on} onClick={() => !isSaving && toggle(b.id)} />
              </div>
              <SchedulePanel branch={b} enabled={on} />
            </div>
          )
        })}

        {branches.length === 0 && (
          <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '14px', padding: '40px 0' }}>
            ไม่พบข้อมูลสาขา
          </div>
        )}
      </div>
    </div>
  )
}
