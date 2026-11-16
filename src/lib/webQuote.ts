import { calcRentQuote } from '@/lib/pricing'

// คำนวณราคาให้เว็บหน้าร้าน (เช่น zamebikerental.com) — ใช้สูตรเดียวกับหน้าส่งรถ (lib/pricing.ts) เสมอ
// เว็บไม่คำนวณเอง: ส่งแค่ รุ่น + วัน + โซน มา แล้วได้ตัวเลขกลับไป กันราคาบนเว็บไม่ตรงกับสัญญาจริง

export const FREE_DELIVERY_MIN_DAYS = 90 // เช่า 3 เดือนขึ้นไป ส่ง-รับฟรี (ทั่วชลบุรี)
export const LONG_RENTAL_MIN_DAYS = 30 // ตั้งแต่ 30 วัน = ราคารายเดือน (ตรงกับ calcRentQuote)
export const MAX_RENTAL_DAYS = 400
export const MAX_ADVANCE_DAYS = 365

// มัดจำตามเงื่อนไขหน้าส่งรถ: เช่า 7 วันขึ้นไป/รายเดือน = 1,000 (เงินสด/โอน) / เช่าสั้น = 500 (ไม่ต้องวางถ้ามีหลักฐานที่พัก หรือวางบัตรประชาชนแทน)
export function webDeposit(totalDays: number) {
  const long = totalDays >= 7
  return {
    amount: long ? 1000 : 500,
    waivable_with_accommodation_proof: !long,
    id_card_alternative: !long,
  }
}

export type DeliveryZone = {
  id: string
  name_th: string
  name_en: string
  name_ja: string | null
  name_zh: string | null
  short_fee: number | null
  long_fee: number | null
}

export type LegInput = { type: 'shop' | 'delivery'; zone_id?: string | null }
export type LegResult = {
  type: 'shop' | 'delivery'
  zone_id: string | null
  zone_name_th: string | null
  fee: number | null // null = ยังไม่รู้ (ต้องสอบถามพนักงาน)
}

export type WebQuote = {
  days: number
  is_long: boolean
  rent_total: number
  months: { days: number; price: number }[]
  remain_days: number
  remain_price: number
  rates: { daily: number; monthly: number }
  delivery: {
    free: boolean
    send: LegResult
    return: LegResult
    total: number | null // null = มีขาที่ยังไม่รู้ค่าส่ง
    unknown: boolean
  }
  deposit: ReturnType<typeof webDeposit>
  grand_total: number | null // ค่าเช่า + ค่าส่ง (null ถ้าค่าส่งยังไม่รู้)
}

export type QuoteError =
  | 'invalid_dates'
  | 'too_long'
  | 'too_far_ahead'
  | 'model_not_found'
  | 'no_price'
  | 'zone_required'
  | 'zone_not_found'
  | 'zone_not_served'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function parseDateOnly(s: unknown): Date | null {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null
}

export function bangkokToday(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date()) // YYYY-MM-DD
  return parseDateOnly(parts) as Date
}

// ราคามาตรฐานต่อ (สาขา, รุ่น) — ตั้งไว้ใน branch_model_pricing เท่านั้น (ถ้าไม่ได้ตั้งราคารายวัน = ไม่ขายบนเว็บ)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getWebModelRates(admin: any, branchId: string, brand: string, model: string) {
  const { data } = await admin
    .from('branch_model_pricing')
    .select('daily_rate, monthly_rate, promo_pay_days')
    .eq('branch_id', branchId).eq('brand', brand).eq('model', model)
    .maybeSingle()
  if (!data || data.daily_rate == null || Number(data.daily_rate) <= 0) return null
  const daily = Number(data.daily_rate)
  return {
    daily,
    monthly: data.monthly_rate != null && Number(data.monthly_rate) > 0 ? Number(data.monthly_rate) : daily * 30,
    payDays: data.promo_pay_days ?? 5,
  }
}

// รุ่นนี้ต้องมีรถจริงในสาขา (ไม่นับรถที่ปลดระวาง/ปิดใช้งาน — รถที่แค่ซ่อมอยู่ยังนับ) ถึงจะขายบนเว็บ
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function branchHasModel(admin: any, branchId: string, brand: string, model: string): Promise<boolean> {
  const { count } = await admin
    .from('bikes').select('id', { count: 'exact', head: true })
    .eq('branch_id', branchId).eq('brand', brand).eq('model', model)
    .not('status', 'in', `(${['retired', 'inactive'].join(',')})`)
  return (count ?? 0) > 0
}

function resolveLeg(
  leg: LegInput | undefined,
  zones: DeliveryZone[],
  isLong: boolean,
  free: boolean,
): LegResult | { error: QuoteError } {
  if (!leg || leg.type !== 'delivery') return { type: 'shop', zone_id: null, zone_name_th: null, fee: 0 }
  if (!leg.zone_id) return { error: 'zone_required' }
  const zone = zones.find(z => z.id === leg.zone_id)
  if (!zone) return { error: 'zone_not_found' }
  const base = isLong ? zone.long_fee : zone.short_fee
  // เช่าสั้น: โซนที่ไม่ตั้งค่าส่งแบบสั้น = ไม่ให้บริการ / เช่ายาว: ไม่ตั้ง = ยังไม่รู้ ให้สอบถาม (เว้นแต่ฟรี 3 เดือน)
  if (!isLong && base == null) return { error: 'zone_not_served' }
  return { type: 'delivery', zone_id: zone.id, zone_name_th: zone.name_th, fee: free ? 0 : (base == null ? null : Number(base)) }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadZones(admin: any, branchId: string): Promise<DeliveryZone[]> {
  const { data } = await admin
    .from('delivery_zones')
    .select('id, name_th, name_en, name_ja, name_zh, short_fee, long_fee')
    .eq('branch_id', branchId).eq('active', true)
    .order('sort_order').order('created_at')
  return (data ?? []).map((z: DeliveryZone) => ({
    ...z,
    short_fee: z.short_fee == null ? null : Number(z.short_fee),
    long_fee: z.long_fee == null ? null : Number(z.long_fee),
  }))
}

export type QuoteInput = {
  branchId: string
  brand: string
  model: string
  startDate: unknown
  endDate: unknown
  send?: LegInput
  ret?: LegInput
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildWebQuote(admin: any, input: QuoteInput): Promise<{ quote: WebQuote; startDate: string; endDate: string } | { error: QuoteError }> {
  const start = parseDateOnly(input.startDate)
  const end = parseDateOnly(input.endDate)
  if (!start || !end) return { error: 'invalid_dates' }

  const today = bangkokToday()
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000)
  if (start < today || days < 1) return { error: 'invalid_dates' }
  if (days > MAX_RENTAL_DAYS) return { error: 'too_long' }
  if (Math.round((start.getTime() - today.getTime()) / 86_400_000) > MAX_ADVANCE_DAYS) return { error: 'too_far_ahead' }

  if (!(await branchHasModel(admin, input.branchId, input.brand, input.model))) return { error: 'model_not_found' }
  const rates = await getWebModelRates(admin, input.branchId, input.brand, input.model)
  if (!rates) return { error: 'no_price' }

  const rent = calcRentQuote(start, days, rates.daily, rates.monthly, rates.payDays)
  const isLong = rent.isLong
  const free = days >= FREE_DELIVERY_MIN_DAYS

  const zones = await loadZones(admin, input.branchId)
  const send = resolveLeg(input.send, zones, isLong, free)
  if ('error' in send) return { error: send.error }
  const ret = resolveLeg(input.ret, zones, isLong, free)
  if ('error' in ret) return { error: ret.error }

  const unknown = send.fee == null || ret.fee == null
  const deliveryTotal = unknown ? null : (send.fee ?? 0) + (ret.fee ?? 0)

  const quote: WebQuote = {
    days,
    is_long: isLong,
    rent_total: rent.total,
    months: (rent.longResult?.months ?? []).map(m => ({ days: m.days, price: m.price })),
    remain_days: rent.longResult?.remainDays ?? days,
    remain_price: rent.longResult?.remainPrice ?? rent.shortResult?.total ?? 0,
    rates: { daily: rates.daily, monthly: rates.monthly },
    delivery: { free, send, return: ret, total: deliveryTotal, unknown },
    deposit: webDeposit(days),
    grand_total: deliveryTotal == null ? null : rent.total + deliveryTotal,
  }
  return { quote, startDate: input.startDate as string, endDate: input.endDate as string }
}

// ราคา "เริ่มต้น" สำหรับการ์ดรุ่น: รายวัน / รายสัปดาห์ (7 วันจ่ายตามโปร เพดานรายเดือน) / รายเดือน
export function startingPrices(rates: { daily: number; monthly: number; payDays: number }) {
  const weekly = Math.min(rates.payDays * rates.daily, rates.monthly)
  return { daily: rates.daily, weekly, monthly: rates.monthly }
}
