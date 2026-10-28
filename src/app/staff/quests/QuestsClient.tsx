'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PhotoUpload from '@/components/PhotoUpload'
import { FOLLOWUP_OUTCOMES, type OutcomeKey, type QuestBoard, type QuestCard, type FixedQuest, type QuestSlot } from '@/lib/questItems'

type Board = Extract<QuestBoard, { enabled: true }>

const SLOT_LABEL: Record<QuestSlot, string> = { open: '🌅 ตอนเปิดร้าน', day: '☀️ ระหว่างวัน', close: '🌙 ตอนปิดร้าน' }
const HOLDER_LABEL = { monthly: '📞 ลูกค้ารายเดือน', daily: '🛵 เช่ารายวัน', shop: '🏠 อยู่ในร้าน' } as const
const URGENCY_COLOR = (u: number) => (u <= 2 ? '#dc2626' : u <= 4 ? '#ea580c' : u === 5 ? '#ca8a04' : '#6b7280')

const timeTh = (iso: string) => new Date(iso).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })
const dateTh = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })

async function post(url: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) return null
    return (await res.json().catch(() => null))?.error ?? 'เกิดข้อผิดพลาด'
  } catch {
    return 'เกิดข้อผิดพลาด กรุณาลองใหม่'
  }
}

function FixedQuestCard({ q, onChanged }: { q: FixedQuest; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [note, setNote] = useState('')

  const tick = async (subItem: string | null, undo = false) => {
    setBusy(true); setError('')
    const err = await post('/api/staff/quests/tick', { templateId: q.id, subItem, undo, note: note || undefined, photoUrl: photoUrl || undefined })
    setBusy(false)
    if (err) { setError(err); return }
    onChanged()
  }

  return (
    <div className="card" style={{ marginBottom: '10px', borderLeft: `4px solid ${q.done ? '#16a34a' : '#d1d5db'}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '14px', color: q.done ? '#16a34a' : '#111827' }}>
            {q.done ? '✅ ' : ''}{q.title}
          </div>
          {q.kind === 'auto' && q.autoSource === 'closeshop' && (
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{q.done ? 'ปิดร้านในแอปแล้ววันนี้ (ติ๊กให้อัตโนมัติ)' : 'ยังไม่ได้ทำรายการปิดร้านในแอปวันนี้'}</div>
          )}
          {q.kind === 'auto' && q.autoSource === 'fuel' && (
            <div style={{ fontSize: '12px', color: q.done ? '#16a34a' : '#dc2626', marginTop: '4px' }}>
              {q.done ? 'รถในร้านน้ำมันเต็มทุกคัน (ติ๊กให้อัตโนมัติ)' : `ต้องเติมน้ำมัน ${q.autoItems.length} คัน: ${q.autoItems.map(a => a.plate).join(', ')}`}
            </div>
          )}
          {q.kind === 'auto' && q.autoSource === 'followups' && (
            <div style={{ fontSize: '12px', color: q.done ? '#16a34a' : '#dc2626', marginTop: '4px' }}>
              {q.done ? 'บันทึกผลรายการต้องทักครบแล้ว (ติ๊กให้อัตโนมัติ)' : `ยังไม่ได้บันทึกผลวันนี้ ${q.autoItems.length} รายการ: ${Array.from(new Set(q.autoItems.map(a => a.plate))).slice(0, 8).join(', ')}${new Set(q.autoItems.map(a => a.plate)).size > 8 ? ' ...' : ''}`}
            </div>
          )}
          {q.meta && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>📷 {q.meta}</div>}
          {q.done && q.kind === 'simple' && q.doneBy && (
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{q.doneBy}{q.doneAt ? ` • ${timeTh(q.doneAt)}` : ''}</div>
          )}
        </div>
        {q.linkUrl && (
          <Link href={q.linkUrl} style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '6px 10px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            {q.linkLabel ?? 'เปิดหน้า'}
          </Link>
        )}
      </div>

      {q.kind === 'checklist' && (
        <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {q.subItems.map(s => (
            <button key={s.label} type="button" disabled={busy} onClick={() => tick(s.label, s.done)} style={{
              padding: '8px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              border: `2px solid ${s.done ? '#16a34a' : '#e5e7eb'}`, background: s.done ? '#dcfce7' : '#fff', color: s.done ? '#166534' : '#374151',
            }}>{s.done ? '✅ ' : '☐ '}{s.label}</button>
          ))}
        </div>
      )}

      {q.kind === 'simple' && !q.done && (
        <div style={{ marginTop: '10px' }}>
          {q.requirePhoto && (
            <div style={{ marginBottom: '8px' }}>
              <PhotoUpload icon="📷" hint="แนบรูปก่อนติ๊ก" folder="quests" onUpload={url => setPhotoUrl(url)} onRemove={() => setPhotoUrl('')} />
            </div>
          )}
          {q.requireNote && (
            <input className="field-input" type="text" placeholder="ข้อความ *" value={note} onChange={e => setNote(e.target.value)} style={{ marginBottom: '8px' }} />
          )}
          <button type="button" disabled={busy} onClick={() => tick(null)} className="btn btn-success" style={{ width: '100%', opacity: busy ? 0.6 : 1 }}>
            {busy ? '⏳' : '✅ ทำแล้ว'}
          </button>
        </div>
      )}
      {q.kind === 'simple' && q.done && (
        <button type="button" disabled={busy} onClick={() => tick(null, true)} style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
          ยกเลิกการติ๊ก
        </button>
      )}
      {error && <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '6px' }}>⚠️ {error}</div>}
    </div>
  )
}

function ChaseCardView({ card, onChanged, minDate, maxDate, snoozeLimit }: { card: QuestCard; onChanged: () => void; minDate: string; maxDate: string; snoozeLimit: number }) {
  const open = card.items.filter(i => !i.doneToday && !i.info)
  const [selected, setSelected] = useState<Set<string>>(new Set(open.map(i => i.key)))
  const [outcome, setOutcome] = useState<OutcomeKey | ''>('')
  const [appt, setAppt] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  const toggle = (key: string) => setSelected(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })
  const needsAppt = outcome === 'appointed' || outcome === 'postponed'
  // ทักมาแล้วถึงลิมิต → นัดวันที่ซ่อนรายการไม่ได้แล้ว (ต้องทักหาพี่เจ้าของร้านแทน)
  const snoozeBlocked = card.items.some(i => selected.has(i.key) && !i.doneToday && !i.info && i.followCount >= snoozeLimit)
  const escalated = card.items.some(i => !i.info && i.escalate)
  const maxUnreachable = Math.max(0, ...card.items.filter(i => !i.info && i.escalate).map(i => i.unreachableDays ?? 0))
  const maxFollowNow = Math.max(0, ...card.items.filter(i => !i.info).map(i => i.followCount))
  // เลือกแต่รายการที่ต้องแจ้งเจ้าของ (พ.ร.บ./ภาษีรถใหม่) → ตัวเลือกผลเป็นชุดของเจ้าของ ไม่ใช่ชุดทักลูกค้า
  const pickedNow = card.items.filter(i => selected.has(i.key) && !i.doneToday && !i.info)
  const ownerMode = pickedNow.length > 0 && pickedNow.every(i => i.notifyOwner === true)
  const outcomeChoices: { key: OutcomeKey; label: string }[] = ownerMode
    ? [{ key: 'notified', label: FOLLOWUP_OUTCOMES.notified }, { key: 'appointed', label: 'พี่เจ้าของร้านนัดวันแล้ว' }, { key: 'other', label: FOLLOWUP_OUTCOMES.other }]
    : (Object.keys(FOLLOWUP_OUTCOMES) as OutcomeKey[]).filter(k => k !== 'notified').map(k => ({ key: k, label: FOLLOWUP_OUTCOMES[k] }))

  const save = async () => {
    const picked = card.items.filter(i => selected.has(i.key) && !i.doneToday && !i.info)
    if (picked.length === 0) { setError('กรุณาติ๊กรายการที่ทักแล้วอย่างน้อย 1 รายการ'); return }
    if (!outcome) { setError('กรุณาเลือกผลการทัก'); return }
    if (!outcomeChoices.some(c => c.key === outcome)) { setError('ผลการทักไม่ตรงกับรายการที่เลือก กรุณาเลือกใหม่'); setOutcome(''); return }
    if (!note.trim()) { setError('กรุณาเขียนข้อความ (ทักแล้วเป็นยังไง)'); return }
    setBusy(true); setError('')
    const err = await post('/api/staff/quests/followup', {
      items: picked.map(i => ({ key: i.key, type: i.type, bikeId: card.bikeId })),
      outcome, appointmentDate: needsAppt && appt && !snoozeBlocked ? appt : null, note,
    })
    setBusy(false)
    if (err) { setError(err); return }
    setNote(''); setOutcome(''); setAppt('')
    onChanged()
  }

  const allNotes = card.items.flatMap(i => i.notes.map(n => ({ ...n, label: i.label }))).sort((a, b) => b.at.localeCompare(a.at))
  const latest = allNotes[0]
  const maxFollow = Math.max(0, ...card.items.map(i => i.followCount))

  return (
    <div className="card" style={{ marginBottom: '10px', borderLeft: `4px solid ${URGENCY_COLOR(card.urgency)}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '15px' }}>{card.plate} <span style={{ fontWeight: 500, fontSize: '12px', color: '#6b7280' }}>{card.bikeName}</span></div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
            {HOLDER_LABEL[card.holder]}{card.customer ? ` • ${card.customer}` : ''}
            {card.expectedEnd ? ` • คืน ${dateTh(card.expectedEnd)} ${timeTh(card.expectedEnd)}` : ''}
          </div>
        </div>
        {card.phone && !card.ownerOnly && (
          <a href={`tel:${card.phone}`} style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '6px 10px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            📞 โทร
          </a>
        )}
      </div>

      {escalated && (
        <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: 700, color: '#fff', background: '#dc2626', borderRadius: '10px', padding: '8px 10px' }}>
          🚨 ติดต่อไม่ได้มาแล้ว {maxUnreachable} วัน — ทักหาพี่เจ้าของร้าน
        </div>
      )}

      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {card.items.map(i => i.info ? (
          <div key={i.key} style={{ padding: '8px 10px', borderRadius: '10px', background: '#eff6ff', border: '1px dashed #bfdbfe' }}>
            <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1d4ed8' }}>🛢️ {i.label}</span>
            <span style={{ display: 'block', fontSize: '12px', color: '#1d4ed8' }}>{i.detail}</span>
          </div>
        ) : (
          <label key={i.key} style={{
            display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '8px 10px', borderRadius: '10px',
            background: i.doneToday ? '#f0fdf4' : selected.has(i.key) ? '#fff7ed' : '#f9fafb', cursor: i.doneToday ? 'default' : 'pointer',
          }}>
            {i.doneToday ? <span style={{ fontSize: '16px' }}>✅</span> : (
              <input type="checkbox" checked={selected.has(i.key)} onChange={() => toggle(i.key)} style={{ width: '18px', height: '18px', marginTop: '1px' }} />
            )}
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#111827' }}>{i.notifyOwner ? '📣 ' : i.type === 'doc' ? '📄 ' : ''}{i.label}</span>
              <span style={{ display: 'block', fontSize: '12px', color: URGENCY_COLOR(i.urgency), fontWeight: 600 }}>{i.detail}{i.doneToday ? ' • ทักวันนี้แล้ว' : ''}</span>
              {i.confirmDate && !i.doneToday && (
                <span style={{ display: 'inline-block', marginTop: '3px', fontSize: '12px', fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', borderRadius: '6px', padding: '2px 8px' }}>📅 นัด {dateTh(i.confirmDate + 'T00:00:00+07:00')} — โทรยืนยัน</span>
              )}
            </span>
          </label>
        ))}
      </div>

      {maxFollow > 0 && latest && (
        <div style={{ marginTop: '10px', fontSize: '12px', background: '#f3f4f6', borderRadius: '10px', padding: '8px 10px', color: '#374151' }}>
          <div style={{ fontWeight: 700 }}>ทักมาแล้ว {maxFollow} ครั้ง</div>
          <div style={{ marginTop: '2px' }}>
            {dateTh(latest.at)} {latest.staff}: <b>{latest.outcome}</b>{latest.appointment ? ` (นัด ${dateTh(latest.appointment)})` : ''} — {latest.note}
          </div>
          {allNotes.length > 1 && (
            <button type="button" onClick={() => setShowHistory(v => !v)} style={{ marginTop: '4px', fontSize: '11px', color: '#6b7280', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
              {showHistory ? 'ซ่อนประวัติ' : `ดูข้อความก่อนหน้า (${allNotes.length - 1})`}
            </button>
          )}
          {showHistory && allNotes.slice(1).map((n, idx) => (
            <div key={idx} style={{ marginTop: '4px', color: '#6b7280' }}>{dateTh(n.at)} {n.staff}: {n.outcome} — {n.note}</div>
          ))}
        </div>
      )}

      {open.length > 0 && (
        <div style={{ marginTop: '12px', borderTop: '1px dashed #e5e7eb', paddingTop: '12px' }}>
          <div className="field-label" style={{ marginBottom: '2px' }}>ผลการทัก *</div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px' }}>ได้คำตอบแล้วกดผลนั้นได้เลย / ถ้าสิ้นวันยังไม่ได้คำตอบ กด "ติดต่อไม่ได้วันนี้" พร้อมเขียนว่าทักไปกี่ครั้ง</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {outcomeChoices.map(c => (
              <button key={c.key} type="button" onClick={() => setOutcome(c.key)} style={{
                padding: '7px 12px', borderRadius: '999px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                border: `2px solid ${outcome === c.key ? '#1d4ed8' : '#e5e7eb'}`, background: outcome === c.key ? '#dbeafe' : '#fff', color: outcome === c.key ? '#1d4ed8' : '#4b5563',
              }}>{c.label}</button>
            ))}
          </div>
          {needsAppt && !snoozeBlocked && (
            <div style={{ marginBottom: '8px' }}>
              <div className="field-label" style={{ marginBottom: '4px' }}>นัดวันที่ (รายการจะหายจนถึง 1 วันก่อนวันนัด — นัดไกลสุดถึง {dateTh(maxDate + 'T00:00:00+07:00')})</div>
              <input className="field-input" type="date" min={minDate} max={maxDate} value={appt} onChange={e => setAppt(e.target.value)} />
            </div>
          )}
          {needsAppt && snoozeBlocked && (
            <div style={{ marginBottom: '8px', fontSize: '12px', color: '#dc2626', background: '#fef2f2', borderRadius: '8px', padding: '8px 10px' }}>
              ทักมาแล้วครบ {snoozeLimit} ครั้ง นัดวันที่ซ่อนรายการไม่ได้แล้ว — ให้ทักหาพี่เจ้าของร้าน (รายการจะขึ้นให้เห็นทุกวันจนกว่างานจะจบ)
            </div>
          )}
          <textarea className="field-input" rows={2} placeholder={ownerMode ? 'ข้อความ * เช่น ทักหาพี่เจ้าของร้านแล้วทางไลน์' : 'ข้อความ * เช่น ทักแล้ว ลูกค้าบอกจะมาพรุ่งนี้'} value={note} onChange={e => setNote(e.target.value)} style={{ marginBottom: '8px' }} />
          {error && <div style={{ color: '#dc2626', fontSize: '12px', marginBottom: '6px' }}>⚠️ {error}</div>}
          <button type="button" disabled={busy} onClick={save} className="btn btn-success" style={{ width: '100%', opacity: busy ? 0.6 : 1 }}>
            {busy ? '⏳ กำลังบันทึก...' : `💾 บันทึกการติดตาม (${selected.size} รายการ)`}
          </button>
        </div>
      )}
    </div>
  )
}

function SelfCardView({ card }: { card: QuestCard }) {
  return (
    <div className="card" style={{ marginBottom: '10px', borderLeft: '4px solid #9ca3af' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '15px' }}>{card.plate} <span style={{ fontWeight: 500, fontSize: '12px', color: '#6b7280' }}>{card.bikeName}</span></div>
          {card.items.map(i => (
            <div key={i.key} style={{ fontSize: '13px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span><b>{i.type === 'doc' ? '📄 ' : ''}{i.label}</b> <span style={{ color: '#6b7280' }}>— {i.detail}</span></span>
              <Link href={i.href ?? `/staff/routine?bikeId=${card.bikeId}`} style={{ fontSize: '12px', fontWeight: 700, color: '#c2410c', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '6px 10px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                ✅ ทำรายการ
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Section({ title, count, children, color = '#111827' }: { title: string; count?: number; children: React.ReactNode; color?: string }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontWeight: 800, fontSize: '13px', color, padding: '4px 2px 8px' }}>{title}{count != null ? ` (${count})` : ''}</div>
      {children}
    </div>
  )
}

function Collapsible({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginBottom: '14px' }}>
      <button type="button" onClick={() => setOpen(v => !v)} style={{ width: '100%', textAlign: 'left', background: '#f3f4f6', border: 'none', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', fontWeight: 700, color: '#4b5563', cursor: 'pointer', fontFamily: 'inherit' }}>
        {open ? '▾' : '▸'} {title} ({count})
      </button>
      {open && <div style={{ marginTop: '8px' }}>{children}</div>}
    </div>
  )
}

export default function QuestsClient({ board }: { board: QuestBoard }) {
  const router = useRouter()
  const [tab, setTab] = useState<'quest' | 'queue'>('quest')

  // รีเฟรชข้อมูลเองทุก ~90 วินาที (งานที่คนอื่นทำเสร็จจะหายจากรายการเอง) — ไม่รีเฟรชตอนแท็บไม่ได้เปิดอยู่
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) router.refresh() }, 90_000)
    return () => clearInterval(t)
  }, [router])

  const refresh = () => router.refresh()

  if (!board.enabled) {
    return (
      <div className="app-wrap">
        <div className="app-header">
          <Link href="/staff/home" className="app-header-back">←</Link>
          <div><h1>เควสประจำวัน</h1></div>
        </div>
        <div className="section-pad" style={{ textAlign: 'center', padding: '40px 16px', color: '#9ca3af' }}>{board.reason}</div>
      </div>
    )
  }

  const b: Board = board
  const pct = b.progress.total > 0 ? Math.round((b.progress.done / b.progress.total) * 100) : 100
  const fixedBySlot = (slot: QuestSlot) => b.fixed.filter(f => f.slot === slot)
  const maxApptDate = new Date(Date.parse(`${b.date}T00:00:00Z`) + b.limits.appointmentDays * 86_400_000).toISOString().split('T')[0]

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: '#7c2d12' }}>
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div style={{ flex: 1 }}>
          <h1>เควสประจำวัน</h1>
          <div className="sub">ทำแล้ว {b.progress.done}/{b.progress.total} ({pct}%)</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', padding: '12px 16px 0' }}>
        {([['quest', 'เควส'], ['queue', 'คิวรายวัน']] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} style={{
            flex: 1, padding: '10px', borderRadius: '10px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
            border: 'none', background: tab === key ? '#7c2d12' : '#f3f4f6', color: tab === key ? '#fff' : '#6b7280',
          }}>{label}{key === 'queue' ? ` (${b.queue.returns.length + b.queue.sends.length})` : ''}</button>
        ))}
      </div>

      <div className="section-pad" style={{ paddingTop: '14px' }}>
        {tab === 'quest' && (
          <>
            {fixedBySlot('open').length > 0 && (
              <Section title={SLOT_LABEL.open}>{fixedBySlot('open').map(q => <FixedQuestCard key={q.id} q={q} onChanged={refresh} />)}</Section>
            )}

            {b.chase.length > 0 && (
              <Section title="📞 ต้องทัก" count={b.chase.length} color="#dc2626">
                {b.chase.map(c => <ChaseCardView key={c.bikeId} card={c} onChanged={refresh} minDate={b.date} maxDate={maxApptDate} snoozeLimit={b.limits.snoozeLimit} />)}
              </Section>
            )}

            {b.self.length > 0 && (
              <Section title="🔧 ทำเอง (รถอยู่ในร้าน)" count={b.self.length}>
                {b.self.map(c => <SelfCardView key={c.bikeId} card={c} />)}
              </Section>
            )}

            {fixedBySlot('day').length > 0 && (
              <Section title={SLOT_LABEL.day}>{fixedBySlot('day').map(q => <FixedQuestCard key={q.id} q={q} onChanged={refresh} />)}</Section>
            )}
            {fixedBySlot('close').length > 0 && (
              <Section title={SLOT_LABEL.close}>{fixedBySlot('close').map(q => <FixedQuestCard key={q.id} q={q} onChanged={refresh} />)}</Section>
            )}

            {b.chase.length === 0 && b.self.length === 0 && (
              <div style={{ textAlign: 'center', color: '#16a34a', fontSize: '13px', padding: '8px 0 16px' }}>✅ ไม่มีงานค้างที่ต้องติดตามตอนนี้</div>
            )}

            {b.wait.length > 0 && (
              <Collapsible title={`รอรถกลับ (เช่ารายวัน คืนภายใน ${b.waitDays} วัน — ไม่ต้องทำอะไร)`} count={b.wait.length}>
                {b.wait.map(c => (
                  <div key={c.bikeId} className="card" style={{ marginBottom: '8px', opacity: 0.85 }}>
                    <div style={{ fontWeight: 700, fontSize: '13px' }}>{c.plate} <span style={{ fontWeight: 400, color: '#6b7280' }}>{c.customer ?? ''}</span></div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {c.expectedEnd ? `คืน ${dateTh(c.expectedEnd)} ${timeTh(c.expectedEnd)} • ` : ''}{c.items.map(i => i.label).join(', ')} — ทำตอนรับคืน
                    </div>
                  </div>
                ))}
              </Collapsible>
            )}
            {b.snoozed.length > 0 && (
              <Collapsible title="นัดไว้แล้ว (จะกลับมาเมื่อถึงวันนัด)" count={b.snoozed.length}>
                {b.snoozed.map(c => (
                  <div key={c.bikeId} className="card" style={{ marginBottom: '8px', opacity: 0.85 }}>
                    <div style={{ fontWeight: 700, fontSize: '13px' }}>{c.plate} <span style={{ fontWeight: 400, color: '#6b7280' }}>{c.customer ?? ''}</span></div>
                    {c.items.map(i => (
                      <div key={i.key} style={{ fontSize: '12px', color: '#6b7280' }}>
                        {i.label}{i.notes[0]?.appointment ? ` • นัด ${dateTh(i.notes[0].appointment)}` : ''}{i.notes[0] ? ` — ${i.notes[0].note}` : ''}
                      </div>
                    ))}
                  </div>
                ))}
              </Collapsible>
            )}
          </>
        )}

        {tab === 'queue' && (
          <>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
              คิวของวันนี้ ระบบติ๊กให้เองเมื่อบันทึกรับคืน/ส่งรถ ไม่ต้องเขียนข้อความและไม่นับเป็นเควส
            </div>
            <Section title={`⏰ รับคืนวันนี้ — รอ ${b.queue.returns.length} • รับแล้ว ${b.queue.returnsDone}`}>
              {b.queue.returns.length === 0 && <div style={{ color: '#9ca3af', fontSize: '13px' }}>ไม่มีคิวรับคืนที่รอ</div>}
              {b.queue.returns.map(r => (
                <div key={r.id} className="card" style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <b>{r.plate}</b><span style={{ color: r.detail === 'เลยเวลาแล้ว' ? '#dc2626' : '#6b7280', fontSize: '12px', fontWeight: 700 }}>{r.time} • {r.detail}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{r.customer}</div>
                </div>
              ))}
            </Section>
            <Section title={`🚚 ส่งรถวันนี้ — รอ ${b.queue.sends.length} • ส่งแล้ว ${b.queue.sendsDone}`}>
              {b.queue.sends.length === 0 && <div style={{ color: '#9ca3af', fontSize: '13px' }}>ไม่มีคิวส่งที่รอ</div>}
              {b.queue.sends.map(r => (
                <div key={r.id} className="card" style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <b>{r.plate || 'รอจัดรถ'}</b><span style={{ color: '#6b7280', fontSize: '12px', fontWeight: 700 }}>{r.time}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{r.customer} • {r.detail}</div>
                </div>
              ))}
              <Link href="/staff/send-queue" style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 700 }}>ไปหน้าส่งรถคิวจอง →</Link>
            </Section>
          </>
        )}
      </div>
    </div>
  )
}
