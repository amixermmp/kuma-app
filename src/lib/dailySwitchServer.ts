// ตัวดึงข้อมูลสำหรับสลับสัญญารายเดือน → รายวัน (ฝั่งเซิร์ฟเวอร์) — ใช้ทั้งหน้าสลับและ API ให้ตัวเลข/เงื่อนไขตรงกันเสมอ
import { getPromoPayDays } from '@/lib/bikeCatalog'
import { isThaiIdNumber } from '@/lib/customer'
import { diffDays } from '@/lib/monthlySettlement'
import { loadMonthlySettlement } from '@/lib/monthlySettlementServer'

const REQUIRED_PHOTOS = ['id_card', 'selfie', 'with_bike', 'damage'] as const

const bkk = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3_600_000).toISOString()
const thDate = (d: string) =>
  new Date(`${d}T00:00:00+07:00`).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' })

// รูปสัญญารายเดือนเก็บเป็นรายการ [{label,url}] → รายวันเก็บเป็นออบเจ็กต์ {label: url}
export function photosToMap(photos: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (Array.isArray(photos)) {
    for (const p of photos) if (p && typeof p === 'object' && p.label && p.url) out[String(p.label)] = String(p.url)
  } else if (photos && typeof photos === 'object') {
    for (const [k, v] of Object.entries(photos as Record<string, unknown>)) if (typeof v === 'string' && v) out[k] = v
  }
  return out
}

export type SwitchContext = {
  monthlyId: string
  branchId: string
  bikeId: string
  customerId: string
  customer: { name: string; phone: string }
  isThaiId: boolean
  bike: { plate: string; brand: string; model: string; branchId: string; odometer: number; baseDailyRate: number }
  today: string
  dealStart: string | null
  lateDays: number
  blockReason: string | null
  pickupDefault: string | null
  promoPayDays: number
  heldDeposit: { amount: number; method: 'cash' | 'id_card' }
  hasAccommodationProof: boolean
  hasStudentIdPhoto: boolean
  photos: Record<string, string>
  student: { eligible: boolean; discountPerDay: number; university: string | null }
  rollback: { sendPhotosRaw: unknown; notes: string | null; endDate: string | null }
  signature: string | null
  swapLog: unknown[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadSwitchContext(supabase: any, monthlyId: string): Promise<SwitchContext | null> {
  const base = await loadMonthlySettlement(supabase, monthlyId)
  if (!base) return null
  const { rental, customer, currentBike, settlement: s, depositCash, today } = base

  const { data: extra } = await supabase
    .from('monthly_rentals')
    .select('branch_id, send_photos, customer_signature, pickup_time, created_at')
    .eq('id', monthlyId)
    .single()
  if (!extra) return null

  const photos = photosToMap(extra.send_photos)
  const missing = REQUIRED_PHOTOS.filter(k => !photos[k])

  const fmtRate = (n: number) => `฿${Math.round(n).toLocaleString()}`
  let blockReason: string | null = null
  if (!s.hasPeriod) blockReason = 'ไม่พบรายการรับค่าเช่าของสัญญานี้ — ทักหาพี่เจ้าของร้าน'
  else if (s.futurePaid > 0) blockReason = 'จ่ายค่าเช่าล่วงหน้าไว้แล้ว — ยังไม่ถึงวันครบดีล'
  else if (!s.reachedEnd) blockReason = `ยังไม่ถึงวันครบดีล (ครบ ${s.periodEnd ? thDate(s.periodEnd) : '-'}) — สลับเป็นรายวันได้ตั้งแต่วันครบดีลเป็นต้นไป`
  else if (s.paidCurrent < s.contractRate) blockReason = `งวดล่าสุดยังจ่ายไม่ครบ (ค้าง ${fmtRate(s.contractRate - s.paidCurrent)}) — เก็บให้ครบก่อนสลับ`
  else if (missing.length > 0) blockReason = `รูปในสัญญาเดิมไม่ครบ (ขาด ${missing.join(', ')}) — ทักหาพี่เจ้าของร้าน`

  const dealStart = s.periodEnd && s.reachedEnd ? s.periodEnd : null
  const lateDays = dealStart ? Math.max(0, diffDays(dealStart, today)) : 0

  // เวลารับรถ: ที่เก็บไว้ในสัญญา > เวลาที่สร้างสัญญา (ถ้าสร้างวันเดียวกับวันเริ่ม) > ว่าง (พนักงานกรอกเอง)
  let pickupDefault: string | null = null
  if (extra.pickup_time) pickupDefault = String(extra.pickup_time).slice(0, 5)
  else if (extra.created_at && bkk(extra.created_at).slice(0, 10) === rental.start_date) pickupDefault = bkk(extra.created_at).slice(11, 16)

  const bike = {
    plate: currentBike.license_plate as string,
    brand: currentBike.brand as string,
    model: currentBike.model as string,
    branchId: (currentBike.branch_id ?? extra.branch_id) as string,
    odometer: Number(currentBike.odometer) || 0,
    baseDailyRate: Number(currentBike.daily_rate) || 0,
  }
  const promoPayDays = await getPromoPayDays(supabase, bike.brand, bike.model, bike.branchId)

  // โปรราคานักศึกษา — เจ้าของตั้งว่าสาขา/รุ่นไหนร่วม และลดกี่บาท/วัน (เกณฑ์เดียวกับหน้าส่งรถ)
  const [{ data: promos }, { data: branchSettings }] = await Promise.all([
    supabase.from('promotions').select('discount_value, branch_ids, eligible_models, is_student_promo')
      .eq('is_active', true).eq('is_student_promo', true).order('created_at', { ascending: true }).limit(1),
    supabase.from('branch_settings').select('student_promo_university').eq('branch_id', bike.branchId).maybeSingle(),
  ])
  const cfg = promos?.[0] as { discount_value: number; branch_ids: string[] | null; eligible_models: { brand: string; model: string }[] | null } | undefined
  const eligible = !!cfg &&
    (!cfg.branch_ids || cfg.branch_ids.length === 0 || cfg.branch_ids.includes(bike.branchId)) &&
    (!cfg.eligible_models || cfg.eligible_models.length === 0 || cfg.eligible_models.some(m => m.brand === bike.brand && m.model === bike.model))

  return {
    monthlyId,
    branchId: (extra.branch_id ?? bike.branchId) as string,
    bikeId: rental.bike_id as string,
    customerId: rental.customer_id as string,
    customer: { name: customer?.name ?? '', phone: customer?.phone ?? '' },
    isThaiId: isThaiIdNumber(customer?.id_card_number ?? ''),
    bike,
    today,
    dealStart,
    lateDays,
    blockReason,
    pickupDefault,
    promoPayDays,
    heldDeposit: { amount: depositCash, method: rental.deposit_method === 'id_card' ? 'id_card' : 'cash' },
    hasAccommodationProof: !!photos.accommodation_proof,
    hasStudentIdPhoto: !!photos.student_id_card,
    photos,
    student: { eligible, discountPerDay: Number(cfg?.discount_value) || 0, university: branchSettings?.student_promo_university ?? null },
    rollback: { sendPhotosRaw: extra.send_photos, notes: rental.notes ?? null, endDate: rental.end_date ?? null },
    signature: extra.customer_signature ?? null,
    swapLog: Array.isArray(rental.swap_log) ? rental.swap_log : [],
  }
}
