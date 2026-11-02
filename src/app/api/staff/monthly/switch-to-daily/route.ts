import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { logStaffAction } from '@/lib/log'
import { findModelBookingConflict } from '@/lib/bookingConflicts'
import { cleanAmount, diffDays } from '@/lib/monthlySettlement'
import { loadSwitchContext } from '@/lib/dailySwitchServer'
import { DAY_MS, minSwitchDays, quoteSwitch, requiredDeposit, switchStartMs, type SwitchPackage } from '@/lib/dailySwitch'

const PACKAGES: SwitchPackage[] = ['now', 'plus1', 'days', 'week']
const baht = (n: number) => `฿${Math.round(n).toLocaleString()}`

// สลับสัญญารายเดือน → รายวัน (ปิดสัญญาเดือนโดยไม่ปล่อยรถ แล้วเปิดสัญญารายวันต่อเนื่องคันเดิม ลูกค้าเดิม ย้ายเอกสารทั้งหมดไปด้วย)
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    monthlyRentalId, pickupTime, pkg, days, receivedDate, paymentMethod, slipUrl,
    isStudent, universityAffiliation, studentIdPhotoUrl, extraDeposit, confirmWaiveDeposit, overrideBookingConflict,
  } = body
  if (!monthlyRentalId) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const supabase = createAdminClient()
  const ctx = await loadSwitchContext(supabase, monthlyRentalId)
  if (!ctx) return NextResponse.json({ error: 'ไม่พบสัญญา หรือสัญญาสิ้นสุดแล้ว' }, { status: 404 })
  if (ctx.blockReason || !ctx.dealStart) return NextResponse.json({ error: ctx.blockReason ?? 'สลับเป็นรายวันไม่ได้' }, { status: 409 })

  // ── ตรวจข้อมูลที่พนักงานกรอก ───────────────────────────────────────────────
  if (typeof pickupTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(pickupTime)) {
    return NextResponse.json({ error: 'กรุณาใส่เวลารับรถ (เวลาที่ลูกค้ารับรถไปตอนแรก) เช่น 12:00' }, { status: 400 })
  }
  if (!PACKAGES.includes(pkg)) return NextResponse.json({ error: 'กรุณาเลือกแพ็กเกจ' }, { status: 400 })
  if (paymentMethod !== 'cash' && paymentMethod !== 'transfer') return NextResponse.json({ error: 'กรุณาเลือกวิธีรับเงิน (เงินสด/โอน)' }, { status: 400 })
  if (paymentMethod === 'cash' && ctx.isThaiId) return NextResponse.json({ error: 'บัตรประชาชนไทย — จ่ายเงินสดไม่ได้ ต้องโอนเงินเท่านั้น' }, { status: 400 })
  if (typeof slipUrl !== 'string' || !slipUrl) return NextResponse.json({ error: 'กรุณาแนบสลิป/หลักฐานการชำระเงินของรอบนี้' }, { status: 400 })

  const nowMs = Date.now()
  const today = ctx.today
  const received = typeof receivedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(receivedDate) ? receivedDate : today
  if (received > today) return NextResponse.json({ error: 'วันที่รับเงินเป็นวันในอนาคตไม่ได้' }, { status: 400 })
  if (diffDays(received, today) > 45) return NextResponse.json({ error: 'วันที่รับเงินย้อนหลังเกิน 45 วัน — ตรวจวันที่อีกครั้ง' }, { status: 400 })
  const paidAt = received === today ? new Date(nowMs).toISOString() : new Date(`${received}T12:00:00+07:00`).toISOString()

  // ── ราคา (คิดฝั่งเซิร์ฟเวอร์) ──────────────────────────────────────────────
  const startMs = switchStartMs(ctx.dealStart, pickupTime)
  const minDays = minSwitchDays(startMs, nowMs)

  const student = isStudent === true
  let discountPerDay = 0
  if (student && ctx.student.eligible) {
    if (ctx.student.university) {
      if (universityAffiliation !== 'affiliated' && universityAffiliation !== 'other') {
        return NextResponse.json({ error: `กรุณาเลือกว่าเป็นนักศึกษา ${ctx.student.university} หรือมหาลัยอื่นๆ` }, { status: 400 })
      }
      if (universityAffiliation === 'affiliated') discountPerDay = ctx.student.discountPerDay
    } else {
      discountPerDay = ctx.student.discountPerDay
    }
  }
  const studentIdPhoto = ctx.photos.student_id_card || (typeof studentIdPhotoUrl === 'string' ? studentIdPhotoUrl : '')
  if (discountPerDay > 0 && !studentIdPhoto) {
    return NextResponse.json({ error: 'ใช้สิทธิราคานักศึกษา — กรุณาแนบรูปบัตรนิสิต/นักศึกษาด้วย' }, { status: 400 })
  }

  const quote = quoteSwitch({ pkg, daysInput: days, minDays, baseRate: ctx.bike.baseDailyRate, discountPerDay, promoPayDays: ctx.promoPayDays })
  if ('error' in quote) return NextResponse.json({ error: quote.error }, { status: 400 })
  if (!(quote.total > 0)) return NextResponse.json({ error: 'คิดราคาไม่ได้ — ทักหาพี่เจ้าของร้าน' }, { status: 400 })
  const promoAfterOverdue = quote.isPromo && ctx.lateDays > 0

  const endMs = startMs + quote.days * DAY_MS

  // ── มัดจำ ──────────────────────────────────────────────────────────────────
  if (ctx.heldDeposit.method === 'id_card' && (student || quote.days >= 7)) {
    return NextResponse.json({ error: 'มัดจำเป็นบัตรประชาชน — เช่า 7 วันขึ้นไปหรือนักศึกษา วางบัตรแทนมัดจำไม่ได้ ต้องเปลี่ยนเป็นเงินมัดจำก่อน (ทักหาพี่เจ้าของร้าน)' }, { status: 400 })
  }
  const requiredDep = requiredDeposit({ isStudent: student, days: quote.days, hasAccommodationProof: ctx.hasAccommodationProof })
  const recommendedExtra = ctx.heldDeposit.method === 'id_card' ? 0 : Math.max(0, requiredDep - ctx.heldDeposit.amount)
  const extraDep = cleanAmount(extraDeposit, 100_000)
  const waived = extraDep < recommendedExtra
  if (waived && confirmWaiveDeposit !== true) {
    return NextResponse.json({
      error: `มัดจำที่ควรเก็บเพิ่ม ${baht(recommendedExtra)} (ถืออยู่ ${baht(ctx.heldDeposit.amount)} เกณฑ์ ${baht(requiredDep)}) — กรอกน้อยกว่านี้ต้องติ๊กยืนยันหยวนมัดจำ`,
      code: 'DEPOSIT_WAIVE_CONFIRM',
    }, { status: 400 })
  }
  const newDeposit = ctx.heldDeposit.amount + extraDep

  // ── ชนคิวจอง (เกณฑ์เดียวกับตอนสร้างสัญญา/แปลงเป็นรายเดือน) ──────────────────────
  const nowIso = new Date(nowMs).toISOString()
  const endIso = new Date(endMs).toISOString()
  const { data: conflictBookings } = await supabase
    .from('bookings')
    .select('id, booking_ref, customer_name, start_datetime')
    .eq('bike_id', ctx.bikeId)
    .eq('status', 'confirmed')
    .lt('start_datetime', endIso)
    .gt('end_datetime', nowIso)
  let conflict = (conflictBookings ?? [])[0] as { id: string; booking_ref: string; customer_name: string; start_datetime: string } | undefined
  const conflictMsg = (c: { booking_ref: string; customer_name: string; start_datetime: string }, model: boolean) =>
    `${model ? `ทำต่อจะทำให้รุ่น ${ctx.bike.brand} ${ctx.bike.model} ไม่พอสำหรับคิวจอง` : 'สลับเป็นรายวันจะไปชนคิวจอง'} ${c.booking_ref} (คุณ${c.customer_name} รับรถ ${new Date(c.start_datetime).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}) — ใช้ Fast lane เพื่อยืนยันทำต่อได้ (คิวนั้นจะยังไม่ถูกยกเลิก จะไปโผล่ในคิวมีปัญหาให้จัดการแทน)`
  if (conflict && !overrideBookingConflict) {
    return NextResponse.json({ error: conflictMsg(conflict, false), conflictBookingId: conflict.id }, { status: 409 })
  }
  if (!conflict) {
    const modelConflict = await findModelBookingConflict(supabase, ctx.branchId, ctx.bike.brand, ctx.bike.model, ctx.bikeId, nowIso, endIso)
    if (modelConflict && !overrideBookingConflict) {
      return NextResponse.json({ error: conflictMsg(modelConflict, true), conflictBookingId: modelConflict.id }, { status: 409 })
    }
    if (modelConflict) conflict = modelConflict
  }

  // ── 1) จองสิทธิ์ปิดสัญญาเดือนก่อน (อัปเดตแบบมีเงื่อนไขว่ายังเปิดอยู่) — กดซ้ำ/สองคนพร้อมกันผ่านได้ครั้งเดียว ──
  // ล้างรายการรูปในสัญญาเดือนด้วย: รูปย้ายไปสัญญารายวันแล้ว กัน cron ลบไฟล์สัญญาเดือนที่จบแล้วหลัง 7 วัน ไปลบไฟล์ที่สัญญารายวันยังใช้อยู่
  const switchNote = `[สลับเป็นรายวัน] ${today} นับจากวันครบดีล ${ctx.dealStart} • ${quote.days} วัน ${baht(quote.total)}`
  const { data: claimed, error: claimErr } = await supabase
    .from('monthly_rentals')
    .update({
      status: 'ended',
      end_date: today,
      send_photos: [],
      notes: `${ctx.rollback.notes ? ctx.rollback.notes + '\n' : ''}${switchNote}`,
    })
    .eq('id', monthlyRentalId)
    .eq('status', 'active')
    .select('id')
  if (claimErr) {
    console.error('[switch-to-daily] claim failed:', JSON.stringify(claimErr))
    return NextResponse.json({ error: 'ปิดสัญญารายเดือนไม่สำเร็จ' }, { status: 500 })
  }
  if (!claimed || claimed.length === 0) return NextResponse.json({ error: 'สัญญานี้ถูกปิดไปแล้ว' }, { status: 409 })

  const rollbackMonthly = async (why: string) => {
    const { error } = await supabase
      .from('monthly_rentals')
      .update({ status: 'active', end_date: ctx.rollback.endDate, send_photos: ctx.rollback.sendPhotosRaw ?? [], notes: ctx.rollback.notes })
      .eq('id', monthlyRentalId)
    if (error) console.error('[switch-to-daily] REVERT monthly failed:', monthlyRentalId, why, JSON.stringify(error))
  }

  // ── 2) สร้างสัญญารายวันต่อเนื่อง (รถคันเดิม ลูกค้าเดิม) ─────────────────────────
  const sendPhotos: Record<string, string> = { ...ctx.photos }
  if (ctx.photos.payment) sendPhotos.payment_prev = ctx.photos.payment   // สลิปรอบแรกของสัญญาเดือน เก็บไว้ ไม่ให้ไฟล์ตกหล่น
  sendPhotos.payment = slipUrl
  if (discountPerDay > 0 && studentIdPhoto) sendPhotos.student_id_card = studentIdPhoto

  // ประวัติสลับคัน: เก็บชื่อคัน/วันที่ ตัดราคาออก (รายวันไม่ใช้ราคาเดือน)
  const swapLog = ctx.swapLog.map(e => {
    const { old_rate: _o, new_rate: _n, ...rest } = (e ?? {}) as Record<string, unknown>
    void _o; void _n
    return rest
  })

  const { data: rental, error: rentalErr } = await supabase
    .from('rentals')
    .insert({
      branch_id: ctx.branchId,
      bike_id: ctx.bikeId,
      customer_id: ctx.customerId,
      staff_id: staffId,
      start_datetime: new Date(startMs).toISOString(),
      expected_end_datetime: endIso,
      daily_rate: ctx.bike.baseDailyRate,
      total_days: quote.days,
      total_amount: quote.total,
      deposit_amount: newDeposit,
      deposit_method: ctx.heldDeposit.method,
      discount: quote.discount,
      payment_method: paymentMethod,
      paid_amount: quote.total,
      status: 'active',
      notes: `สลับจากสัญญารายเดือน • ไมล์ ${ctx.bike.odometer}`,
      send_odometer: ctx.bike.odometer,
      send_fuel_full: null,
      send_photos: sendPhotos,
      customer_signature: ctx.signature,
      swap_log: swapLog,
      ...(conflict && overrideBookingConflict ? { fast_lane: true } : {}),
    })
    .select('id')
    .single()
  if (rentalErr || !rental) {
    console.error('[switch-to-daily] rental insert failed:', JSON.stringify(rentalErr))
    await rollbackMonthly('rental insert')
    return NextResponse.json({ error: 'สร้างสัญญารายวันไม่สำเร็จ — ยังไม่ได้สลับ ลองอีกครั้ง' }, { status: 500 })
  }

  // ── 3) บันทึกเงินเป็นรายรับรายวัน ตามวันที่รับเงินจริง ───────────────────────────
  const { error: payErr } = await supabase.from('rental_payments').insert({
    rental_id: rental.id,
    branch_id: ctx.branchId,
    staff_id: staffId,
    kind: 'rental',
    amount: quote.total,
    paid_at: paidAt,
  })
  if (payErr) {
    console.error('[switch-to-daily] payment insert failed:', JSON.stringify(payErr))
    await supabase.from('rentals').delete().eq('id', rental.id)
    await rollbackMonthly('payment insert')
    return NextResponse.json({ error: 'บันทึกเงินไม่สำเร็จ — ยังไม่ได้สลับ ลองอีกครั้ง' }, { status: 500 })
  }

  // รูปคู่รถที่เข้าคิวโปรโมทตอนทำสัญญาเดือน ผูกกับสัญญารายวันใหม่แทน — ไม่งั้นตอนคิวหมุนเวียนจะมองว่าไม่มีสัญญาไหนอ้างถึงแล้วลบไฟล์ทิ้ง
  await supabase.from('marketing_photos').update({ rental_id: rental.id, rental_type: 'daily' }).eq('rental_id', monthlyRentalId).eq('rental_type', 'monthly')

  await logStaffAction(staffId, 'monthly_to_daily',
    `สลับรายเดือน→รายวัน ${ctx.bike.plate} — ${ctx.customer.name} — ${quote.days} วัน ${baht(quote.total)} (เริ่มนับ ${ctx.dealStart})` +
      (promoAfterOverdue ? ` ⚠️ เลือกแพ็กเกจโปรหลังเลยวันครบดี ${ctx.lateDays} วัน` : '') +
      (waived ? ` ⚠️ หยวนมัดจำ (ควรเพิ่ม ${baht(recommendedExtra)} เก็บจริง ${baht(extraDep)})` : '') +
      (conflict && overrideBookingConflict ? ` ⚡ Fast lane ทับคิวจอง ${conflict.booking_ref}` : ''),
    {
      monthlyRentalId, rentalId: rental.id, bikeId: ctx.bikeId, dealStart: ctx.dealStart, pickupTime,
      pkg, days: quote.days, total: quote.total, normalTotal: quote.normalTotal, discount: quote.discount, discountPerDay,
      lateDays: ctx.lateDays, promoAfterOverdue,
      deposit: { held: ctx.heldDeposit.amount, required: requiredDep, recommendedExtra, collectedExtra: extraDep, waived, newTotal: newDeposit },
      receivedDate: received, paymentMethod,
      fastLaneOverBookingId: conflict && overrideBookingConflict ? conflict.id : null,
    })

  return NextResponse.json({ ok: true, rentalId: rental.id })
}
