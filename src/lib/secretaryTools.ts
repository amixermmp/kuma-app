// เครื่องมือค้นหา "เลขา" สำหรับเจ้าของ — อ่านอย่างเดียว (select เท่านั้น) ไม่มีคำสั่งเขียน/ลบ
// รับ supabase client เข้ามา (service role) ไม่ import อะไรจากแอปเพื่อให้ทดสอบแยกได้

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any

const BKK_MS = 7 * 3600_000
const DAY_MS = 86_400_000

export const todayBkk = (nowMs = Date.now()) => new Date(nowMs + BKK_MS).toISOString().slice(0, 10)
export const dayStartIso = (d: string) => new Date(`${d}T00:00:00+07:00`).toISOString()
export const nextDayStartIso = (d: string) => new Date(new Date(`${d}T00:00:00+07:00`).getTime() + DAY_MS).toISOString()
export const fmtBkk = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null
export const daysLeft = (iso: string | null | undefined, nowMs = Date.now()) =>
  iso ? Math.round((new Date(iso).getTime() - nowMs) / DAY_MS * 10) / 10 : null

// เลขาอ่านข้อมูลธุรกิจได้ทั้งหมด (เจ้าของคนเดียวในกลุ่ม) ยกเว้น "กุญแจเข้าระบบ": โทเค็นไลน์/กุญแจ API/รหัสผ่าน/hash/PIN พนักงาน
// — ไม่ส่งให้ AI และห้ามใช้เป็นตัวกรอง/เรียง (กันเดาค่าด้วยการกรอง)
const CREDENTIAL = /(token|secret|password|passcode|api_?key|hash|^pin$|_pin$|^pin_)/i
export const isCredentialName = (name: string) => CREDENTIAL.test(String(name))

// รูปในที่เก็บไฟล์ของระบบ → แทนด้วยรหัสสั้น "[รูป:bucket/path]" (ประหยัดโทเค็น และไม่หลุดลิงก์เซ็นชื่อ) ส่งเข้าไลน์ได้ด้วยเครื่องมือ send_photos
const STORAGE_URL = /\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/?]+)\/([^?]+)/
export function photoHandle(url: string): string | null {
  const m = STORAGE_URL.exec(url)
  if (!m) return null
  let path = m[2]
  try { path = decodeURIComponent(path) } catch { /* ใช้ตามเดิม */ }
  return `[รูป:${m[1]}/${path}]`
}

export function cleanRow(row: any): any {
  if (Array.isArray(row)) return row.map(cleanRow)
  if (typeof row === 'string') {
    if (row.startsWith('data:')) return '[ไฟล์ภาพฝังในข้อมูล (เช่นลายเซ็น) ไม่แสดงในแชท]'
    if (/^https?:\/\//.test(row)) return photoHandle(row) ?? (row.length > 600 ? row.slice(0, 600) + '…' : row)
    return row.length > 300 ? row.slice(0, 300) + '…' : row
  }
  if (!row || typeof row !== 'object') return row
  const out: any = {}
  for (const [k, v] of Object.entries(row)) {
    if (CREDENTIAL.test(k)) continue
    out[k] = cleanRow(v)
  }
  return out
}

// ตัวห่อฐานข้อมูล "อ่านอย่างเดียว" — ปฏิเสธ insert/update/upsert/delete/rpc และการเขียนไฟล์ ทุกกรณี (ชั้นป้องกันที่สองต่อจากการไม่มีเครื่องมือเขียน)
const WRITE_METHODS = new Set(['insert', 'update', 'upsert', 'delete'])
const STORAGE_READ_METHODS = new Set(['createSignedUrl', 'createSignedUrls', 'getPublicUrl'])
const denyWrite = () => { throw new Error('เลขาอ่านข้อมูลได้อย่างเดียว ห้ามเพิ่ม/แก้ไข/ลบ') }
export function readOnlyDb(db: Db): Db {
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'from') {
        return (table: string) => new Proxy(target.from(table), {
          get(qb, p) {
            if (WRITE_METHODS.has(String(p))) return denyWrite
            const v = qb[p]
            return typeof v === 'function' ? v.bind(qb) : v
          },
        })
      }
      if (prop === 'rpc') return denyWrite
      if (prop === 'storage') {
        return {
          from: (bucket: string) => new Proxy(target.storage.from(bucket), {
            get(b, p) {
              if (!STORAGE_READ_METHODS.has(String(p))) return denyWrite
              return (b[p] as (...a: unknown[]) => unknown).bind(b)
            },
          }),
        }
      }
      const v = target[prop]
      return typeof v === 'function' ? v.bind(target) : v
    },
  })
}

// ตัดผลลัพธ์ไม่ให้ยาวเกินไปสำหรับ AI
export function clip(result: unknown, max = 14000): string {
  const s = JSON.stringify(result)
  return s.length > max ? s.slice(0, max) + '…(ตัดเพราะยาวเกิน ให้ค้นให้แคบลง)' : s
}

// ทุกตารางอ่านได้ (ตรวจแค่ว่าชื่อเป็นชื่อตารางปกติ — ตารางที่ไม่มีจริง ฐานข้อมูลจะตอบ error เอง)
const TABLE_NAME = /^[a-z][a-z0-9_]{0,62}$/
const badTable = (table: string) => (TABLE_NAME.test(table) ? null : { error: `ชื่อตารางไม่ถูกต้อง "${table}" (ใช้ list_tables ดูรายชื่อตาราง)` })
export const assertTableName = badTable

// รายชื่อตาราง+คอลัมน์ทั้งหมด อ่านจากสคีมาของฐานข้อมูล (แคช 10 นาที)
let schemaCache: { at: number; defs: Record<string, { properties?: Record<string, { type?: string; format?: string }> }> } | null = null
async function loadSchema() {
  if (schemaCache && Date.now() - schemaCache.at < 600_000) return schemaCache.defs
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' })
  if (!res.ok) return null
  const defs = (await res.json()).definitions ?? {}
  schemaCache = { at: Date.now(), defs }
  return defs as NonNullable<typeof schemaCache>['defs']
}
export async function listTables() {
  const defs = await loadSchema()
  if (!defs) return { error: 'อ่านรายชื่อตารางไม่ได้ในตอนนี้' }
  return { count: Object.keys(defs).length, tables: Object.keys(defs).sort() }
}

export const normPlate = (s: string) => s.replace(/[\s\-.]/g, '').toLowerCase()

export async function branchNames(db: Db): Promise<Record<string, string>> {
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
type Filter = { column: string; op: string; value: any }

// ใส่ตัวกรองให้ query — คืน error ถ้ากรองด้วยคอลัมน์รหัสลับ/ตัวกรองผิดรูป
function applyFilters(q: any, filters: Filter[] | undefined): { q: any } | { error: string } {
  for (const f of filters ?? []) {
    if (!/^[\w.]+$/.test(String(f.column)) || !(OPS as readonly string[]).includes(f.op)) return { error: `ตัวกรองไม่ถูกต้อง: ${f.column} ${f.op}` }
    if (isCredentialName(f.column)) return { error: `ไม่อนุญาตให้กรองด้วยคอลัมน์รหัสลับ "${f.column}"` }
    q = f.op === 'in' ? q.in(f.column, Array.isArray(f.value) ? f.value : [f.value]) : f.op === 'is' ? q.is(f.column, f.value === 'null' ? null : f.value) : q[f.op](f.column, f.value)
  }
  return { q }
}

export async function queryTable(db: Db, args: { table: string; select?: string; filters?: Filter[]; order_by?: string; ascending?: boolean; limit?: number }) {
  const table = String(args.table ?? '')
  const bad = badTable(table)
  if (bad) return bad
  const select = args.select && /^[\w\s,*().:!>-]+$/.test(args.select) ? args.select : '*'
  if (select !== '*' && /(token|secret|password|passcode|api_?key|hash|\bpin\b)/i.test(select)) return { error: 'ไม่อนุญาตให้เลือกคอลัมน์รหัสลับ' }
  const f = applyFilters(db.from(table).select(select), args.filters)
  if ('error' in f) return f
  let q = f.q
  if (args.order_by && /^[\w.]+$/.test(args.order_by) && !isCredentialName(args.order_by)) q = q.order(args.order_by, { ascending: args.ascending !== false })
  const limit = Math.min(Math.max(Number(args.limit) || 30, 1), 100)
  const { data, error } = await q.limit(limit)
  if (error) return { error: error.message }
  return { table, rows: cleanRow(data ?? []), row_count: data?.length ?? 0 }
}

export async function describeTable(db: Db, table: string) {
  const bad = badTable(String(table ?? ''))
  if (bad) return bad
  const defs = await loadSchema()
  const props = defs?.[table]?.properties
  const { data, error } = await db.from(table).select('*').limit(1)
  if (error) return { error: error.message }
  const visible = (c: string) => !CREDENTIAL.test(c)
  const columns = props
    ? Object.entries(props).filter(([c]) => visible(c)).map(([c, p]) => `${c} (${p.format ?? p.type ?? '?'})`)
    : Object.keys(cleanRow(data?.[0] ?? {}))
  return { table, columns, sample: cleanRow(data?.[0] ?? {}) }
}

// ── รวมยอด/นับ/เฉลี่ย/จัดกลุ่ม ฝั่งเซิร์ฟเวอร์ (ไล่อ่านทีละ 1,000 แถว สูงสุด 50,000 แถว) ──
// group_by: "คอลัมน์" หรือ "คอลัมน์:day|month|year" (วันที่/เวลา แปลงเป็นเวลาไทยก่อนจัดกลุ่ม)
const METRIC_OPS = ['count', 'sum', 'avg', 'min', 'max', 'count_distinct'] as const
const AGG_MAX_ROWS = 50_000
function bucketValue(v: any, unit?: string): string {
  if (v == null || v === '') return 'ไม่ระบุ'
  if (!unit) return String(v)
  let s = String(v)
  if (s.includes('T') || s.includes(' ')) { const t = new Date(s).getTime(); if (!Number.isNaN(t)) s = new Date(t + BKK_MS).toISOString() }
  return s.slice(0, unit === 'year' ? 4 : unit === 'month' ? 7 : 10)
}
export async function aggregateTable(db: Db, args: { table: string; filters?: Filter[]; group_by?: string[]; metrics?: { op: string; column?: string; as?: string }[]; order_by?: string; ascending?: boolean; limit?: number }) {
  const table = String(args.table ?? '')
  const bad = badTable(table)
  if (bad) return bad
  const groups = (args.group_by ?? []).map(g => { const [col, unit] = String(g).split(':'); return { col, unit, key: String(g) } })
  for (const g of groups) {
    if (!/^\w+$/.test(g.col) || (g.unit && !['day', 'month', 'year'].includes(g.unit))) return { error: `group_by ไม่ถูกต้อง: ${g.key}` }
    if (isCredentialName(g.col)) return { error: `ไม่อนุญาตให้จัดกลุ่มด้วยคอลัมน์รหัสลับ "${g.col}"` }
  }
  const metrics = (args.metrics?.length ? args.metrics : [{ op: 'count' }]).map((m, i) => ({ op: String(m.op), column: m.column, as: m.as && /^\w+$/.test(m.as) ? m.as : `${m.op}${m.column ? '_' + m.column : ''}` || `m${i}` }))
  for (const m of metrics) {
    if (!(METRIC_OPS as readonly string[]).includes(m.op)) return { error: `metric ไม่ถูกต้อง: ${m.op}` }
    if (m.op !== 'count' && !m.column) return { error: `metric ${m.op} ต้องระบุ column` }
    if (m.column && (!/^\w+$/.test(m.column) || isCredentialName(m.column))) return { error: `column ไม่ถูกต้อง: ${m.column}` }
  }
  const cols = Array.from(new Set([...groups.map(g => g.col), ...metrics.filter(m => m.column).map(m => m.column!)]))

  // นับอย่างเดียวไม่จัดกลุ่ม → ใช้ count จากฐานข้อมูลตรงๆ (เร็ว ไม่จำกัด 50,000)
  if (groups.length === 0 && metrics.every(m => m.op === 'count' && !m.column)) {
    const f = applyFilters(db.from(table).select('*', { count: 'exact', head: true }), args.filters)
    if ('error' in f) return f
    const { count, error } = await f.q
    if (error) return { error: error.message }
    return { table, rows: [Object.fromEntries(metrics.map(m => [m.as, count ?? 0]))], rows_scanned: count ?? 0 }
  }

  const select = cols.length ? cols.join(',') : '*'
  type Stat = { sum: number; n: number; nMin: number | null; nMax: number | null; sMin: string | null; sMax: string | null; set: Set<string> }
  const acc = new Map<string, { g: Record<string, string>; n: number; st: Record<string, Stat> }>()
  let scanned = 0
  let truncated = false
  let orderCol = 'id' // เรียงตาม id ให้การแบ่งหน้าคงที่ ตารางที่ไม่มี id ใช้คอลัมน์แรกแทน
  for (let off = 0; ; off += 1000) {
    if (off >= AGG_MAX_ROWS) { truncated = true; break }
    const f = applyFilters(db.from(table).select(select), args.filters)
    if ('error' in f) return f
    let res = await f.q.range(off, off + 999).order(orderCol)
    if (res.error && orderCol === 'id') {
      orderCol = cols[0] ?? 'id'
      const f2 = applyFilters(db.from(table).select(select), args.filters)
      if ('error' in f2) return f2
      res = await f2.q.range(off, off + 999).order(orderCol)
    }
    if (res.error) return { error: res.error.message }
    const data: any[] = res.data ?? []
    for (const r of data) {
      scanned++
      const g: Record<string, string> = {}
      for (const x of groups) g[x.key] = bucketValue(r[x.col], x.unit)
      const k = JSON.stringify(g)
      let a = acc.get(k)
      if (!a) { a = { g, n: 0, st: {} }; acc.set(k, a) }
      a.n++
      for (const m of metrics) {
        if (!m.column) continue
        const s = (a.st[m.as] ??= { sum: 0, n: 0, nMin: null, nMax: null, sMin: null, sMax: null, set: new Set() })
        const v = r[m.column]
        if (v == null) continue
        s.n++
        if (m.op === 'count_distinct') s.set.add(String(v))
        const num = typeof v === 'number' ? v : Number(v)
        if (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(num) && !/^\d{4}-\d{2}-\d{2}/.test(v))) {
          s.sum += num
          s.nMin = s.nMin == null ? num : Math.min(s.nMin, num)
          s.nMax = s.nMax == null ? num : Math.max(s.nMax, num)
        } else {
          const str = String(v)
          s.sMin = s.sMin == null || str < s.sMin ? str : s.sMin
          s.sMax = s.sMax == null || str > s.sMax ? str : s.sMax
        }
      }
    }
    if (data.length < 1000) break
  }
  const round = (n: number) => Math.round(n * 100) / 100
  const rows = Array.from(acc.values()).map(a => {
    const out: Record<string, any> = { ...a.g }
    for (const m of metrics) {
      const s = a.st[m.as]
      out[m.as] = m.op === 'count' ? (m.column ? s?.n ?? 0 : a.n)
        : !s ? null
        : m.op === 'sum' ? round(s.sum)
        : m.op === 'avg' ? (s.nMin == null ? null : round(s.sum / Math.max(1, s.n)))
        : m.op === 'count_distinct' ? s.set.size
        : m.op === 'min' ? (s.nMin ?? s.sMin)
        : (s.nMax ?? s.sMax)
    }
    return out
  })
  const orderKey = args.order_by && (metrics.some(m => m.as === args.order_by) || groups.some(g => g.key === args.order_by)) ? args.order_by : (groups.length ? metrics[0].as : undefined)
  if (orderKey) {
    const asc = args.ascending === true || (args.ascending === undefined && groups.some(g => g.key === orderKey))
    rows.sort((a, b) => (a[orderKey] > b[orderKey] ? 1 : a[orderKey] < b[orderKey] ? -1 : 0) * (asc ? 1 : -1))
  }
  const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 100)
  return { table, group_count: rows.length, rows: cleanRow(rows.slice(0, limit)), rows_scanned: scanned, ...(truncated ? { warning: `อ่านได้สูงสุด ${AGG_MAX_ROWS} แถว ผลอาจไม่ครบ ให้เพิ่มตัวกรอง` } : {}) }
}
