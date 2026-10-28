import type { createAdminClient } from '@/lib/supabase/admin'
import { routineDueReasons } from '@/lib/routineStatus'
import { ENGINE_TASK, GEAR_TASK, gearDueThisChange } from '@/lib/routineCycle'

// ตัวคัดงานของหน้าเควส — อ่านข้อมูลเดิมอย่างเดียว (ไม่เขียนลงตารางเดิม) คำนวณสดทุกครั้งที่เปิดหน้า
// งานจบ (บันทึกรูทีน/เก็บเงิน/คืนรถ) ก็หลุดจากรายการเองทันทีที่โหลดหน้าครั้งถัดไป

type Admin = ReturnType<typeof createAdminClient>

export const FOLLOWUP_OUTCOMES = {
  appointed: 'นัดแล้ว',
  no_answer: 'ไม่รับสาย',
  postponed: 'ขอเลื่อน',
  refused: 'ปฏิเสธ',
  other: 'อื่นๆ',
  notified: 'แจ้งเจ้าของแล้ว', // ใช้กับงานเอกสารที่ต้องแจ้งเจ้าของ (พ.ร.บ./ภาษีรถไม่ต้องนำเข้า)
} as const
export type OutcomeKey = keyof typeof FOLLOWUP_OUTCOMES

export type QuestItemType = 'return' | 'pay' | 'routine' | 'doc'
export type QuestGroup = 'chase' | 'self' | 'wait'
export type QuestSlot = 'open' | 'day' | 'close'

export type FollowupNote = { staff: string; at: string; outcome: string; note: string; appointment: string | null }
export type QuestSubItem = {
  key: string
  type: QuestItemType
  label: string
  detail: string
  urgency: number
  doneToday: boolean
  followCount: number
  notes: FollowupNote[]
  info?: boolean          // บรรทัดข้อมูลเฉยๆ (เช่น น้ำมันเครื่องคาดครบเมื่อไหร่) ไม่ต้องติ๊ก
  notifyOwner?: boolean   // งานที่ต้องแจ้งเจ้าของ ไม่ใช่ทักลูกค้า
  href?: string           // ปุ่ม "ทำรายการ" ของกลุ่มทำเอง
}
export type QuestCard = {
  bikeId: string
  plate: string
  bikeName: string
  holder: 'monthly' | 'daily' | 'shop'
  customer: string | null
  phone: string | null
  expectedEnd: string | null
  group: QuestGroup
  urgency: number
  ownerOnly: boolean      // การ์ดนี้มีแต่งานที่ต้องแจ้งเจ้าของ (ไม่ต้องทักลูกค้า)
  items: QuestSubItem[]
}
export type FixedQuest = {
  id: string
  title: string
  slot: QuestSlot
  kind: 'simple' | 'checklist' | 'auto'
  requirePhoto: boolean
  requireNote: boolean
  linkUrl: string | null
  linkLabel: string | null
  done: boolean
  doneBy: string | null
  doneAt: string | null
  note: string | null
  photoUrl: string | null
  subItems: { label: string; done: boolean; by: string | null; at: string | null }[]
  autoSource: string | null
  autoItems: { id: string; plate: string; detail: string }[]
  meta: string | null
}
export type QueueRow = { id: string; plate: string; customer: string; time: string; detail: string }
export type QuestBoard =
  | { enabled: false; reason: string }
  | {
      enabled: true
      date: string
      branchId: string
      waitDays: number
      fixed: FixedQuest[]
      chase: QuestCard[]
      self: QuestCard[]
      wait: QuestCard[]
      snoozed: QuestCard[]
      queue: { returns: QueueRow[]; sends: QueueRow[]; returnsDone: number; sendsDone: number }
      progress: { done: number; total: number }
    }

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))

export function bangkokDate(ms: number = Date.now()): string {
  return new Date(ms + 7 * 3_600_000).toISOString().split('T')[0]
}

// วันครบกำหนด "รอบปัจจุบัน" ของรายเดือน (รอบล่าสุดที่ถึงหรือเลยแล้ว นับถึงวันนี้) — ตรรกะเดียวกับหน้างานค้างของพนักงาน (staff/jobs/page.tsx)
function currentCycleDue(startDateStr: string, paymentDay: number | null, todayMs: number): { due: string; daysUntil: number } | null {
  if (!startDateStr) return null
  const [sy, sm, sd] = String(startDateStr).split('-').map(Number)
  const pd = paymentDay ?? sd
  const offset = pd < sd ? 1 : 0
  let last: { ms: number; str: string } | null = null
  for (let i = 0; i < 600; i++) {
    const tot = (sm - 1) + i + offset
    const y = sy + Math.floor(tot / 12)
    const m = ((tot % 12) + 12) % 12
    const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
    const day = Math.min(pd, dim)
    const ms = Date.UTC(y, m, day)
    if (ms > todayMs) break
    last = { ms, str: `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` }
  }
  if (!last) return null
  return { due: last.str, daysUntil: Math.round((last.ms - todayMs) / 86_400_000) }
}

const thaiDate = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })

export async function loadQuestBoard(
  supabase: Admin,
  opts: { allowedBranchIds: string[] | null; allowedBikeIds: string[] | null; ownBranchId: string },
): Promise<QuestBoard> {
  const { allowedBranchIds, allowedBikeIds, ownBranchId } = opts
  const nowMs = Date.now()
  const today = bangkokDate(nowMs)
  const [ty, tm, td] = today.split('-').map(Number)
  const todayMs = Date.UTC(ty, tm - 1, td)
  const dayStartMs = Date.parse(`${today}T00:00:00+07:00`)
  const dayEndMs = dayStartMs + 86_400_000
  const dow = new Date(todayMs).getUTCDay()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byBike = (q: any) => (allowedBikeIds ? q.in('bike_id', allowedBikeIds) : q)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byBranch = (q: any) => (allowedBranchIds ? q.in('branch_id', allowedBranchIds) : q)

  const { data: settings } = await supabase.from('quest_settings').select('*').eq('id', 1).maybeSingle()
  const waitDays = Number(settings?.wait_days ?? 7)
  // ค่าเอกสาร (เจ้าของปรับได้): พ.ร.บ./ภาษีรถไม่ต้องนำเข้า เตือนก่อนหมดกี่วัน, ภาษีรถที่ต้องนำเข้าเตือนล่วงหน้ากี่วัน,
  // ภาษีหมดแล้วรอรวมกับน้ำมันเครื่องได้กี่วัน, รถอายุเท่าไหร่ขึ้นไปต้องนำเข้าตรวจ
  const pobLead = Number(settings?.pob_lead_days ?? 7)
  const taxLead = Number(settings?.tax_lead_days ?? 30)
  const taxExpiredWait = Number(settings?.tax_expired_wait_days ?? 7)
  const inspectYears = Number(settings?.inspect_years ?? 5)
  if ((settings?.disabled_branch_ids ?? []).includes(ownBranchId)) return { enabled: false, reason: 'เควสยังไม่เปิดใช้สำหรับสาขานี้' }

  const since = bangkokDate(nowMs - 90 * 86_400_000)
  const [
    { data: bikesRaw },
    { data: rentalsRaw },
    { data: monthlyRaw },
    { data: routinesRaw },
    { data: templatesRaw },
    { data: logsRaw },
    { data: closeshopRaw },
    { count: marketingCount },
    { data: followupsRaw },
    { data: returnedTodayRaw },
    { data: startedTodayRaw },
    { data: bookingsRaw },
    { data: docsRaw },
  ] = await Promise.all([
    byBranch(supabase.from('bikes').select('id, license_plate, brand, model, status, branch_id, odometer, fuel_level, year').neq('status', 'retired')),
    byBike(supabase.from('rentals').select('id, bike_id, expected_end_datetime, customers(name, phone)').in('status', ['active', 'extended'])),
    byBike(supabase.from('monthly_rentals').select('id, bike_id, start_date, payment_day, monthly_rate, customers(name, phone)').eq('status', 'active')),
    byBike(supabase.from('bike_routines').select('id, bike_id, task_name, next_due_km, next_due_date, interval_rented_days, rented_days_accumulated, last_done_date, follows_engine, engine_changes_since').limit(2000)),
    supabase.from('daily_quest_templates').select('*').eq('active', true).order('sort_order', { ascending: true }),
    supabase.from('daily_quest_logs').select('template_id, sub_item, staff_name, note, photo_url, done_at').eq('quest_date', today).eq('branch_id', ownBranchId),
    supabase.from('staff_closeshops').select('id').eq('branch_id', ownBranchId).gte('closed_at', new Date(dayStartMs).toISOString()).lt('closed_at', new Date(dayEndMs).toISOString()).limit(1),
    supabase.from('marketing_photos').select('id', { count: 'exact', head: true }).eq('branch_id', ownBranchId),
    byBranch(supabase.from('quest_followups').select('item_key, item_type, bike_id, quest_date, staff_name, outcome, appointment_date, note, created_at').gte('quest_date', since).order('created_at', { ascending: false }).limit(3000)),
    byBike(supabase.from('rentals').select('id').eq('status', 'returned').gte('actual_end_datetime', new Date(dayStartMs).toISOString()).lt('actual_end_datetime', new Date(dayEndMs).toISOString())),
    byBike(supabase.from('rentals').select('id').gte('start_datetime', new Date(dayStartMs).toISOString()).lt('start_datetime', new Date(dayEndMs).toISOString())),
    byBranch(supabase.from('bookings').select('id, booking_ref, start_datetime, customer_name, requested_brand, requested_model, bikes(license_plate)').eq('status', 'confirmed').gte('start_datetime', new Date(dayStartMs).toISOString()).lt('start_datetime', new Date(dayEndMs).toISOString())),
    byBike(supabase.from('bike_documents').select('id, bike_id, doc_type, expiry_date').in('doc_type', ['tax', 'pob']).not('expiry_date', 'is', null)),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Row = Record<string, any>
  const bikes = (bikesRaw ?? []) as Row[]
  const bikeById = new Map(bikes.map(b => [b.id as string, b]))
  const rentals = ((rentalsRaw ?? []) as Row[]).filter(r => bikeById.has(r.bike_id))
  const monthlies = ((monthlyRaw ?? []) as Row[]).filter(m => bikeById.has(m.bike_id))
  const routines = ((routinesRaw ?? []) as Row[]).filter(r => bikeById.has(r.bike_id))
  const rentalByBike = new Map<string, Row>()
  for (const r of rentals) rentalByBike.set(r.bike_id, r)
  const monthlyByBike = new Map<string, Row>()
  for (const m of monthlies) monthlyByBike.set(m.bike_id, m)

  // เก็บเงินรอบนั้นแล้วหรือยัง (ตัดรายเดือนที่จ่ายแล้วออก)
  const paidPairs = new Set<string>()
  if (monthlies.length > 0) {
    const { data: paid } = await supabase
      .from('monthly_payments')
      .select('monthly_rental_id, due_date')
      .eq('status', 'paid')
      .is('voided_at', null)
      .in('monthly_rental_id', monthlies.map(m => m.id))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of paid ?? []) paidPairs.add(`${(p as any).monthly_rental_id}|${(p as any).due_date}`)
  }

  // ── ประวัติการติดตามตาม item_key ──
  const followByKey = new Map<string, Row[]>()
  for (const f of (followupsRaw ?? []) as Row[]) (followByKey.get(f.item_key) ?? followByKey.set(f.item_key, []).get(f.item_key)!).push(f)
  const decorate = (key: string, type: QuestItemType, label: string, detail: string, urgency: number, extra?: Partial<QuestSubItem>): QuestSubItem => {
    const fs = followByKey.get(key) ?? []
    return {
      key, type, label, detail, urgency,
      doneToday: fs.some(f => f.quest_date === today),
      followCount: fs.length,
      notes: fs.slice(0, 3).map(f => ({
        staff: f.staff_name ?? '', at: f.created_at, outcome: (FOLLOWUP_OUTCOMES as Record<string, string>)[f.outcome] ?? f.outcome,
        note: f.note, appointment: f.appointment_date ?? null,
      })),
      ...extra,
    }
  }
  // นัดวันที่ไว้ในอนาคต → ซ่อนจนถึงวันนัด
  const snoozedKey = (key: string) => (followByKey.get(key) ?? []).some(f => f.appointment_date && f.appointment_date > today)

  // ── สร้างรายการย่อยต่อคัน ──
  type Draft = { bikeId: string; items: QuestSubItem[]; hasRetOverdue: boolean }
  const drafts = new Map<string, Draft>()
  const draftOf = (bikeId: string) => drafts.get(bikeId) ?? drafts.set(bikeId, { bikeId, items: [], hasRetOverdue: false }).get(bikeId)!

  // 1) เลยกำหนดคืน (รายวัน)
  for (const r of rentals) {
    const endMs = new Date(r.expected_end_datetime).getTime()
    if (endMs >= nowMs) continue
    const overMs = nowMs - endMs
    const detail = overMs < 48 * 3_600_000 ? `เลยกำหนดคืน ${Math.max(1, Math.floor(overMs / 3_600_000))} ชม.` : `เลยกำหนดคืน ${Math.floor(overMs / 86_400_000)} วัน`
    const d = draftOf(r.bike_id)
    d.hasRetOverdue = true
    d.items.push(decorate(`ret:${r.id}`, 'return', 'ทักทวงคืนรถ', detail, 1))
  }
  // 2-3) รายเดือนถึงกำหนดจ่าย/ค้างจ่าย
  for (const m of monthlies) {
    const cyc = currentCycleDue(m.start_date, m.payment_day, todayMs)
    if (!cyc || cyc.daysUntil > 0 || paidPairs.has(`${m.id}|${cyc.due}`)) continue
    const late = -cyc.daysUntil
    draftOf(m.bike_id).items.push(decorate(
      `pay:${m.id}:${cyc.due}`, 'pay',
      `ค่าเช่ารายเดือน ฿${Number(m.monthly_rate ?? 0).toLocaleString()} (ครบ ${thaiDate(cyc.due)})`,
      late > 0 ? `ค้างจ่าย ${late} วัน` : 'ครบกำหนดวันนี้',
      late > 0 ? 2 : 3,
    ))
  }
  // 4-6) รูทีนถึงรอบ — จัดตามที่รถอยู่
  const gearCount = new Map<string, number>()
  for (const r of routines) if (r.task_name === GEAR_TASK && r.follows_engine === true) gearCount.set(r.bike_id, Number(r.engine_changes_since ?? 0))
  const routineWait = new Set<string>() // bikeId ที่ "รอรถกลับ" (รายวัน กลับภายใน waitDays)
  for (const r of routines) {
    const bike = bikeById.get(r.bike_id)!
    const { overdue } = routineDueReasons(r as never, bike.odometer ?? 0, nowMs)
    if (overdue.length === 0) continue
    const gearNote = r.task_name === ENGINE_TASK && gearCount.has(r.bike_id) && gearDueThisChange(gearCount.get(r.bike_id)!) ? ' + เฟืองท้าย ⚙️' : ''
    const label = `${r.task_name}${gearNote}`
    const detail = overdue.map(x => x.short).join(' • ')
    const monthly = monthlyByBike.get(r.bike_id)
    const rental = rentalByBike.get(r.bike_id)
    const key = `rtn:${r.id}:${r.last_done_date ?? 'never'}`
    if (monthly) {
      draftOf(r.bike_id).items.push(decorate(key, 'routine', label, detail, 4))
    } else if (rental) {
      const endMs = new Date(rental.expected_end_datetime).getTime()
      if (endMs < nowMs) draftOf(r.bike_id).items.push(decorate(key, 'routine', label, detail, 1)) // เลยกำหนดคืนอยู่แล้ว ไปกับการ์ดทวงคืน
      else if (endMs - nowMs <= waitDays * 86_400_000) { routineWait.add(r.bike_id); draftOf(r.bike_id).items.push(decorate(key, 'routine', label, detail, 7)) }
      else draftOf(r.bike_id).items.push(decorate(key, 'routine', label, detail, 5))
    } else {
      draftOf(r.bike_id).items.push(decorate(key, 'routine', label, detail, 6))
    }
  }

  // 7) เอกสาร พ.ร.บ./ภาษี
  //  - พ.ร.บ. (และภาษีรถอายุไม่ถึง inspectYears ปี ที่ไม่ต้องนำเข้าตรวจ): ซื้อ/ต่อเองไม่ได้ → แจ้งเจ้าของ ตั้งแต่ก่อนหมด pobLead วัน และหลังหมดตลอดไปจนกว่าจะต่อ
  //  - ภาษีรถที่ต้องนำเข้า: เตือนล่วงหน้า taxLead วัน (ต่อล่วงหน้าได้) จัดตามที่รถอยู่เหมือนรูทีน และนัดรวมกับน้ำมันเครื่องถ้าคาดว่าจะครบก่อนภาษีหมด
  //    ภาษีหมดแล้วรอรวมกับน้ำมันเครื่องได้ไม่เกิน taxExpiredWait วัน
  const daysTo = (dateStr: string) => {
    const [y, m, d] = String(dateStr).split('-').map(Number)
    return Math.round((Date.UTC(y, m - 1, d) - todayMs) / 86_400_000)
  }
  const engineByBike = new Map<string, Row>()
  for (const r of routines) if (r.task_name === ENGINE_TASK) engineByBike.set(r.bike_id, r)
  // ประมาณการวันที่น้ำมันเครื่องจะครบ (ใช้กับรายเดือนที่เช่าต่อเนื่อง): วันเช่าสะสมที่เหลือ / เพดานปฏิทิน อันไหนก่อน — กม. ประมาณไม่ได้ (ระบบรู้เลขไมล์เฉพาะตอนมีรายการ)
  const forecastDaysOf = (r: Row | undefined): number | null => {
    if (!r) return null
    const c: number[] = []
    if (r.interval_rented_days != null) c.push(Math.max(0, Number(r.interval_rented_days) - Number(r.rented_days_accumulated ?? 0)))
    if (r.next_due_date) c.push(Math.max(0, daysTo(r.next_due_date)))
    return c.length ? Math.min(...c) : null
  }
  for (const doc of (docsRaw ?? []) as Row[]) {
    const bike = bikeById.get(doc.bike_id)
    if (!bike || !doc.expiry_date) continue
    const daysLeft = daysTo(doc.expiry_date)
    const expired = daysLeft < 0
    const dayLabel = expired ? `หมดอายุแล้ว ${-daysLeft} วัน` : daysLeft === 0 ? 'หมดอายุวันนี้' : `หมดอายุอีก ${daysLeft} วัน`
    const key = `doc:${doc.id}:${doc.expiry_date}`
    const age = bike.year ? ty - Number(bike.year) : null
    const notifyOnly = doc.doc_type === 'pob' || (age != null && age < inspectYears)
    if (notifyOnly) {
      if (daysLeft > pobLead) continue
      const label = doc.doc_type === 'pob' ? 'พ.ร.บ. — แจ้งเจ้าของให้ดำเนินการ' : `ภาษี (รถอายุ ${age} ปี ไม่ต้องนำเข้า) — แจ้งเจ้าของ`
      draftOf(bike.id).items.push(decorate(key, 'doc', label, dayLabel, expired ? 2 : 4, { notifyOwner: true }))
      continue
    }
    if (daysLeft > taxLead) continue
    const monthly = monthlyByBike.get(bike.id)
    const rental = rentalByBike.get(bike.id)
    const label = 'ต่อภาษี (ต้องนำรถเข้ามา)'
    const href = `/staff/docs?bikeId=${bike.id}`
    const d = draftOf(bike.id)
    if (monthly) {
      d.items.push(decorate(key, 'doc', label, dayLabel, expired ? 2 : 4))
      // นัดรวมกับน้ำมันเครื่อง: ยังไม่ถึงรอบแต่คาดว่าจะครบก่อนภาษีหมด (หรือภาษีหมดแล้วและครบภายใน taxExpiredWait วัน)
      const fc = forecastDaysOf(engineByBike.get(bike.id))
      const alreadyDue = d.items.some(i => i.type === 'routine' && i.label.startsWith(ENGINE_TASK))
      if (!alreadyDue && fc != null && fc > 0 && (expired ? fc <= taxExpiredWait : fc <= daysLeft)) {
        d.items.push(decorate(`info:${key}`, 'routine', 'น้ำมันเครื่อง — นัดทำพร้อมกัน', `คาดว่าครบอีก ~${fc} วัน (ประมาณจากวันเช่าสะสม)`, 5, { info: true }))
      }
    } else if (rental) {
      const endMs = new Date(rental.expected_end_datetime).getTime()
      if (endMs < nowMs) d.items.push(decorate(key, 'doc', label, dayLabel, 1))
      else if (endMs - nowMs <= waitDays * 86_400_000) d.items.push(decorate(key, 'doc', label, dayLabel, 7))
      else d.items.push(decorate(key, 'doc', label, dayLabel, expired ? 3 : 5))
    } else {
      d.items.push(decorate(key, 'doc', label, dayLabel, 6, { href }))
    }
  }

  // ── จัดเป็นการ์ดต่อคัน (คันเดียวแยกการ์ดตามกลุ่ม: ต้องทัก/แจ้ง · ทำเอง · รอรถกลับ) ──
  const cards: QuestCard[] = []
  const snoozedCards: QuestCard[] = []
  const groupOfUrgency = (u: number): QuestGroup => (u <= 5 ? 'chase' : u === 6 ? 'self' : 'wait')
  for (const d of Array.from(drafts.values())) {
    const bike = bikeById.get(d.bikeId)!
    const monthly = monthlyByBike.get(d.bikeId)
    const rental = rentalByBike.get(d.bikeId)
    const holder: QuestCard['holder'] = monthly ? 'monthly' : rental ? 'daily' : 'shop'
    const cust = one<Row>(monthly?.customers ?? rental?.customers)
    const base = {
      bikeId: d.bikeId, plate: bike.license_plate, bikeName: `${bike.brand ?? ''} ${bike.model ?? ''}`.trim(),
      holder, customer: cust?.name ?? null, phone: cust?.phone ?? null, expectedEnd: rental?.expected_end_datetime ?? null,
    }
    for (const group of ['chase', 'self', 'wait'] as QuestGroup[]) {
      const inGroup = d.items.filter(i => groupOfUrgency(i.urgency) === group)
      if (inGroup.length === 0) continue
      const real = inGroup.filter(i => !i.info)
      const visible = inGroup.filter(i => !(i.urgency <= 5 && !i.info && snoozedKey(i.key)))
      const hidden = real.filter(i => i.urgency <= 5 && snoozedKey(i.key))
      const visibleReal = visible.filter(i => !i.info)
      if (visibleReal.length === 0) { if (hidden.length) snoozedCards.push({ ...base, group, urgency: 5, ownerOnly: false, items: hidden }); continue }
      const items = visible.map(i => (group === 'self' && !i.href ? { ...i, href: `/staff/routine?bikeId=${d.bikeId}` } : i)).sort((a, b) => a.urgency - b.urgency)
      cards.push({
        ...base, group, urgency: Math.min(...visibleReal.map(i => i.urgency)),
        ownerOnly: group === 'chase' && visibleReal.every(i => i.notifyOwner === true), items,
      })
    }
  }
  const sortCards = (a: QuestCard, b: QuestCard) => a.urgency - b.urgency || a.plate.localeCompare(b.plate)
  const chase = cards.filter(c => c.group === 'chase').sort(sortCards)
  const self = cards.filter(c => c.group === 'self').sort(sortCards)
  const wait = cards.filter(c => c.group === 'wait').sort((a, b) => (a.expectedEnd ?? '').localeCompare(b.expectedEnd ?? ''))
  void routineWait

  // ── เควสประจำ ──
  const logs = (logsRaw ?? []) as Row[]
  const closeDone = (closeshopRaw ?? []).length > 0
  const fuelBikes = bikes.filter(b => b.status === 'available' && b.fuel_level != null && b.fuel_level < 8)
  const slotOrder: Record<QuestSlot, number> = { open: 0, day: 1, close: 2 }
  const fixed: FixedQuest[] = ((templatesRaw ?? []) as Row[])
    .filter(t => (!t.branch_ids || t.branch_ids.length === 0 || t.branch_ids.includes(ownBranchId)) && (!t.days_of_week || t.days_of_week.length === 0 || t.days_of_week.includes(dow)))
    .sort((a, b) => slotOrder[a.slot as QuestSlot] - slotOrder[b.slot as QuestSlot] || a.sort_order - b.sort_order)
    .map(t => {
      const tl = logs.filter(l => l.template_id === t.id)
      const subLabels: string[] = Array.isArray(t.sub_items) ? t.sub_items : []
      const subItems = subLabels.map(label => {
        const l = tl.find(x => x.sub_item === label)
        return { label, done: !!l, by: l?.staff_name ?? null, at: l?.done_at ?? null }
      })
      const main = tl.find(l => l.sub_item === '')
      let done = false
      let autoItems: FixedQuest['autoItems'] = []
      if (t.kind === 'simple') done = !!main
      else if (t.kind === 'checklist') done = subItems.length > 0 && subItems.every(s => s.done)
      else if (t.auto_source === 'fuel') {
        autoItems = fuelBikes.map(b => ({ id: b.id, plate: b.license_plate, detail: 'น้ำมันไม่เต็ม' }))
        done = autoItems.length === 0
      } else if (t.auto_source === 'closeshop') done = closeDone
      return {
        id: t.id, title: t.title, slot: t.slot, kind: t.kind,
        requirePhoto: !!t.require_photo, requireNote: !!t.require_note,
        linkUrl: t.link_url ?? null, linkLabel: t.link_label ?? null,
        done, doneBy: main?.staff_name ?? null, doneAt: main?.done_at ?? null, note: main?.note ?? null, photoUrl: main?.photo_url ?? null,
        subItems, autoSource: t.auto_source ?? null, autoItems,
        meta: t.link_url === '/staff/marketing' ? `รูปในคิวรอลง ${marketingCount ?? 0} รูป` : null,
      } satisfies FixedQuest
    })

  // ── คิวรายวัน (แท็บแยก) ──
  const returns: QueueRow[] = rentals
    .filter(r => { const e = new Date(r.expected_end_datetime).getTime(); return e >= dayStartMs && e < dayEndMs })
    .map(r => ({
      id: r.id, plate: bikeById.get(r.bike_id)?.license_plate ?? '', customer: one<Row>(r.customers)?.name ?? '',
      time: new Date(r.expected_end_datetime).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }),
      detail: new Date(r.expected_end_datetime).getTime() < nowMs ? 'เลยเวลาแล้ว' : 'รอรับคืน',
    }))
    .sort((a, b) => a.time.localeCompare(b.time))
  const sends: QueueRow[] = ((bookingsRaw ?? []) as Row[]).map(b => ({
    id: b.id, plate: one<Row>(b.bikes)?.license_plate ?? `${b.requested_brand ?? ''} ${b.requested_model ?? ''}`.trim(), customer: b.customer_name ?? '',
    time: new Date(b.start_datetime).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }),
    detail: `คิว ${b.booking_ref ?? ''}`.trim(),
  })).sort((a, b) => a.time.localeCompare(b.time))

  // ── ความคืบหน้า: งานติดตาม (ที่ยังอยู่ + ที่ทักวันนี้ไปแล้วแม้งานจบ) + เควสประจำ ──
  const scopeBikeIds = new Set(bikes.map(b => b.id as string))
  const chaseTypes = new Set(['return', 'pay', 'routine', 'doc'])
  const doneKeys = new Set<string>()
  for (const f of (followupsRaw ?? []) as Row[]) if (f.quest_date === today && chaseTypes.has(f.item_type) && (!f.bike_id || scopeBikeIds.has(f.bike_id))) doneKeys.add(f.item_key)
  const chaseKeys = new Set<string>()
  for (const c of chase) for (const i of c.items) if (!i.info) chaseKeys.add(i.key)
  const totalKeys = new Set(Array.from(chaseKeys).concat(Array.from(doneKeys)))
  const fixedDone = fixed.filter(f => f.done).length
  const progress = { done: fixedDone + doneKeys.size, total: fixed.length + totalKeys.size }

  return {
    enabled: true, date: today, branchId: ownBranchId, waitDays,
    fixed, chase, self, wait, snoozed: snoozedCards,
    queue: { returns, sends, returnsDone: (returnedTodayRaw ?? []).length, sendsDone: (startedTodayRaw ?? []).length },
    progress,
  }
}
