// เครื่องมือค้นหา "เลขา" สำหรับเจ้าของ — อ่านอย่างเดียว (select เท่านั้น) ไม่มีคำสั่งเขียน/ลบ
// รับ supabase client เข้ามา (service role) ไม่ import อะไรจากแอปเพื่อให้ทดสอบแยกได้

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any

const BKK_MS = 7 * 3600_000
const DAY_MS = 86_400_000

export const todayBkk = (nowMs = Date.now()) => new Date(nowMs + BKK_MS).toISOString().slice(0, 10)
const dayStartIso = (d: string) => new Date(`${d}T00:00:00+07:00`).toISOString()
const nextDayStartIso = (d: string) => new Date(new Date(`${d}T00:00:00+07:00`).getTime() + DAY_MS).toISOString()
const fmtBkk = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null
const daysLeft = (iso: string | null | undefined, nowMs = Date.now()) =>
  iso ? Math.round((new Date(iso).getTime() - nowMs) / DAY_MS * 10) / 10 : null

// ห้ามส่งค่าลับ/รูป/ลายเซ็นให้ AI — ตัดคอลัมน์ที่ชื่อเข้าข่ายออก และตัดข้อความยาวๆ
const SENSITIVE = /(token|secret|password|passcode|pin_|_pin|^pin|signature|photo|api_key|hash|line_user_id)/i
export function cleanRow(row: any): any {
  if (Array.isArray(row)) return row.map(cleanRow)
  if (!row || typeof row !== 'object') return row
  const out: any = {}
  for (const [k, v] of Object.entries(row)) {
    if (SENSITIVE.test(k)) continue
    out[k] = typeof v === 'string' && v.length > 300 ? v.slice(0, 300) + '…' : cleanRow(v)
  }
  return out
}

// ตัดผลลัพธ์ไม่ให้ยาวเกินไปสำหรับ AI
export function clip(result: unknown, max = 14000): string {
  const s = JSON.stringify(result)
  return s.length > max ? s.slice(0, max) + '…(ตัดเพราะยาวเกิน ให้ค้นให้แคบลง)' : s
}

export const QUERYABLE_TABLES = [
  'rentals', 'monthly_rentals', 'rental_payments', 'monthly_payments', 'bikes', 'customers', 'bookings',
  'repairs', 'bike_routines', 'expenses', 'bike_documents', 'staff', 'branches', 'branch_model_pricing',
  'blacklist', 'activity_logs', 'staff_closeshops', 'staff_checkins', 'branch_settings', 'shop_settings',
] as const

const normPlate = (s: string) => s.replace(/[\s\-.]/g, '').toLowerCase()

async function branchNames(db: Db): Promise<Record<string, string>> {
  const { data } = await db.from('branches').select('id, name')
  return Object.fromEntries((data ?? []).map((b: any) => [b.id, b.name]))
}

// ── ค้นรถจากทะเบียน (หรือเลขท้าย) → ใครเช่าอยู่ กำหนดคืน สถานะ ซ่อม จอง รูทีน ──
export async function findBike(db: Db, query: string) {
  const q = normPlate(String(query ?? ''))
  if (!q) return { error: 'ไม่ได้ระบุทะเบียน' }
  const { data: bikes } = await db.from('bikes').select('id, license_plate, brand, model, color, status, odometer, branch_id')
  const matches = (bikes ?? []).filter((b: any) => normPlate(b.license_plate).includes(q))
  if (matches.length === 0) return { found: 0, message: `ไม่พบรถที่ทะเบียนตรงกับ "${query}"` }
  if (matches.length > 6) {
    return { found: matches.length, message: 'ตรงหลายคัน ให้ถามเจ้าของว่าคันไหน', plates: matches.slice(0, 15).map((b: any) => `${b.license_plate} (${b.brand} ${b.model})`) }
  }
  const branches = await branchNames(db)
  const nowIso = new Date().toISOString()
  const results = []
  for (const b of matches) {
    const [{ data: rentals }, { data: monthly }, { data: repairs }, { data: bookings }, { data: routines }, { data: last }] = await Promise.all([
      db.from('rentals').select('id, status, start_datetime, expected_end_datetime, daily_rate, total_amount, paid_amount, deposit_amount, notes, customers(name, phone), branch_id')
        .eq('bike_id', b.id).in('status', ['active', 'extended', 'overdue']),
      db.from('monthly_rentals').select('id, status, start_date, payment_day, monthly_rate, deposit_amount, customers(name, phone), branch_id')
        .eq('bike_id', b.id).eq('status', 'active'),
      db.from('repairs').select('id, title, description, status, location_type, created_at').eq('bike_id', b.id).eq('status', 'in_progress'),
      db.from('bookings').select('booking_ref, customer_name, customer_phone, start_datetime, end_datetime, status').eq('bike_id', b.id).gte('end_datetime', nowIso).neq('status', 'cancelled').order('start_datetime').limit(3),
      db.from('bike_routines').select('task_name, last_done_date, last_done_km, next_due_date, next_due_km, interval_rented_days, rented_days_accumulated').eq('bike_id', b.id),
      db.from('rentals').select('start_datetime, actual_end_datetime, customers(name)').eq('bike_id', b.id).eq('status', 'returned').order('actual_end_datetime', { ascending: false }).limit(1),
    ])
    results.push(cleanRow({
      plate: b.license_plate, bike: `${b.brand} ${b.model}${b.color ? ' ' + b.color : ''}`, status: b.status, odometer: b.odometer,
      branch: branches[b.branch_id] ?? null,
      daily_rentals_now: (rentals ?? []).map((r: any) => ({
        customer: r.customers?.name, phone: r.customers?.phone, status: r.status,
        start: fmtBkk(r.start_datetime), due: fmtBkk(r.expected_end_datetime), days_left: daysLeft(r.expected_end_datetime),
        overdue: new Date(r.expected_end_datetime).getTime() < Date.now(), daily_rate: r.daily_rate,
        total_amount: r.total_amount, paid_amount: r.paid_amount, deposit: r.deposit_amount, branch: branches[r.branch_id] ?? null, notes: r.notes,
      })),
      monthly_rentals_now: (monthly ?? []).map((r: any) => ({
        customer: r.customers?.name, phone: r.customers?.phone, start_date: r.start_date, payment_day: r.payment_day,
        monthly_rate: r.monthly_rate, deposit: r.deposit_amount, branch: branches[r.branch_id] ?? null,
      })),
      open_repairs: repairs ?? [],
      upcoming_bookings: (bookings ?? []).map((x: any) => ({ ref: x.booking_ref, customer: x.customer_name, phone: x.customer_phone, from: fmtBkk(x.start_datetime), to: fmtBkk(x.end_datetime), status: x.status })),
      routines: routines ?? [],
      last_returned: last?.[0] ? { customer: last[0].customers?.name, returned: fmtBkk(last[0].actual_end_datetime) } : null,
    }))
  }
  return { found: matches.length, bikes: results }
}

// ── ค้นลูกค้าจากชื่อ/เบอร์ → สัญญาที่ใช้อยู่ ──
export async function findCustomer(db: Db, query: string) {
  const q = String(query ?? '').trim()
  if (!q) return { error: 'ไม่ได้ระบุชื่อหรือเบอร์' }
  const digits = q.replace(/\D/g, '')
  let req = db.from('customers').select('id, name, phone').limit(8)
  req = digits.length >= 4 ? req.or(`phone.ilike.%${digits}%,name.ilike.%${q}%`) : req.ilike('name', `%${q}%`)
  const { data: customers } = await req
  if (!customers?.length) return { found: 0, message: `ไม่พบลูกค้าที่ตรงกับ "${query}"` }
  const branches = await branchNames(db)
  const out = []
  for (const c of customers) {
    const [{ data: daily }, { data: monthly }, { count }] = await Promise.all([
      db.from('rentals').select('status, start_datetime, expected_end_datetime, total_amount, bikes(license_plate, brand, model), branch_id').eq('customer_id', c.id).in('status', ['active', 'extended', 'overdue']),
      db.from('monthly_rentals').select('status, start_date, payment_day, monthly_rate, bikes(license_plate, brand, model), branch_id').eq('customer_id', c.id).eq('status', 'active'),
      db.from('rentals').select('id', { count: 'exact', head: true }).eq('customer_id', c.id),
    ])
    out.push(cleanRow({
      name: c.name, phone: c.phone, total_daily_rentals_ever: count ?? 0,
      active_daily: (daily ?? []).map((r: any) => ({ bike: `${r.bikes?.license_plate} ${r.bikes?.brand} ${r.bikes?.model}`, status: r.status, start: fmtBkk(r.start_datetime), due: fmtBkk(r.expected_end_datetime), days_left: daysLeft(r.expected_end_datetime), branch: branches[r.branch_id] ?? null })),
      active_monthly: (monthly ?? []).map((r: any) => ({ bike: `${r.bikes?.license_plate} ${r.bikes?.brand} ${r.bikes?.model}`, start_date: r.start_date, payment_day: r.payment_day, monthly_rate: r.monthly_rate, branch: branches[r.branch_id] ?? null })),
    }))
  }
  return { found: customers.length, customers: out }
}

// ── รายได้ตามกฎบัญชีของร้าน: ใบเสร็จค่าเช่ารายวัน (rental_payments) + รายเดือน (monthly_payments) ตามวันที่เก็บจริง
//    ไม่นับใบที่ยกเลิก, ไม่นับยอดจอง/มัดจำ, ไม่ใช้ rentals.total_amount ──
export async function revenue(db: Db, from: string, to: string, branch?: string) {
  const f = String(from ?? '').slice(0, 10), t = String(to ?? from ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return { error: 'วันที่ต้องเป็นรูปแบบ YYYY-MM-DD (เวลาไทย)' }
  const branches = await branchNames(db)
  const branchId = branch ? Object.entries(branches).find(([, n]) => n.includes(branch))?.[0] : undefined
  if (branch && !branchId) return { error: `ไม่พบสาขาที่ชื่อมีคำว่า "${branch}"`, branches: Object.values(branches) }

  const startIso = dayStartIso(f), endIso = nextDayStartIso(t)
  let daily: any[] = [], monthly: any[] = []
  for (let off = 0; ; off += 1000) {
    let q = db.from('rental_payments').select('kind, amount, branch_id, paid_at').is('voided_at', null).gte('paid_at', startIso).lt('paid_at', endIso).range(off, off + 999)
    if (branchId) q = q.eq('branch_id', branchId)
    const { data } = await q
    daily = daily.concat(data ?? [])
    if ((data?.length ?? 0) < 1000) break
  }
  for (let off = 0; ; off += 1000) {
    const { data } = await db.from('monthly_payments').select('amount, paid_date, monthly_rentals(branch_id)').is('voided_at', null).gte('paid_date', f).lte('paid_date', t).range(off, off + 999)
    monthly = monthly.concat((data ?? []).filter((m: any) => !branchId || m.monthly_rentals?.branch_id === branchId))
    if ((data?.length ?? 0) < 1000) break
  }
  const byBranch: Record<string, { daily_rental: number; extend: number; overtime_and_fees: number; refunds: number; monthly: number; total: number }> = {}
  const slot = (id: string) => (byBranch[branches[id] ?? id ?? 'ไม่ระบุสาขา'] ??= { daily_rental: 0, extend: 0, overtime_and_fees: 0, refunds: 0, monthly: 0, total: 0 })
  for (const p of daily) {
    const s = slot(p.branch_id), a = Number(p.amount ?? 0)
    if (p.kind === 'rental') s.daily_rental += a
    else if (p.kind === 'extend') s.extend += a
    else if (p.kind === 'early_return_refund') s.refunds += a
    else s.overtime_and_fees += a
    s.total += a
  }
  for (const m of monthly) { const s = slot(m.monthly_rentals?.branch_id), a = Number(m.amount ?? 0); s.monthly += a; s.total += a }
  const total = Object.values(byBranch).reduce((x, b) => x + b.total, 0)
  return { period: `${f} ถึง ${t}`, branch: branch ?? 'ทุกสาขา', total, by_branch: byBranch, counts: { daily_payments: daily.length, monthly_payments: monthly.length }, note: 'นับจากใบเสร็จที่ไม่ถูกยกเลิก ตามวันที่เก็บเงินจริง ไม่รวมมัดจำ/ยอดจอง' }
}

// ── สัญญาที่ใช้อยู่ตอนนี้ (รายวัน/สัปดาห์ + รายเดือน) เรียงตามกำหนดคืน เลยกำหนดขึ้นก่อน ──
export async function listActiveRentals(db: Db, branch?: string, overdueOnly = false) {
  const branches = await branchNames(db)
  const branchId = branch ? Object.entries(branches).find(([, n]) => n.includes(branch))?.[0] : undefined
  let dq = db.from('rentals').select('status, start_datetime, expected_end_datetime, customers(name, phone), bikes(license_plate, brand, model), branch_id').in('status', ['active', 'extended', 'overdue']).order('expected_end_datetime')
  if (branchId) dq = dq.eq('branch_id', branchId)
  const { data: daily } = await dq
  const now = Date.now()
  const dailyRows = (daily ?? []).map((r: any) => ({
    plate: r.bikes?.license_plate, bike: `${r.bikes?.brand} ${r.bikes?.model}`, customer: r.customers?.name, phone: r.customers?.phone,
    due: fmtBkk(r.expected_end_datetime), days_left: daysLeft(r.expected_end_datetime, now), overdue: new Date(r.expected_end_datetime).getTime() < now, branch: branches[r.branch_id] ?? null,
  })).filter((r: any) => !overdueOnly || r.overdue)
  let monthlyRows: any[] = []
  if (!overdueOnly) {
    let mq = db.from('monthly_rentals').select('start_date, payment_day, monthly_rate, customers(name, phone), bikes(license_plate, brand, model), branch_id').eq('status', 'active')
    if (branchId) mq = mq.eq('branch_id', branchId)
    const { data: monthly } = await mq
    monthlyRows = (monthly ?? []).map((r: any) => ({ plate: r.bikes?.license_plate, bike: `${r.bikes?.brand} ${r.bikes?.model}`, customer: r.customers?.name, phone: r.customers?.phone, start_date: r.start_date, payment_day: r.payment_day, monthly_rate: r.monthly_rate, branch: branches[r.branch_id] ?? null }))
  }
  return cleanRow({ branch: branch ?? 'ทุกสาขา', daily_count: dailyRows.length, daily: dailyRows.slice(0, 60), monthly_count: monthlyRows.length, monthly: monthlyRows.slice(0, 80) })
}

// ── ค้นตารางทั่วไป (อ่านอย่างเดียว) สำหรับคำถามที่ไม่มีเครื่องมือเฉพาะ ──
const OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in'] as const
export async function queryTable(db: Db, args: { table: string; select?: string; filters?: { column: string; op: string; value: any }[]; order_by?: string; ascending?: boolean; limit?: number }) {
  const table = String(args.table ?? '')
  if (!(QUERYABLE_TABLES as readonly string[]).includes(table)) return { error: `ไม่อนุญาตให้ค้นตาราง "${table}"`, allowed: QUERYABLE_TABLES }
  let q = db.from(table).select(args.select && /^[\w\s,*().:!>-]+$/.test(args.select) ? args.select : '*')
  for (const f of args.filters ?? []) {
    if (!/^[\w.]+$/.test(String(f.column)) || !(OPS as readonly string[]).includes(f.op)) return { error: `ตัวกรองไม่ถูกต้อง: ${f.column} ${f.op}` }
    q = f.op === 'in' ? q.in(f.column, Array.isArray(f.value) ? f.value : [f.value]) : f.op === 'is' ? q.is(f.column, f.value === 'null' ? null : f.value) : (q as any)[f.op](f.column, f.value)
  }
  if (args.order_by && /^[\w.]+$/.test(args.order_by)) q = q.order(args.order_by, { ascending: args.ascending !== false })
  const limit = Math.min(Math.max(Number(args.limit) || 30, 1), 100)
  const { data, error } = await q.limit(limit)
  if (error) return { error: error.message }
  return { table, rows: cleanRow(data ?? []), row_count: data?.length ?? 0 }
}

export async function describeTable(db: Db, table: string) {
  if (!(QUERYABLE_TABLES as readonly string[]).includes(table)) return { error: `ไม่อนุญาตให้ดูตาราง "${table}"`, allowed: QUERYABLE_TABLES }
  const { data, error } = await db.from(table).select('*').limit(1)
  if (error) return { error: error.message }
  return { table, columns: Object.keys(cleanRow(data?.[0] ?? {})), sample: cleanRow(data?.[0] ?? {}) }
}
