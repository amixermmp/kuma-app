'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SettingsHeader, Section, Field, SaveBtn, Toggle } from '../_shared'
import { WEEKDAY_SHORT, type ScheduleCounts, type ScheduleDay, type SchedulePattern } from '@/lib/scheduleCalc'

type Branch = { id: string; name: string }
type StaffRow = { id: string; name: string; active: boolean; role: string | null }
type Draft = { id?: string; staffId: string; weekdays: number[]; startDate: string; endDate: string }

const STATUS_STYLE = {
  short: { bg: '#fef2f2', border: '#fecaca', color: '#dc2626', label: 'ขาดคน' },
  low: { bg: '#fffbeb', border: '#fde68a', color: '#b45309', label: 'ต่ำกว่าเป้า' },
  ok: { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', label: 'ครบ' },
} as const

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00+07:00`).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })

export default function ScheduleClient({ branches, branchId, enabled: initEnabled, counts: initCounts, staff, patterns, days, today }: {
  branches: Branch[]; branchId: string; enabled: boolean; counts: ScheduleCounts
  staff: StaffRow[]; patterns: SchedulePattern[]; days: ScheduleDay[]; today: string
}) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initEnabled)
  const [counts, setCounts] = useState({
    weekdayMin: String(initCounts.weekdayMin), weekdayTarget: String(initCounts.weekdayTarget),
    weekendMin: String(initCounts.weekendMin), weekendTarget: String(initCounts.weekendTarget),
  })
  const [savingSettings, setSavingSettings] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [openDay, setOpenDay] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const nameOf = (id: string) => staff.find(s => s.id === id)?.name ?? '—'
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }
  const call = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/owner/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ branchId, ...body }) })
    const data = await res.json().catch(() => ({}))
    return res.ok ? null : (data.error ?? 'เกิดข้อผิดพลาด')
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    const err = await call({
      action: 'settings', enabled,
      counts: { weekdayMin: counts.weekdayMin, weekdayTarget: counts.weekdayTarget, weekendMin: counts.weekendMin, weekendTarget: counts.weekendTarget },
    })
    setSavingSettings(false)
    flash(err ? '❌ ' + err : '✅ บันทึกการตั้งค่าแล้ว')
    if (!err) router.refresh()
  }

  const savePattern = async () => {
    if (!draft) return
    setSaving(true)
    const err = await call({ action: 'savePattern', ...draft })
    setSaving(false)
    if (err) { flash('❌ ' + err); return }
    setDraft(null); flash('✅ บันทึกแบบแผนแล้ว'); router.refresh()
  }

  const removePattern = async (p: SchedulePattern) => {
    if (!confirm(`ลบแบบแผนของ ${nameOf(p.staffId)} (${fmtDate(p.startDate)} – ${fmtDate(p.endDate)})?`)) return
    const err = await call({ action: 'deletePattern', id: p.id })
    flash(err ? '❌ ' + err : '🗑️ ลบแล้ว')
    if (!err) router.refresh()
  }

  const [addStaffId, setAddStaffId] = useState('')
  const addExtra = async (day: string) => {
    if (!addStaffId) { flash('❌ เลือกคนที่จะเพิ่มก่อน'); return }
    const err = await call({ action: 'addExtra', staffId: addStaffId, day })
    flash(err ? '❌ ' + err : '✅ เพิ่มเวรแล้ว')
    if (!err) { setAddStaffId(''); router.refresh() }
  }
  const removeExtra = async (staffId: string, day: string) => {
    if (!confirm(`ลบเวรที่ลงเพิ่มของ ${nameOf(staffId)} วันที่ ${fmtDate(day)}?\n\n(ลบได้เฉพาะเวรที่ลงเพิ่ม — เวรตามแบบแผนต้องแก้ที่แบบแผน)`)) return
    const err = await call({ action: 'removeExtra', staffId, day })
    flash(err ? '❌ ' + err : '🗑️ ลบเวรแล้ว')
    if (!err) router.refresh()
  }

  const setDayType = async (day: string, type: 'weekday' | 'weekend' | null) => {
    const err = await call({ action: 'dayType', day, type })
    flash(err ? '❌ ' + err : '✅ บันทึกประเภทวันแล้ว')
    if (!err) router.refresh()
  }

  const shortCount = days.filter(d => d.status === 'short').length
  const lowCount = days.filter(d => d.status === 'low').length
  const setC = (k: keyof typeof counts, v: string) => setCounts(c => ({ ...c, [k]: v }))
  const patternsOf = (staffId: string) => patterns.filter(p => p.staffId === staffId)

  return (
    <>
      <SettingsHeader title="ตารางเวรพาร์ทไทม์" sub="แบบแผนรายสัปดาห์ต่อคน + ภาพรวม 60 วันข้างหน้า" />
      {msg && <div style={{ margin: '12px 16px 0', padding: '10px 14px', borderRadius: '10px', background: '#f3f4f6', fontSize: '13px', fontWeight: 600 }}>{msg}</div>}

      <div style={{ margin: '12px 16px 0', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {branches.map(b => (
          <a key={b.id} href={`/owner/settings/schedule?branch=${b.id}`} style={{
            padding: '6px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, textDecoration: 'none',
            background: b.id === branchId ? '#111827' : '#fff', color: b.id === branchId ? '#fff' : '#374151', border: '1px solid #e5e7eb',
          }}>{b.name}</a>
        ))}
      </div>

      <Section title="ตั้งค่าสาขานี้">
        <div style={{ padding: '4px 16px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>เปิดใช้ตารางเวร</div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                เปิดแล้ว คนที่มีแบบแผนแต่วันนี้ไม่มีเวร จะเลือก "เข้าทำงาน" หรือ "ดูตารางอย่างเดียว" ตอนเช็คอิน — คนที่ไม่มีแบบแผน (พนักงานประจำ/เจ้าของ) ใช้เช็คอินเดิมทุกอย่าง
              </div>
            </div>
            <Toggle on={enabled} onClick={() => setEnabled(v => !v)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="จันทร์-ศุกร์: ขั้นต่ำ (คน)" hint="ต่ำกว่านี้ = วันแดง"><input className="field-input" type="number" min={0} max={30} value={counts.weekdayMin} onChange={e => setC('weekdayMin', e.target.value)} /></Field>
            <Field label="จันทร์-ศุกร์: ที่ต้องการ (คน)" hint="ต่ำกว่านี้ = วันเหลือง"><input className="field-input" type="number" min={0} max={30} value={counts.weekdayTarget} onChange={e => setC('weekdayTarget', e.target.value)} /></Field>
            <Field label="เสาร์-อาทิตย์: ขั้นต่ำ (คน)"><input className="field-input" type="number" min={0} max={30} value={counts.weekendMin} onChange={e => setC('weekendMin', e.target.value)} /></Field>
            <Field label="เสาร์-อาทิตย์: ที่ต้องการ (คน)"><input className="field-input" type="number" min={0} max={30} value={counts.weekendTarget} onChange={e => setC('weekendTarget', e.target.value)} /></Field>
          </div>
          <SaveBtn loading={savingSettings} onClick={saveSettings} />
        </div>
      </Section>

      <Section title={`ภาพรวม ${days.length} วันข้างหน้า — ขาดคน ${shortCount} วัน • ต่ำกว่าเป้า ${lowCount} วัน`}>
        <div style={{ padding: '4px 12px 14px' }}>
          {patterns.length === 0 && (
            <div style={{ fontSize: '12px', color: '#6b7280', padding: '8px 4px' }}>ยังไม่มีแบบแผนของใครเลย — ทุกวันจะเป็นสีแดงจนกว่าจะตั้งแบบแผนด้านล่าง</div>
          )}
          {days.map(d => {
            const st = STATUS_STYLE[d.status]
            const isOpen = openDay === d.date
            return (
              <div key={d.date} style={{ marginBottom: '6px' }}>
                <div onClick={() => setOpenDay(isOpen ? null : d.date)} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '10px', cursor: 'pointer',
                  background: st.bg, border: `1px solid ${st.border}`,
                }}>
                  <div style={{ width: '64px', fontSize: '12px', fontWeight: 800, color: '#111827' }}>
                    {WEEKDAY_SHORT[d.weekday]} {fmtDate(d.date)}{d.date === today && <span style={{ color: '#e11d48' }}> วันนี้</span>}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: st.color, width: '52px' }}>{d.count}/{d.target} คน</div>
                  <div style={{ flex: 1, fontSize: '11px', color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.staffIds.map(id => nameOf(id) + (d.extraStaffIds.includes(id) ? ' ➕' : '')).join(', ') || '—'}
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: st.color }}>
                    {st.label}{d.overridden ? ' • วันพิเศษ' : ''}
                  </div>
                </div>
                {isOpen && (
                  <div style={{ padding: '8px 10px', fontSize: '12px', color: '#374151' }}>
                    <div style={{ marginBottom: '6px' }}>
                      ประเภทวัน: <strong>{d.type === 'weekend' ? 'วันหยุด (ขั้นต่ำ ' + d.min + ' / ต้องการ ' + d.target + ' คน)' : 'วันธรรมดา (ขั้นต่ำ ' + d.min + ' / ต้องการ ' + d.target + ' คน)'}</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button className="btn" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setDayType(d.date, 'weekend')}>นับเป็นวันหยุด</button>
                      <button className="btn" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setDayType(d.date, 'weekday')}>นับเป็นวันธรรมดา</button>
                      {d.overridden && <button className="btn" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setDayType(d.date, null)}>กลับเป็นตามปกติ</button>}
                    </div>
                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #e5e7eb' }}>
                      <div style={{ fontWeight: 700, marginBottom: '6px' }}>เวรที่ลงเพิ่มวันนี้ (➕ = ลงเอง/เจ้าของเพิ่มให้)</div>
                      {d.extraStaffIds.length === 0 && <div style={{ color: '#9ca3af', marginBottom: '6px' }}>ยังไม่มี</div>}
                      {d.extraStaffIds.map(id => (
                        <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span>{nameOf(id)}</span>
                          <button className="btn" style={{ padding: '3px 10px', fontSize: '11px', color: '#dc2626' }} onClick={() => removeExtra(id, d.date)}>ลบเวรนี้</button>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                        <select className="field-input" style={{ flex: 1, padding: '6px 8px', fontSize: '12px' }} value={addStaffId} onChange={e => setAddStaffId(e.target.value)}>
                          <option value="">— เพิ่มคนลงวันนี้ —</option>
                          {staff.filter(s => s.active && !d.staffIds.includes(s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <button className="btn" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => addExtra(d.date)}>+ เพิ่ม</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="แบบแผนรายสัปดาห์ของแต่ละคน">
        <div style={{ padding: '4px 16px 16px' }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>
            ตั้งวันทำงานประจำสัปดาห์ ใช้ตลอดช่วงวันที่เลือก (เช่น 1 เทอม) — 1 คนมีแบบแผนได้ทีละ 1 ช่วง เทอมใหม่ให้เพิ่มช่วงวันใหม่ต่อจากเดิม
          </div>
          {staff.map(s => (
            <div key={s.id} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{s.name}{!s.active && <span style={{ color: '#9ca3af', fontWeight: 500 }}> (ปิดใช้งาน)</span>}{s.role === 'owner' && ' 👑'}</div>
                <button className="btn" style={{ padding: '5px 12px', fontSize: '12px' }}
                  onClick={() => setDraft({ staffId: s.id, weekdays: [], startDate: today, endDate: '' })}>+ เพิ่มแบบแผน</button>
              </div>
              {patternsOf(s.id).length === 0 && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>ไม่มีแบบแผน — เช็คอินตามปกติทุกวัน ไม่ถูกตารางเวรกระทบ</div>}
              {patternsOf(s.id).map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '6px', fontSize: '12px' }}>
                  <div>
                    <strong>{p.weekdays.map(w => WEEKDAY_SHORT[w]).join(' ')}</strong>
                    <span style={{ color: '#6b7280' }}> • {fmtDate(p.startDate)} – {fmtDate(p.endDate)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn" style={{ padding: '4px 10px', fontSize: '11px' }}
                      onClick={() => setDraft({ id: p.id, staffId: p.staffId, weekdays: p.weekdays, startDate: p.startDate, endDate: p.endDate })}>แก้ไข</button>
                    <button className="btn" style={{ padding: '4px 10px', fontSize: '11px', color: '#dc2626' }} onClick={() => removePattern(p)}>ลบ</button>
                  </div>
                </div>
              ))}
              {draft && draft.staffId === s.id && (
                <div style={{ marginTop: '10px', padding: '12px', borderRadius: '12px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                  <div className="field-label">วันทำงานในสัปดาห์</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '6px 0 10px' }}>
                    {WEEKDAY_SHORT.map((label, w) => {
                      const on = draft.weekdays.includes(w)
                      return (
                        <button key={w} type="button" onClick={() => setDraft(d => d && ({ ...d, weekdays: on ? d.weekdays.filter(x => x !== w) : [...d.weekdays, w] }))}
                          style={{ width: '40px', height: '36px', borderRadius: '10px', fontWeight: 800, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                            border: '1.5px solid ' + (on ? '#111827' : '#d1d5db'), background: on ? '#111827' : '#fff', color: on ? '#fff' : '#6b7280' }}>{label}</button>
                      )
                    })}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <Field label="ตั้งแต่วันที่"><input className="field-input" type="date" value={draft.startDate} onChange={e => setDraft(d => d && ({ ...d, startDate: e.target.value }))} /></Field>
                    <Field label="ถึงวันที่ (สิ้นสุดเทอม/สอบเสร็จ)"><input className="field-input" type="date" value={draft.endDate} onChange={e => setDraft(d => d && ({ ...d, endDate: e.target.value }))} /></Field>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <SaveBtn loading={saving} onClick={savePattern} label="💾 บันทึกแบบแผน" />
                    <button className="btn" onClick={() => setDraft(null)}>ยกเลิก</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </>
  )
}
