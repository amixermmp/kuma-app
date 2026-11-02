// ตัวดึงข้อมูลสำหรับใบสรุปจบสัญญารายเดือน (ฝั่งเซิร์ฟเวอร์) — ใช้ทั้งหน้าจบสัญญาและ API เพื่อให้ตัวเลขตรงกันเสมอ
import { getPromoPayDays, resolveSingleBikeRate } from '@/lib/bikeCatalog'
import { computeSettlement, bangkokDateStr, type SwapEntry } from '@/lib/monthlySettlement'

const BIKE_COLS = 'id, license_plate, brand, model, branch_id, odometer, daily_rate, monthly_rate'

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadMonthlySettlement(supabase: any, monthlyRentalId: string, today: string = bangkokDateStr()) {
  const [{ data: rental }, { data: payments }] = await Promise.all([
    supabase
      .from('monthly_rentals')
      .select(`
        id, start_date, payment_day, monthly_rate, deposit_amount, deposit_method, status, swap_log,
        send_type, send_fee, bike_id, customer_id, created_at, return_photos, return_odometer, notes, end_date,
        bikes(${BIKE_COLS}),
        customers(id, name, phone, id_card_number)
      `)
      .eq('id', monthlyRentalId)
      .eq('status', 'active')
      .single(),
    supabase
      .from('monthly_payments')
      .select('due_date, amount, status')
      .eq('monthly_rental_id', monthlyRentalId)
      .is('voided_at', null)
      .in('status', ['paid', 'partial']),
  ])
  if (!rental) return null

  const bikeRow = one(rental.bikes)
  if (!bikeRow) return null
  const currentBike = await resolveSingleBikeRate(supabase, bikeRow)
  const customer = one(rental.customers)

  const swapLog: SwapEntry[] = Array.isArray(rental.swap_log) ? rental.swap_log : []

  // สัญญาที่วันครบดีลไม่ตรงวันเริ่ม: ถ้าแปลงมาจากรายวัน (มีสัญญารายวันสถานะ converted ของลูกค้า+รถคู่เดียวกันก่อนหน้า) นับจากวันดีลที่เลือก
  // ถ้าสร้างตรงๆ นับจากวันเริ่มสัญญาจริง — เช็คเฉพาะตอนจำเป็น (แถวจ่ายแรกไม่ตรงวันเริ่ม)
  const firstLabel = (payments ?? []).map((p: { due_date: string }) => p.due_date).sort()[0] as string | undefined
  let clampFirstStart = false
  if (firstLabel && firstLabel !== rental.start_date) {
    const { data: converted } = await supabase
      .from('rentals')
      .select('id')
      .eq('bike_id', rental.bike_id)
      .eq('customer_id', rental.customer_id)
      .eq('status', 'converted')
      .lte('start_datetime', rental.created_at)
      .limit(1)
    clampFirstStart = !(converted && converted.length > 0)
  }

  const common = {
    clampFirstStart,
    startDate: rental.start_date as string,
    paymentDay: (rental.payment_day as number | null) ?? null,
    today,
    payments: payments ?? [],
    currentMonthlyRate: Number(rental.monthly_rate),
    swapLog,
    // แถวจ่ายแรกรวมค่าส่งรถนอกสถานที่ไว้ด้วย (monthly/create: amount = ค่าเช่า + ค่าส่ง)
    firstPeriodExtra: rental.send_type === 'offsite' ? Number(rental.send_fee) || 0 : 0,
  }
  const currentDaily = Number(currentBike.daily_rate) || 0

  // รอบแรก: รู้ว่างวดปัจจุบันเริ่มวันไหน จะได้หาว่าตอนนั้นลูกค้าขี่คันไหน
  const currentPromo = await getPromoPayDays(supabase, currentBike.brand, currentBike.model, currentBike.branch_id ?? undefined)
  const first = computeSettlement({ ...common, formulaDailyRate: currentDaily, formulaPromoPayDays: currentPromo, currentDailyRate: currentDaily })

  // คันที่ขี่ตอนเริ่มงวด: สลับครั้งแรกในงวดนี้ → คันเดิม (from_bike_id) ไม่มีบันทึกคันเดิม/หาคันไม่เจอ → ใช้คันปัจจุบันและแจ้งบนจอ
  let formulaBike = currentBike
  let formulaSource: 'current' | 'previous' | 'previous_missing' = 'current'
  if (first.periodStart) {
    const swapInPeriod = swapLog
      .filter(e => e && e.date && e.date >= first.periodStart! && e.from_bike_id)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0]
    if (swapInPeriod) {
      const { data: oldBike } = await supabase.from('bikes').select(BIKE_COLS).eq('id', swapInPeriod.from_bike_id).maybeSingle()
      if (oldBike) {
        formulaBike = await resolveSingleBikeRate(supabase, oldBike)
        formulaSource = 'previous'
      } else {
        formulaSource = 'previous_missing'
      }
    }
  }
  const formulaPromo = formulaBike === currentBike
    ? currentPromo
    : await getPromoPayDays(supabase, formulaBike.brand, formulaBike.model, formulaBike.branch_id ?? undefined)

  const settlement = computeSettlement({
    ...common,
    formulaDailyRate: Number(formulaBike.daily_rate) || 0,
    formulaPromoPayDays: formulaPromo,
    currentDailyRate: currentDaily,
  })

  const totalCollected = (payments ?? []).reduce((s: number, p: { amount: number | string }) => s + Number(p.amount), 0)
  // มัดจำที่เป็นเงิน (วางบัตรแทนมัดจำ = ไม่มีเงินให้คืน)
  const depositCash = rental.deposit_method === 'id_card' ? 0 : Number(rental.deposit_amount) || 0

  return {
    rental,
    customer,
    currentBike,
    formulaBike: { plate: formulaBike.license_plate as string, dailyRate: Number(formulaBike.daily_rate) || 0, source: formulaSource },
    settlement,
    totalCollected,
    depositCash,
    today,
  }
}
