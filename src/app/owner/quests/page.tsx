import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { bangkokDate, FOLLOWUP_OUTCOMES, loadQuestBoard } from '@/lib/questItems'

export const dynamic = 'force-dynamic'

const SLOT_LABEL = { open: '🌅 เปิดร้าน', day: '☀️ ระหว่างวัน', close: '🌙 ปิดร้าน' } as const
const time = (iso: string) => new Date(iso).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })
const date = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })

export default async function OwnerQuestsPage({ searchParams }: { searchParams: Promise<{ plate?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const { plate = '' } = await searchParams
  const admin = createAdminClient()
  const today = bangkokDate()
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay()
  const since = bangkokDate(Date.now() - 30 * 86_400_000)

  const [{ data: branches }, { data: templates }, { data: logs }, { data: followups }, { data: settings }] = await Promise.all([
    admin.from('branches').select('id, name').order('name'),
    admin.from('daily_quest_templates').select('id, title, slot, kind, sub_items, branch_ids, days_of_week, auto_source').eq('active', true).order('sort_order'),
    admin.from('daily_quest_logs').select('template_id, branch_id, sub_item, staff_name, done_at, note, photo_url').eq('quest_date', today),
    admin.from('quest_followups').select('item_key, item_type, bike_id, branch_id, quest_date, staff_name, outcome, appointment_date, note, created_at').gte('quest_date', since).order('created_at', { ascending: false }).limit(500),
    admin.from('quest_settings').select('disabled_branch_ids').eq('id', 1).maybeSingle(),
  ])

  const bikeIds = Array.from(new Set((followups ?? []).map(f => f.bike_id).filter(Boolean))) as string[]
  const { data: bikes } = bikeIds.length ? await admin.from('bikes').select('id, license_plate').in('id', bikeIds) : { data: [] as { id: string; license_plate: string }[] }
  const plateOf = new Map((bikes ?? []).map(b => [b.id, b.license_plate]))
  const disabled = settings?.disabled_branch_ids ?? []

  // รายการติดตามที่ทักมาแล้วถึงลิมิต (ค่าเริ่ม 2 ครั้ง) แต่ยังไม่จบ — ดึงจากตัวคัดงานตัวเดียวกับหน้าพนักงาน ทุกสาขา
  const anyBranch = (branches ?? []).find(b => !disabled.includes(b.id))
  const board = anyBranch ? await loadQuestBoard(admin, { allowedBranchIds: null, allowedBikeIds: null, ownBranchId: anyBranch.id }) : null
  const escalated = board && board.enabled ? board.chase.filter(c => c.items.some(i => !i.info && i.escalate)) : []

  const filtered = (followups ?? []).filter(f => !plate || (plateOf.get(f.bike_id) ?? '').replace(/\s/g, '').includes(plate.replace(/\s/g, '')))
  const todayFollowups = (followups ?? []).filter(f => f.quest_date === today)

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: '#111827' }}>
        <Link href="/owner/dashboard" className="app-header-back">←</Link>
        <div style={{ flex: 1 }}>
          <h1>เควสประจำวัน</h1>
          <div className="sub">สรุปวันนี้ + ประวัติการติดตาม</div>
        </div>
        <Link href="/owner/settings/quests" style={{ color: '#fff', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>⚙️ ตั้งค่า</Link>
      </div>

      <div className="section-pad" style={{ paddingTop: '12px' }}>
        {(branches ?? []).map(b => {
          const mine = (templates ?? []).filter(t => (!t.branch_ids?.length || t.branch_ids.includes(b.id)) && (!t.days_of_week?.length || t.days_of_week.includes(dow)))
          const bLogs = (logs ?? []).filter(l => l.branch_id === b.id)
          const bFollow = todayFollowups.filter(f => f.branch_id === b.id)
          const isOff = disabled.includes(b.id)
          const done = mine.filter(t => {
            if (t.kind === 'auto') return false
            const tl = bLogs.filter(l => l.template_id === t.id)
            return t.kind === 'checklist' ? (t.sub_items ?? []).length > 0 && (t.sub_items as string[]).every(s => tl.some(l => l.sub_item === s)) : tl.length > 0
          }).length
          const manual = mine.filter(t => t.kind !== 'auto')
          return (
            <div key={b.id} className="card" style={{ marginBottom: '12px', opacity: isOff ? 0.5 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: '15px' }}>{b.name}</div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: isOff ? '#9ca3af' : done === manual.length ? '#16a34a' : '#ea580c' }}>
                  {isOff ? 'ปิดเควสสาขานี้' : `เควสประจำ ${done}/${manual.length} • ติดตามแล้ววันนี้ ${bFollow.length} รายการ`}
                </div>
              </div>
              {!isOff && (
                <div style={{ marginTop: '8px' }}>
                  {manual.map(t => {
                    const tl = bLogs.filter(l => l.template_id === t.id)
                    const isDone = t.kind === 'checklist' ? (t.sub_items as string[]).every(s => tl.some(l => l.sub_item === s)) : tl.length > 0
                    return (
                      <div key={t.id} style={{ display: 'flex', gap: '8px', padding: '6px 0', borderTop: '1px solid #f3f4f6', fontSize: '13px' }}>
                        <span>{isDone ? '✅' : '⬜'}</span>
                        <span style={{ flex: 1 }}>
                          <span style={{ color: '#9ca3af', fontSize: '11px' }}>{SLOT_LABEL[t.slot as keyof typeof SLOT_LABEL]} </span>{t.title}
                          {t.kind === 'checklist' && (
                            <span style={{ color: '#6b7280', fontSize: '12px' }}> — {(t.sub_items as string[]).map(s => `${tl.some(l => l.sub_item === s) ? '✓' : '✗'}${s}`).join(' ')}</span>
                          )}
                          {tl[0] && <span style={{ color: '#9ca3af', fontSize: '11px' }}> • {tl[0].staff_name ?? ''} {time(tl[0].done_at)}{tl[0].photo_url ? ' • 📷' : ''}</span>}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        <div style={{ fontWeight: 800, fontSize: '13px', padding: '8px 2px', color: '#dc2626' }}>🚨 ติดตามเกินลิมิตยังไม่จบ ({escalated.length} คัน)</div>
        {escalated.length === 0 && <div style={{ color: '#9ca3af', fontSize: '13px', padding: '4px 0 14px' }}>ไม่มีรายการที่ติดตามเกินลิมิต</div>}
        {escalated.map(c => (
          <div key={c.bikeId} className="card" style={{ marginBottom: '8px', borderLeft: '4px solid #dc2626' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <b>{c.plate}</b><span style={{ color: '#6b7280', fontSize: '12px' }}>{c.holder === 'monthly' ? 'รายเดือน' : c.holder === 'daily' ? 'รายวัน' : 'ในร้าน'}{c.customer ? ` • ${c.customer}` : ''}</span>
            </div>
            {c.items.filter(i => !i.info && i.escalate).map(i => (
              <div key={i.key} style={{ fontSize: '12px', marginTop: '4px' }}>
                <b>{i.label}</b> <span style={{ color: '#dc2626' }}>— {i.detail} • ทักมาแล้ว {i.followCount} ครั้ง</span>
                {i.notes[0] && <div style={{ color: '#6b7280' }}>ล่าสุด {date(i.notes[0].at)} {i.notes[0].staff}: {i.notes[0].outcome} — {i.notes[0].note}</div>}
              </div>
            ))}
          </div>
        ))}

        <div style={{ fontWeight: 800, fontSize: '13px', padding: '8px 2px' }}>📞 ประวัติการติดตาม (30 วันล่าสุด)</div>
        <form style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <input name="plate" defaultValue={plate} placeholder="ค้นหาด้วยทะเบียน" className="field-input" style={{ flex: 1 }} />
          <button className="btn btn-primary" type="submit">ค้นหา</button>
        </form>
        {filtered.length === 0 && <div style={{ color: '#9ca3af', fontSize: '13px', padding: '16px 0', textAlign: 'center' }}>ยังไม่มีบันทึกการติดตาม</div>}
        {filtered.slice(0, 100).map((f, idx) => (
          <div key={idx} className="card" style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <b>{plateOf.get(f.bike_id) ?? '—'}</b>
              <span style={{ color: '#6b7280', fontSize: '12px' }}>{date(f.created_at)} {time(f.created_at)} • {f.staff_name ?? ''}</span>
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
              {f.item_type === 'return' ? 'ทวงคืนรถ' : f.item_type === 'pay' ? 'ค่าเช่ารายเดือน' : f.item_type === 'doc' ? 'เอกสาร (ภาษี/พ.ร.บ.)' : 'รูทีน'} • <b style={{ color: '#111827' }}>{(FOLLOWUP_OUTCOMES as Record<string, string>)[f.outcome] ?? f.outcome}</b>
              {f.appointment_date ? ` • นัด ${date(f.appointment_date)}` : ''}
            </div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>{f.note}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
