'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SettingsHeader, Section, Field, SaveBtn, Toggle } from '../_shared'

type Branch = { id: string; name: string }
type Template = {
  id: string; title: string; slot: 'open' | 'day' | 'close'; kind: 'simple' | 'checklist' | 'auto'
  sub_items: string[]; auto_source: string | null; link_url: string | null; link_label: string | null
  require_photo: boolean; require_note: boolean; days_of_week: number[] | null; branch_ids: string[] | null
  sort_order: number; active: boolean
}
type Draft = {
  id?: string; title: string; slot: Template['slot']; kind: Template['kind']; subItems: string; autoSource: string
  linkUrl: string; linkLabel: string; requirePhoto: boolean; requireNote: boolean; daysOfWeek: number[]; branchIds: string[]
  sortOrder: string; active: boolean
}

const SLOT = { open: '🌅 ตอนเปิดร้าน', day: '☀️ ระหว่างวัน', close: '🌙 ตอนปิดร้าน' } as const
const KIND = { simple: 'ติ๊กธรรมดา', checklist: 'มีรายการย่อย (เช่น ช่องทางโพสต์)', auto: 'ดึงจากข้อมูล (ระบบติ๊กให้เอง)' } as const
const AUTO = { fuel: 'รถในร้านน้ำมันไม่เต็ม', closeshop: 'ทำรายการปิดร้านในแอปแล้ว' } as const
const DAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

const toDraft = (t: Template): Draft => ({
  id: t.id, title: t.title, slot: t.slot, kind: t.kind, subItems: (t.sub_items ?? []).join('\n'), autoSource: t.auto_source ?? 'fuel',
  linkUrl: t.link_url ?? '', linkLabel: t.link_label ?? '', requirePhoto: t.require_photo, requireNote: t.require_note,
  daysOfWeek: t.days_of_week ?? [], branchIds: t.branch_ids ?? [], sortOrder: String(t.sort_order), active: t.active,
})
const blank = (): Draft => ({
  title: '', slot: 'day', kind: 'simple', subItems: '', autoSource: 'fuel', linkUrl: '', linkLabel: '',
  requirePhoto: false, requireNote: false, daysOfWeek: [], branchIds: [], sortOrder: '100', active: true,
})

export default function QuestSettingsClient({ branches, templates, waitDays: initWait, disabledBranchIds: initDisabled }: {
  branches: Branch[]; templates: Template[]; waitDays: number; disabledBranchIds: string[]
}) {
  const router = useRouter()
  const [waitDays, setWaitDays] = useState(String(initWait))
  const [disabled, setDisabled] = useState<string[]>(initDisabled)
  const [savingSettings, setSavingSettings] = useState(false)
  const [msg, setMsg] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500) }
  const call = async (body: unknown) => {
    const res = await fetch('/api/owner/quests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    return res.ok ? null : (data.error ?? 'เกิดข้อผิดพลาด')
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    const err = await call({ action: 'settings', waitDays: Number(waitDays), disabledBranchIds: disabled })
    setSavingSettings(false)
    flash(err ? '❌ ' + err : '✅ บันทึกการตั้งค่าแล้ว')
    if (!err) router.refresh()
  }

  const saveDraft = async () => {
    if (!draft) return
    setSaving(true)
    const err = await call({
      action: 'save',
      template: { ...draft, subItems: draft.subItems.split('\n'), sortOrder: Number(draft.sortOrder) },
    })
    setSaving(false)
    if (err) { flash('❌ ' + err); return }
    setDraft(null); flash('✅ บันทึกเควสแล้ว'); router.refresh()
  }

  const remove = async (t: Template) => {
    if (!confirm(`ลบเควส "${t.title}"?\n\nประวัติการติ๊กของเควสนี้จะหายไปด้วย — ถ้าแค่ไม่อยากให้ขึ้น ให้ปิดใช้งานแทนการลบ`)) return
    const err = await call({ action: 'delete', id: t.id })
    flash(err ? '❌ ' + err : '🗑️ ลบแล้ว')
    if (!err) router.refresh()
  }

  const toggleActive = async (t: Template) => {
    const err = await call({ action: 'save', template: { ...toDraft(t), subItems: (t.sub_items ?? []), sortOrder: t.sort_order, active: !t.active } })
    flash(err ? '❌ ' + err : t.active ? 'ปิดใช้งานแล้ว' : 'เปิดใช้งานแล้ว')
    if (!err) router.refresh()
  }

  const setD = (patch: Partial<Draft>) => setDraft(d => (d ? { ...d, ...patch } : d))

  return (
    <>
      <SettingsHeader title="เควสประจำวัน" sub="ตั้งงานประจำที่พนักงานต้องติ๊กทุกวัน" />
      {msg && <div style={{ margin: '12px 16px 0', padding: '10px 14px', borderRadius: '10px', background: '#f3f4f6', fontSize: '13px', fontWeight: 600 }}>{msg}</div>}

      <Section title="ตั้งค่ารวม">
        <div style={{ padding: '4px 16px 16px' }}>
          <Field label="รถเช่ารายวันที่รูทีนถึงรอบ — รอทำตอนรถคืนถ้าคืนภายในกี่วัน" hint="คืนช้ากว่านี้จะขึ้นเป็นงานที่ต้องทักให้เข้ามา (รายเดือนทักทันทีเสมอ)">
            <input className="field-input" type="number" min={0} max={60} value={waitDays} onChange={e => setWaitDays(e.target.value)} />
          </Field>
          <div className="field-label" style={{ margin: '8px 0 6px' }}>เปิดใช้เควสรายสาขา</div>
          {branches.map(b => {
            const on = !disabled.includes(b.id)
            return (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: '14px' }}>{b.name}</span>
                <Toggle on={on} onClick={() => setDisabled(prev => on ? [...prev, b.id] : prev.filter(x => x !== b.id))} />
              </div>
            )
          })}
          <div style={{ marginTop: '12px' }}><SaveBtn loading={savingSettings} onClick={saveSettings} /></div>
        </div>
      </Section>

      <Section title={`เควสทั้งหมด (${templates.length})`}>
        <div style={{ padding: '8px 16px 16px' }}>
          {templates.map(t => (
            <div key={t.id} style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px', marginBottom: '8px', opacity: t.active ? 1 : 0.55 }}>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>{t.title}</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>
                {SLOT[t.slot]} • {KIND[t.kind]}{t.kind === 'checklist' ? `: ${(t.sub_items ?? []).join(' / ')}` : ''}{t.kind === 'auto' && t.auto_source ? `: ${AUTO[t.auto_source as keyof typeof AUTO] ?? t.auto_source}` : ''}
                {t.require_photo ? ' • 📷 บังคับรูป' : ''}{t.require_note ? ' • 📝 บังคับข้อความ' : ''}
                {t.days_of_week?.length ? ` • วัน ${t.days_of_week.map(d => DAYS[d]).join(' ')}` : ''}
                {t.branch_ids?.length ? ` • ${t.branch_ids.map(id => branches.find(b => b.id === id)?.name ?? '?').join(', ')}` : ''}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button className="btn" onClick={() => setDraft(toDraft(t))} style={{ fontSize: '12px', padding: '6px 12px' }}>✏️ แก้ไข</button>
                <button className="btn" onClick={() => toggleActive(t)} style={{ fontSize: '12px', padding: '6px 12px' }}>{t.active ? '⏸ ปิดใช้งาน' : '▶️ เปิดใช้งาน'}</button>
                <button className="btn" onClick={() => remove(t)} style={{ fontSize: '12px', padding: '6px 12px', color: '#dc2626' }}>🗑️ ลบ</button>
              </div>
            </div>
          ))}
          {!draft && <button className="btn btn-primary" onClick={() => setDraft(blank())} style={{ width: '100%', marginTop: '6px' }}>+ เพิ่มเควส</button>}
        </div>
      </Section>

      {draft && (
        <Section title={draft.id ? 'แก้ไขเควส' : 'เพิ่มเควสใหม่'}>
          <div style={{ padding: '4px 16px 16px' }}>
            <Field label="ชื่อเควส *"><input className="field-input" value={draft.title} onChange={e => setD({ title: e.target.value })} /></Field>
            <Field label="ช่วงเวลา">
              <select className="field-input" value={draft.slot} onChange={e => setD({ slot: e.target.value as Draft['slot'] })}>
                {Object.entries(SLOT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="ชนิด">
              <select className="field-input" value={draft.kind} onChange={e => setD({ kind: e.target.value as Draft['kind'] })}>
                {Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            {draft.kind === 'checklist' && (
              <Field label="รายการย่อย (บรรทัดละ 1 ข้อ)" hint="เช่น IG / เฟส / ติ๊กต๊อก — เพิ่มช่องทางใหม่ได้ทีหลัง">
                <textarea className="field-input" rows={4} value={draft.subItems} onChange={e => setD({ subItems: e.target.value })} />
              </Field>
            )}
            {draft.kind === 'auto' && (
              <Field label="ดึงจากข้อมูลอะไร">
                <select className="field-input" value={draft.autoSource} onChange={e => setD({ autoSource: e.target.value })}>
                  {Object.entries(AUTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            )}
            <Field label="ปุ่มลิงก์ไปหน้าอื่น (ไม่บังคับ)" hint="เช่น /staff/marketing — ต้องขึ้นต้นด้วย /">
              <input className="field-input" placeholder="/staff/..." value={draft.linkUrl} onChange={e => setD({ linkUrl: e.target.value })} style={{ marginBottom: '6px' }} />
              <input className="field-input" placeholder="ข้อความบนปุ่ม" value={draft.linkLabel} onChange={e => setD({ linkLabel: e.target.value })} />
            </Field>
            {draft.kind === 'simple' && (
              <>
                <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '14px', margin: '8px 0' }}>
                  <input type="checkbox" checked={draft.requirePhoto} onChange={e => setD({ requirePhoto: e.target.checked })} /> 📷 ต้องแนบรูปก่อนติ๊ก
                </label>
                <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '14px', margin: '8px 0' }}>
                  <input type="checkbox" checked={draft.requireNote} onChange={e => setD({ requireNote: e.target.checked })} /> 📝 ต้องเขียนข้อความตอนติ๊ก
                </label>
              </>
            )}
            <Field label="ใช้เฉพาะวัน (ไม่เลือก = ทุกวัน)">
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {DAYS.map((d, i) => {
                  const on = draft.daysOfWeek.includes(i)
                  return <button key={i} type="button" onClick={() => setD({ daysOfWeek: on ? draft.daysOfWeek.filter(x => x !== i) : [...draft.daysOfWeek, i] })} style={{
                    padding: '6px 12px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                    border: `2px solid ${on ? '#111827' : '#e5e7eb'}`, background: on ? '#111827' : '#fff', color: on ? '#fff' : '#6b7280',
                  }}>{d}</button>
                })}
              </div>
            </Field>
            <Field label="ใช้เฉพาะสาขา (ไม่เลือก = ทุกสาขา)">
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {branches.map(b => {
                  const on = draft.branchIds.includes(b.id)
                  return <button key={b.id} type="button" onClick={() => setD({ branchIds: on ? draft.branchIds.filter(x => x !== b.id) : [...draft.branchIds, b.id] })} style={{
                    padding: '6px 12px', borderRadius: '999px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
                    border: `2px solid ${on ? '#111827' : '#e5e7eb'}`, background: on ? '#111827' : '#fff', color: on ? '#fff' : '#6b7280',
                  }}>{b.name}</button>
                })}
              </div>
            </Field>
            <Field label="ลำดับ (เลขน้อยขึ้นก่อน)"><input className="field-input" type="number" value={draft.sortOrder} onChange={e => setD({ sortOrder: e.target.value })} /></Field>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <SaveBtn loading={saving} onClick={saveDraft} />
              <button className="btn" onClick={() => setDraft(null)}>ยกเลิก</button>
            </div>
          </div>
        </Section>
      )}
    </>
  )
}
