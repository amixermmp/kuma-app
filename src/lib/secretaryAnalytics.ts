// เครื่องมือวิเคราะห์ของ "เลขา" — อ่านอย่างเดียว (select เท่านั้น) คำนวณฝั่งเซิร์ฟเวอร์ให้ตัวเลขตรงกับแดชบอร์ด
// รับ db ที่ห่อด้วย readOnlyDb แล้ว (ปฏิเสธการเขียนทุกชนิด)

import { branchNames, cleanRow, dayStartIso, nextDayStartIso, fmtBkk, daysLeft, normPlate, todayBkk } from '@/lib/secretaryTools'
import { getBikeIdAtDate } from '@/lib/swapHistory'
import { getBikeLifetimeRevenue } from '@/lib/bikeRevenue'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any

const DAY_MS = 86_400_000
const BKK_MS = 7 * 3600_000
const ACTIVE = ['active', 'extended', 'overdue']
const one = (v: any) => (Array.isArray(v) ? v[0] : v)
const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d
const bkkDate = (iso: string) => new Date(new Date(iso).getTime() + BKK_MS).toISOString().slice(0, 10)

// อ่านทั้งตาราง/ผลค้นทีละ 1,000 แถว (เรียงตาม id ให้แบ่งหน้าคงที่)
async function fetchAll(make: () => any, max = 30_000): Promise<any[]> {
  let rows: any[] = []
  for (let off = 0; off < max; off += 1000) {
    const { data, error } = await make().range(off, off + 999).order('id')
    if (error) throw new Error(error.message)
    rows = rows.concat(data ?? [])
    if ((data?.length ?? 0) < 1000) break
  }
  return rows
}

async function resolveBranch(db: Db, branch?: string) {
  const branches = await branchNames(db)
  if (!branch) return { branches, branchId: undefined as string | undefined }
  const branchId = Object.entries(branches).find(([, n]) => n.includes(branch))?.[0]
  if (!branchId) return { branches, error: { error: `ไม่พบสาขาที่ชื่อมีคำว่า "${branch}"`, branches: Object.values(branches) } }
  return { branches, branchId }
}

// ── 1) สรุปจำนวนรถต่อสาขา: ทั้งหมด / ว่าง / เช่ารายวัน / ติดรายเดือน / ซ่อม / ล็อก ──
// ลำดับตัดสิน: ปลดระวาง > ซ่อม/บำรุง > ล็อก > ติดรายเดือน > เช่ารายวัน/สัปดาห์ > ว่าง
export async function fleetSummary(db: Db, branch?: string, byModel = false) {
  const r = await resolveBranch(db, branch)
  if ('error' in r) return r.error
  const { branches, branchId } = r
  const [bikes, daily, monthly] = await Promise.all([
    fetchAll(() => { let q = db.from('bikes').select('id, branch_id, brand, model, status'); if (branchId) q = q.eq('branch_id', branchId); return q }),
    fetchAll(() => { let q = db.from('rentals').select('id, bike_id').in('status', ACTIVE); if (branchId) q = q.eq('branch_id', branchId); return q }),
    fetchAll(() => { let q = db.from('monthly_rentals').select('id, bike_id').eq('status', 'active'); if (branchId) q = q.eq('branch_id', branchId); return q }),
  ])
  const dailySet = new Set(daily.map(x => x.bike_id)), monthlySet = new Set(monthly.map(x => x.bike_id))
  const classOf = (b: any) =>
    b.status === 'retired' || b.status === 'inactive' ? 'ปลดระวาง/ปิดใช้งาน'
    : b.status === 'repair' || b.status === 'maintenance' ? 'ซ่อม/บำรุง'
    : b.status === 'locked' ? 'ล็อก'
    : monthlySet.has(b.id) ? 'ติดรายเดือน'
    : dailySet.has(b.id) ? 'เช่ารายวัน/สัปดาห์'
    : 'ว่าง'
  const out: Record<string, any> = {}
  for (const b of bikes) {
    const name = branches[b.branch_id] ?? 'ไม่ระบุสาขา'
    const s = (out[name] ??= { total: 0, ว่าง: 0, 'เช่ารายวัน/สัปดาห์': 0, ติดรายเดือน: 0, 'ซ่อม/บำรุง': 0, ล็อก: 0, 'ปลดระวาง/ปิดใช้งาน': 0, ...(byModel ? { by_model: {} } : {}) })
    const c = classOf(b)
    s.total++; s[c]++
    if (byModel) { const m = (s.by_model[`${b.brand} ${b.model}`] ??= { total: 0, ว่าง: 0, 'เช่ารายวัน/สัปดาห์': 0, ติดรายเดือน: 0, 'ซ่อม/บำรุง': 0, ล็อก: 0, 'ปลดระวาง/ปิดใช้งาน': 0 }); m.total++; m[c]++ }
  }
  return { as_of: todayBkk(), branch: branch ?? 'ทุกสาขา', by_branch: out, note: 'ว่าง = ไม่มีสัญญารายวัน/รายเดือนที่ใช้งานอยู่ และไม่ซ่อม/ล็อก (ยังไม่นับคิวจองล่วงหน้า)' }
}

// ── 2) ผลงานรถรายคัน/รายรุ่น ในช่วงเวลา: รายได้ (เงินสดตามวันเก็บจริง ตรงกับแดชบอร์ด) + อัตราใช้รถ ──
export async function bikePerformance(db: Db, args: { from?: string; to?: string; branch?: string; plate?: string; sort?: string; top?: number }) {
  const r = await resolveBranch(db, args.branch)
  if ('error' in r) return r.error
  const { branches, branchId } = r
  const today = todayBkk()
  const to = (args.to ?? today).slice(0, 10)
  const from = (args.from ?? new Date(new Date(`${to}T00:00:00+07:00`).getTime() - 29 * DAY_MS + BKK_MS).toISOString().slice(0, 10)).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return { error: 'ช่วงวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD และวันเริ่มไม่เกินวันสิ้นสุด)' }
  const startIso = dayStartIso(from), endIso = nextDayStartIso(to)
  const startMs = new Date(startIso).getTime(), endMs = new Date(endIso).getTime()
  const windowDays = (endMs - startMs) / DAY_MS
  const nowMs = Date.now()
  const overlap = (s: number, e: number, ws: number, we: number) => Math.max(0, Math.min(e, we) - Math.max(s, ws)) / DAY_MS

  const plateQ = args.plate ? normPlate(args.plate) : ''
  let bikes = await fetchAll(() => { let q = db.from('bikes').select('id, branch_id, brand, model, license_plate, status, created_at'); if (branchId) q = q.eq('branch_id', branchId); return q })
  bikes = bikes.filter(b => b.status !== 'retired' && b.status !== 'inactive' && (!plateQ || normPlate(b.license_plate).includes(plateQ)))

  const [rpay, mpay, rentals, monthly] = await Promise.all([
    fetchAll(() => db.from('rental_payments').select('id, amount, paid_at, rentals(bike_id, swap_log)').is('voided_at', null).gte('paid_at', startIso).lt('paid_at', endIso)),
    fetchAll(() => db.from('monthly_payments').select('id, amount, paid_date, monthly_rentals(bike_id, swap_log)').in('status', ['paid', 'partial']).is('voided_at', null).gte('paid_date', from).lte('paid_date', to)),
    fetchAll(() => db.from('rentals').select('id, bike_id, start_datetime, expected_end_datetime, actual_end_datetime, status').neq('status', 'cancelled').lt('start_datetime', endIso).or(`actual_end_datetime.is.null,actual_end_datetime.gte.${startIso}`)),
    fetchAll(() => db.from('monthly_rentals').select('id, bike_id, start_date, end_date, status').neq('status', 'cancelled').lte('start_date', to).or(`end_date.is.null,end_date.gte.${from}`)),
  ])

  const revenue = new Map<string, number>(), rentedDays = new Map<string, number>()
  const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v)
  for (const p of rpay) {
    const c = one(p.rentals); if (!c) continue
    add(revenue, getBikeIdAtDate(c.bike_id, c.swap_log, bkkDate(p.paid_at)), Number(p.amount ?? 0))
  }
  for (const p of mpay) {
    const c = one(p.monthly_rentals); if (!c) continue
    add(revenue, getBikeIdAtDate(c.bike_id, c.swap_log, String(p.paid_date).slice(0, 10)), Number(p.amount ?? 0))
  }
  for (const c of rentals) {
    const s = new Date(c.start_datetime).getTime()
    const e = c.actual_end_datetime ? new Date(c.actual_end_datetime).getTime() : ACTIVE.includes(c.status) ? Math.max(nowMs, new Date(c.expected_end_datetime).getTime()) : new Date(c.expected_end_datetime).getTime()
    add(rentedDays, c.bike_id, overlap(s, e, startMs, endMs))
  }
  for (const c of monthly) {
    const s = new Date(`${c.start_date}T00:00:00+07:00`).getTime()
    const e = c.status === 'active' || !c.end_date ? nowMs : new Date(`${c.end_date}T23:59:59+07:00`).getTime()
    add(rentedDays, c.bike_id, overlap(s, e, startMs, endMs))
  }

  const rows = bikes.map((b: any) => {
    const live = Math.max(0, endMs - Math.max(new Date(b.created_at).getTime(), startMs)) / DAY_MS
    const rev = revenue.get(b.id) ?? 0, days = Math.min(rentedDays.get(b.id) ?? 0, live)
    return {
      plate: b.license_plate, bike: `${b.brand} ${b.model}`, branch: branches[b.branch_id] ?? null, status: b.status,
      revenue: round(rev), rented_days: round(days, 1), days_in_system: round(live, 1),
      utilization_pct: live > 0 ? round((days / live) * 100) : null, revenue_per_30d: live > 0 ? round((rev / live) * 30) : null,
    }
  })

  const model: Record<string, { branch: string | null; model: string; bikes: number; revenue: number; days: number; live: number }> = {}
  for (const row of rows) {
    const k = `${row.branch}|${row.bike}`
    const m = (model[k] ??= { branch: row.branch, model: row.bike, bikes: 0, revenue: 0, days: 0, live: 0 })
    m.bikes++; m.revenue += row.revenue; m.days += row.rented_days; m.live += row.days_in_system
  }
  const byModel = Object.values(model).map(m => ({
    branch: m.branch, model: m.model, bikes: m.bikes, revenue: round(m.revenue),
    revenue_per_bike_per_30d: m.live > 0 ? round((m.revenue / m.live) * 30) : null,
    utilization_pct: m.live > 0 ? round((m.days / m.live) * 100) : null,
  })).sort((a, b) => (b.revenue_per_bike_per_30d ?? 0) - (a.revenue_per_bike_per_30d ?? 0))

  const sort = args.sort ?? 'revenue_desc'
  const keyOf = (x: any) => (sort.startsWith('util') ? x.utilization_pct ?? 0 : x.revenue)
  rows.sort((a: any, b: any) => (sort.endsWith('asc') ? keyOf(a) - keyOf(b) : keyOf(b) - keyOf(a)))
  const top = Math.min(Math.max(Number(args.top) || (plateQ ? 10 : 15), 1), 40)
  const total = rows.reduce((n: number, x: any) => n + x.revenue, 0)
  return {
    period: `${from} ถึง ${to} (${round(windowDays, 1)} วัน)`, branch: args.branch ?? 'ทุกสาขา', bikes_counted: rows.length,
    total_revenue: round(total), by_model: byModel.slice(0, 25), bikes: rows.slice(0, top), sorted_by: sort,
    note: 'รายได้ = เงินที่เก็บจริงตามวันเก็บ (ใบเสร็จรายวันทุกประเภท + รายเดือน ไม่รวมมัดจำ/จอง/ใบที่ยกเลิก) นับให้คันที่ผูกอยู่จริงตอนเก็บ อัตราใช้รถ = วันที่มีสัญญา ÷ วันที่รถอยู่ในระบบในช่วงนั้น (ไม่รวมช่วงซ่อม)',
  }
}

// ── 3) ประวัติรถทั้งคัน: สัญญา ซ่อม เอกสาร รูทีน รายได้สะสม ──
export async function bikeHistory(db: Db, query: string) {
  const q = normPlate(String(query ?? ''))
  if (!q) return { error: 'ไม่ได้ระบุทะเบียน' }
  const bikes = (await fetchAll(() => db.from('bikes').select('id, license_plate, brand, model, color, status, odometer, branch_id, created_at, daily_rate, monthly_rate, notes'))).filter(b => normPlate(b.license_plate).includes(q))
  if (bikes.length === 0) return { found: 0, message: `ไม่พบรถที่ทะเบียนตรงกับ "${query}"` }
  if (bikes.length > 3) return { found: bikes.length, message: 'ตรงหลายคัน ให้ระบุทะเบียนให้ชัดขึ้น', plates: bikes.slice(0, 15).map((b: any) => b.license_plate) }
  const branches = await branchNames(db)
  const out = []
  for (const b of bikes) {
    const [lifetime, { data: rentals }, { data: monthly }, { data: repairs }, { data: docs }, { data: routines }] = await Promise.all([
      getBikeLifetimeRevenue(db, b.id),
      db.from('rentals').select('start_datetime, expected_end_datetime, actual_end_datetime, status, total_amount, paid_amount, branch_id, customers(name)').eq('bike_id', b.id).order('start_datetime', { ascending: false }).limit(25),
      db.from('monthly_rentals').select('start_date, end_date, status, monthly_rate, customers(name)').eq('bike_id', b.id).order('start_date', { ascending: false }).limit(15),
      db.from('repairs').select('title, description, status, created_at, resolved_at, repair_shop, repair_cost, odometer').eq('bike_id', b.id).is('voided_at', null).order('created_at', { ascending: false }).limit(25),
      db.from('bike_documents').select('doc_type, expiry_date').eq('bike_id', b.id),
      db.from('bike_routines').select('task_name, last_done_date, last_done_km, next_due_date, next_due_km').eq('bike_id', b.id),
    ])
    const [{ count: rentalCount }, { count: repairCount }] = await Promise.all([
      db.from('rentals').select('id', { count: 'exact', head: true }).eq('bike_id', b.id),
      db.from('repairs').select('id', { count: 'exact', head: true }).eq('bike_id', b.id).is('voided_at', null),
    ])
    const ageDays = Math.floor((Date.now() - new Date(b.created_at).getTime()) / DAY_MS)
    out.push(cleanRow({
      plate: b.license_plate, bike: `${b.brand} ${b.model}${b.color ? ' ' + b.color : ''}`, status: b.status, odometer: b.odometer, branch: branches[b.branch_id] ?? null,
      in_system_since: bkkDate(b.created_at), days_in_system: ageDays, notes: b.notes,
      lifetime_revenue: round(lifetime), avg_revenue_per_month: round(lifetime / Math.max(1, ageDays / 30.44)),
      daily_rentals_total: rentalCount ?? 0, repairs_total: repairCount ?? 0,
      repair_cost_total_shown: round((repairs ?? []).reduce((n: number, x: any) => n + Number(x.repair_cost ?? 0), 0)),
      daily_rentals_recent: (rentals ?? []).map((x: any) => ({ customer: one(x.customers)?.name, from: fmtBkk(x.start_datetime), to: fmtBkk(x.actual_end_datetime ?? x.expected_end_datetime), status: x.status, total: x.total_amount, paid: x.paid_amount, branch: branches[x.branch_id] ?? null })),
      monthly_rentals: (monthly ?? []).map((x: any) => ({ customer: one(x.customers)?.name, from: x.start_date, to: x.end_date, status: x.status, rate: x.monthly_rate })),
      repairs_recent: repairs ?? [], documents: docs ?? [], routines: routines ?? [],
    }))
  }
  return { found: bikes.length, bikes: out }
}

// ── 4) ประวัติลูกค้า: ข้อมูลลูกค้า สัญญาทั้งหมด ยอดที่จ่ายรวม ──
export async function customerHistory(db: Db, query: string) {
  const qs = String(query ?? '').trim()
  if (!qs) return { error: 'ไม่ได้ระบุชื่อหรือเบอร์' }
  const digits = qs.replace(/\D/g, '')
  let req = db.from('customers').select('*').limit(6)
  req = digits.length >= 4 ? req.or(`phone.ilike.%${digits}%,name.ilike.%${qs}%`) : req.ilike('name', `%${qs}%`)
  const { data: customers } = await req
  if (!customers?.length) return { found: 0, message: `ไม่พบลูกค้าที่ตรงกับ "${query}"` }
  if (customers.length > 5) return { found: customers.length, message: 'ตรงหลายคน ให้ระบุชื่อเต็มหรือเบอร์', customers: customers.map((c: any) => `${c.name} ${c.phone ?? ''}`) }
  const branches = await branchNames(db)
  const out = []
  for (const c of customers) {
    const [{ data: rentals }, { data: monthly }] = await Promise.all([
      db.from('rentals').select('id, start_datetime, expected_end_datetime, actual_end_datetime, status, total_amount, paid_amount, branch_id, bikes(license_plate, brand, model)').eq('customer_id', c.id).order('start_datetime', { ascending: false }),
      db.from('monthly_rentals').select('id, start_date, end_date, status, monthly_rate, branch_id, bikes(license_plate, brand, model)').eq('customer_id', c.id).order('start_date', { ascending: false }),
    ])
    let paid = 0
    const rIds = (rentals ?? []).map((x: any) => x.id), mIds = (monthly ?? []).map((x: any) => x.id)
    for (let i = 0; i < rIds.length; i += 100) {
      const { data } = await db.from('rental_payments').select('amount').in('rental_id', rIds.slice(i, i + 100)).is('voided_at', null)
      paid += (data ?? []).reduce((n: number, p: any) => n + Number(p.amount ?? 0), 0)
    }
    for (let i = 0; i < mIds.length; i += 100) {
      const { data } = await db.from('monthly_payments').select('amount').in('monthly_rental_id', mIds.slice(i, i + 100)).in('status', ['paid', 'partial']).is('voided_at', null)
      paid += (data ?? []).reduce((n: number, p: any) => n + Number(p.amount ?? 0), 0)
    }
    const bikeOf = (x: any) => { const b = one(x.bikes); return b ? `${b.license_plate} ${b.brand} ${b.model}` : null }
    out.push(cleanRow({
      customer: c,
      daily_rentals_count: rentals?.length ?? 0, monthly_rentals_count: monthly?.length ?? 0, total_paid_all_time: round(paid),
      first_rental: (rentals ?? []).length ? fmtBkk(rentals![rentals!.length - 1].start_datetime) : null,
      daily_rentals_recent: (rentals ?? []).slice(0, 12).map((x: any) => ({ bike: bikeOf(x), from: fmtBkk(x.start_datetime), to: fmtBkk(x.actual_end_datetime ?? x.expected_end_datetime), status: x.status, total: x.total_amount, paid: x.paid_amount, branch: branches[x.branch_id] ?? null })),
      monthly_rentals: (monthly ?? []).slice(0, 10).map((x: any) => ({ bike: bikeOf(x), from: x.start_date, to: x.end_date, status: x.status, rate: x.monthly_rate, branch: branches[x.branch_id] ?? null })),
    }))
  }
  return { found: customers.length, customers: out }
}

// ── 5) งานที่ใกล้ครบกำหนด: เอกสารรถ (ภาษี/พ.ร.บ.) รูทีน สัญญารายเดือนใกล้จบ งานซ่อมที่ค้าง ──
export async function dueSoon(db: Db, days = 30, branch?: string) {
  const r = await resolveBranch(db, branch)
  if ('error' in r) return r.error
  const { branches, branchId } = r
  const horizon = Math.min(Math.max(Number(days) || 30, 1), 365)
  const today = todayBkk()
  const until = new Date(new Date(`${today}T00:00:00+07:00`).getTime() + horizon * DAY_MS + BKK_MS).toISOString().slice(0, 10)
  const inBranch = (bikeBranch: string | null) => !branchId || bikeBranch === branchId

  const [docs, routines, monthly, repairs] = await Promise.all([
    fetchAll(() => db.from('bike_documents').select('id, doc_type, expiry_date, bikes(license_plate, brand, model, branch_id, status)').not('expiry_date', 'is', null).lte('expiry_date', until)),
    fetchAll(() => db.from('bike_routines').select('id, task_name, next_due_date, next_due_km, interval_rented_days, rented_days_accumulated, bikes(license_plate, brand, model, odometer, branch_id, status)')),
    fetchAll(() => { let q = db.from('monthly_rentals').select('id, start_date, end_date, monthly_rate, branch_id, customers(name, phone), bikes(license_plate, brand, model)').eq('status', 'active').not('end_date', 'is', null).lte('end_date', until); if (branchId) q = q.eq('branch_id', branchId); return q }),
    fetchAll(() => db.from('repairs').select('id, title, status, created_at, bikes(license_plate, brand, model, branch_id)').eq('status', 'in_progress').is('voided_at', null)),
  ])
  const live = (b: any) => b && b.status !== 'retired' && b.status !== 'inactive'
  const plate = (b: any) => `${b.license_plate} ${b.brand} ${b.model}`

  const documents = docs.filter(d => live(one(d.bikes)) && inBranch(one(d.bikes).branch_id))
    .map(d => ({ bike: plate(one(d.bikes)), doc: d.doc_type, expiry: d.expiry_date, days_left: round((new Date(`${d.expiry_date}T00:00:00+07:00`).getTime() - new Date(`${today}T00:00:00+07:00`).getTime()) / DAY_MS), branch: branches[one(d.bikes).branch_id] ?? null }))
    .sort((a, b) => a.days_left - b.days_left)

  const due = []
  for (const x of routines) {
    const b = one(x.bikes); if (!live(b) || !inBranch(b.branch_id)) continue
    const reasons: string[] = []
    if (x.next_due_km != null && Number(b.odometer ?? 0) >= Number(x.next_due_km)) reasons.push(`ถึงระยะ ${x.next_due_km} กม. (ปัจจุบัน ${b.odometer ?? '?'})`)
    if (x.next_due_date && x.next_due_date <= until) reasons.push(`ถึงกำหนดวันที่ ${x.next_due_date}`)
    if (x.interval_rented_days != null && Number(x.rented_days_accumulated ?? 0) >= Number(x.interval_rented_days)) reasons.push(`วันเช่าสะสมครบ ${x.rented_days_accumulated}/${x.interval_rented_days}`)
    if (reasons.length) due.push({ bike: plate(b), task: x.task_name, reasons: reasons.join(' · '), branch: branches[b.branch_id] ?? null })
  }

  return cleanRow({
    as_of: today, window_days: horizon, branch: branch ?? 'ทุกสาขา',
    documents_expiring_or_expired: { count: documents.length, items: documents.slice(0, 40) },
    routines_due: { count: due.length, items: due.slice(0, 40) },
    monthly_contracts_ending: { count: monthly.length, items: monthly.slice(0, 40).map((m: any) => ({ bike: plate(one(m.bikes)), customer: one(m.customers)?.name, phone: one(m.customers)?.phone, ends: m.end_date, days_left: daysLeft(`${m.end_date}T00:00:00+07:00`), rate: m.monthly_rate, branch: branches[m.branch_id] ?? null })) },
    open_repairs: { count: repairs.filter(x => inBranch(one(x.bikes)?.branch_id)).length, items: repairs.filter(x => inBranch(one(x.bikes)?.branch_id)).slice(0, 40).map((x: any) => ({ bike: plate(one(x.bikes)), title: x.title, open_days: Math.floor((Date.now() - new Date(x.created_at).getTime()) / DAY_MS) })) },
  })
}

// ── นิยามเครื่องมือส่งให้โมเดล ──
const S = { type: 'string' as const }
export const ANALYTICS_TOOLS = [
  { name: 'list_tables', description: 'ดูรายชื่อตารางทั้งหมดในระบบ (อ่านได้ทุกตาราง ยกเว้นคอลัมน์รหัสลับ) ใช้ก่อน describe_table เมื่อไม่รู้ว่าข้อมูลอยู่ตารางไหน',
    input_schema: { type: 'object' as const, properties: {} } },
  { name: 'aggregate_table', description: 'นับ/รวม/เฉลี่ย/ต่ำสุด/สูงสุด/จัดกลุ่ม ตารางใดก็ได้ ฝั่งเซิร์ฟเวอร์ (แม่นกว่าให้ query_table แล้วนับเอง) เช่น จำนวนรถแยกสถานะ, ค่าใช้จ่ายรวมแยกหมวดรายเดือน ใช้ describe_table ดูชื่อคอลัมน์ก่อนถ้าไม่แน่ใจ ข้อควรระวัง: เรื่องรายได้ให้ใช้ revenue/bike_performance (ใช้กติกาเงินสดจริง)',
    input_schema: { type: 'object' as const, properties: {
      table: S,
      filters: { type: 'array', items: { type: 'object', properties: { column: S, op: { type: 'string', enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in'] }, value: {} }, required: ['column', 'op', 'value'] } },
      group_by: { type: 'array', items: S, description: 'คอลัมน์ที่จัดกลุ่ม หรือ "คอลัมน์:day|month|year" สำหรับวันที่/เวลา เช่น "paid_at:month"' },
      metrics: { type: 'array', items: { type: 'object', properties: { op: { type: 'string', enum: ['count', 'sum', 'avg', 'min', 'max', 'count_distinct'] }, column: S, as: S }, required: ['op'] }, description: 'ไม่ใส่ = count' },
      order_by: { type: 'string', description: 'ชื่อ metric (as) หรือคอลัมน์ group' }, ascending: { type: 'boolean' }, limit: { type: 'number', description: 'ไม่เกิน 100' },
    }, required: ['table'] } },
  { name: 'fleet_summary', description: 'สรุปจำนวนรถต่อสาขา: ทั้งหมด / ว่าง / เช่ารายวัน-สัปดาห์ / ติดรายเดือน / ซ่อม / ล็อก ใช้ตอบ "สาขานี้มีรถกี่คัน ซ่อมกี่คัน ว่างกี่คัน"',
    input_schema: { type: 'object' as const, properties: { branch: { type: 'string', description: 'ชื่อสาขาบางส่วน (ไม่ใส่ = ทุกสาขา)' }, by_model: { type: 'boolean', description: 'true = แยกตามรุ่นด้วย' } } } },
  { name: 'bike_performance', description: 'ผลงานรถรายคัน/รายรุ่นในช่วงวันที่: รายได้ (เงินสดจริง ตรงแดชบอร์ด) อัตราใช้รถ รายได้ต่อคันต่อ 30 วัน ใช้ตอบ "รถรุ่นไหนทำเงินดี/คันไหนรายได้น้อย/อัตราใช้รถสาขาไหนเท่าไร" ไม่ใส่วันที่ = 30 วันล่าสุด',
    input_schema: { type: 'object' as const, properties: { from: { type: 'string', description: 'YYYY-MM-DD' }, to: { type: 'string', description: 'YYYY-MM-DD' }, branch: S, plate: { type: 'string', description: 'กรองทะเบียน (บางส่วน)' }, sort: { type: 'string', enum: ['revenue_desc', 'revenue_asc', 'util_desc', 'util_asc'] }, top: { type: 'number', description: 'จำนวนคันที่แสดง (ค่าเริ่มต้น 15 สูงสุด 40)' } } } },
  { name: 'bike_history', description: 'ประวัติรถทั้งคัน: รายได้สะสม เฉลี่ยต่อเดือน สัญญาที่ผ่านมา ประวัติซ่อมและค่าซ่อม เอกสาร รูทีน',
    input_schema: { type: 'object' as const, properties: { query: { type: 'string', description: 'ทะเบียนหรือเลขท้าย' } }, required: ['query'] } },
  { name: 'customer_history', description: 'ประวัติลูกค้า: ข้อมูลลูกค้าทั้งหมด จำนวนครั้งที่เช่า ยอดจ่ายรวมตลอดกาล สัญญาล่าสุด/รายเดือน',
    input_schema: { type: 'object' as const, properties: { query: { type: 'string', description: 'ชื่อหรือเบอร์ (อย่างน้อย 4 หลัก)' } }, required: ['query'] } },
  { name: 'due_soon', description: 'งานที่ใกล้ครบกำหนด/เลยกำหนด: ภาษี-พ.ร.บ.-เอกสารรถหมดอายุ, รูทีนซ่อมบำรุงที่ถึงรอบ, สัญญารายเดือนใกล้จบ, งานซ่อมที่ค้าง',
    input_schema: { type: 'object' as const, properties: { days: { type: 'number', description: 'มองล่วงหน้ากี่วัน (ค่าเริ่มต้น 30)' }, branch: S } } },
  { name: 'find_photos', description: 'หารูปของรถ (รูปรถ เอกสารรถ รูปตอนรับ/คืน รูปซ่อม) หรือของลูกค้า (บัตรประชาชน เซลฟี่ ถ่ายคู่รถ หลักฐานชำระเงิน ฯลฯ ในสัญญาล่าสุด) จากทะเบียนหรือชื่อ/เบอร์ลูกค้า คืนรายการรูปพร้อมรหัส ถ้าเจ้าของขอรูปให้เรียก send_photos ต่อ',
    input_schema: { type: 'object' as const, properties: { query: { type: 'string', description: 'ทะเบียน/เลขท้าย หรือชื่อ/เบอร์ลูกค้า' } }, required: ['query'] } },
  { name: 'send_photos', description: 'ส่งรูปเข้าแชทไลน์ ใส่รหัสรูป (handle รูปแบบ "[รูป:bucket/path]") ที่ได้จาก find_photos หรือผลค้นตารางอื่น ส่งเฉพาะรูปที่เจ้าของขอ ไม่เกิน 12 รูปต่อคำตอบ แล้วบอกเจ้าของสั้นๆ ว่าส่งรูปอะไร',
    input_schema: { type: 'object' as const, properties: { handles: { type: 'array', items: S, description: 'รหัสรูป เช่น "[รูป:rental-photo/abc/def.jpg]"' } }, required: ['handles'] } },
]
