import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { linePush, textMessage, imageMessage, LineMessage } from '@/lib/line'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// เรียกทุก 10 นาทีจาก scheduler (Supabase pg_cron / Vercel Cron)
// ป้องกันด้วย CRON_SECRET: Authorization: Bearer <secret> หรือ ?secret=<secret>
//
// สิ่งที่ส่ง:
//  ลูกค้า (ผ่าน OA ของสาขา — branch_settings):
//   1. rental_due_soon     — เช่ารายวันใกล้ครบกำหนด 1 ชม. (ไม่มี QR — ให้แจ้งพนักงาน)
//   2. rental_overdue      — เกินกำหนด 3 ชม. (ไม่มี QR)
//   3. rental_overdue_daily— เกินครบทุก 1 วัน พร้อมยอดค้าง (วัน × daily_rate)
//   4. monthly_due         — ค่าเช่ารายเดือนถึงกำหนด พร้อม QR + ยอด
//   5. routine_due         — งานรูทีน (เช่น เปลี่ยนน้ำมันเครื่อง) ถึงกำหนด → ลูกค้ารายเดือนที่ถือรถ
//  เจ้าของ (ผ่าน OA กลาง — shop_settings.line_token + line_target_id):
//   6. owner_digest        — สรุปงานค้าง (ภาษี/พรบ/เซอร์วิส) แยกบอลลูนรายสาขา หลัง 9 โมงเช้า
//   7. owner_available     — รถว่างวันนี้ แยกบอลลูนรายสาขา หลัง 8 โมงเช้า
//   8. owner_revenue       — รายได้วันนี้รายสาขา หลัง 3 ทุ่ม (รอบวัน 21:00→21:00)

const REMIND_BEFORE_MIN = 60      // เตือนล่วงหน้าก่อนครบกำหนด (นาที)
const OVERDUE_AFTER_HOURS = 3     // ทวงครั้งแรกหลังเกินกำหนด (ชั่วโมง)
const DAILY_SEND_HOUR = 9         // แจ้งเตือนแบบรายวัน (รายเดือน/รูทีน/เอกสาร) ส่งหลัง 9 โมงเช้า
const AVAILABLE_SEND_HOUR = 8     // สรุปรถว่าง ส่งหลัง 8 โมงเช้า
const REVENUE_SEND_HOUR = 21      // สรุปรายได้ ส่งหลัง 3 ทุ่ม
const DAY_MS = 24 * 60 * 60 * 1000

const thaiTime = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
})
const thaiDate = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric',
})

const DOC_LABEL: Record<string, string> = { tax: 'ภาษี', pob: 'พ.ร.บ.' }

type BranchLineSettings = {
  branch_id: string
  line_token: string | null
  promptpay_id: string | null
  line_notify_customer: boolean | null
  contact_phone: string | null
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  const querySecret = request.nextUrl.searchParams.get('secret')
  if (!secret || (auth !== `Bearer ${secret}` && querySecret !== secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // &test=1 = ข้ามเงื่อนไขเวลา 9 โมงเช้า (สำหรับทดสอบ)
  const testMode = request.nextUrl.searchParams.get('test') === '1'

  const supabase = createAdminClient()
  const origin = request.nextUrl.origin

  const [{ data: branchSettings }, { data: shop }, { data: branchRows }] = await Promise.all([
    supabase
      .from('branch_settings')
      .select('branch_id, line_token, promptpay_id, line_notify_customer, contact_phone'),
    supabase
      .from('shop_settings')
      .select('line_token, line_target_id, line_notify_docs, line_notify_routine, doc_alert_days')
      .limit(1)
      .maybeSingle(),
    supabase.from('branches').select('id, name'),
  ])

  const branchMap = new Map<string, BranchLineSettings>(
    (branchSettings ?? []).map(b => [b.branch_id, b as BranchLineSettings])
  )
  const branchNames = new Map<string, string>((branchRows ?? []).map(b => [b.id, b.name]))
  // ชื่อสาขาสำหรับแสดงผล — เติมคำว่า "สาขา" ถ้ายังไม่มี
  const displayBranch = (branchId: string) => {
    const raw = branchNames.get(branchId) ?? 'ไม่ระบุสาขา'
    return raw.startsWith('สาขา') || raw === 'ไม่ระบุสาขา' ? raw : `สาขา${raw}`
  }
  // เรียงสาขาตามชื่อ ก-ฮ ให้ลำดับเหมือนกันทุกข้อความ
  const sortBranchIds = (ids: string[]) =>
    Array.from(new Set(ids)).sort((a, b) => displayBranch(a).localeCompare(displayBranch(b), 'th'))

  // เวลาไทย (UTC+7 คงที่ ไม่มี DST)
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const bkk = new Date(now + 7 * 60 * 60 * 1000)
  const bkkHour = bkk.getUTCHours()
  const bkkToday = bkk.toISOString().split('T')[0] // YYYY-MM-DD ตามเวลาไทย

  const dueSoonUntil = new Date(now + REMIND_BEFORE_MIN * 60_000).toISOString()

  // ── โหลดข้อมูลทั้งหมดที่ต้องเช็ค ──
  const docAlertDays = Number(shop?.doc_alert_days ?? 30)
  const docAlertUntil = new Date(now + docAlertDays * DAY_MS).toISOString().split('T')[0]

  const [{ data: rentals }, { data: monthlies }, { data: routines }, { data: docs }] = await Promise.all([
    supabase
      .from('rentals')
      .select('id, branch_id, customer_id, expected_end_datetime, daily_rate, customers(name), bikes(license_plate, brand, model)')
      .in('status', ['active', 'extended'])
      .lte('expected_end_datetime', dueSoonUntil),
    supabase
      .from('monthly_rentals')
      .select('id, branch_id, customer_id, bike_id, payment_day, monthly_rate, customers(name), bikes(license_plate, brand, model)')
      .eq('status', 'active'),
    supabase
      .from('bike_routines')
      .select('id, bike_id, task_name, next_due_date, next_due_km, bikes(license_plate, odometer, branch_id)'),
    supabase
      .from('bike_documents')
      .select('id, doc_type, expiry_date, bikes(license_plate, branch_id)')
      .not('expiry_date', 'is', null)
      .lte('expiry_date', docAlertUntil),
  ])

  // ── LINE link ของลูกค้าทั้งชุด (ผูกแยกตามสาขา) ──
  const customerIds = Array.from(new Set([
    ...(rentals ?? []).map(r => r.customer_id),
    ...(monthlies ?? []).map(m => m.customer_id),
  ]))
  const { data: links } = customerIds.length
    ? await supabase
        .from('customer_line_links')
        .select('customer_id, branch_id, line_user_id')
        .in('customer_id', customerIds)
    : { data: [] as { customer_id: string; branch_id: string; line_user_id: string }[] }

  const linkMap = new Map<string, string>(
    (links ?? []).map(l => [`${l.customer_id}:${l.branch_id}`, l.line_user_id])
  )

  let sent = 0
  let failed = 0

  // กันส่งซ้ำ: จอง log ก่อนส่ง — จองไม่ได้ = เคยส่งแล้ว
  const claim = async (kind: string, refId: string, dueAt: string): Promise<string | null> => {
    const { data } = await supabase
      .from('line_notifications')
      .upsert({ kind, ref_id: refId, due_at: dueAt }, { onConflict: 'kind,ref_id,due_at', ignoreDuplicates: true })
      .select()
    return data && data.length > 0 ? data[0].id : null
  }
  const release = async (claimId: string) => {
    await supabase.from('line_notifications').delete().eq('id', claimId)
  }

  // ส่งหาลูกค้าผ่าน OA ของสาขา — คืน true/false
  const sendToCustomer = async (
    branchId: string | null, customerId: string, messages: LineMessage[]
  ): Promise<boolean> => {
    if (!branchId) return false
    const branch = branchMap.get(branchId)
    if (!branch?.line_token || branch.line_notify_customer === false) return false
    const lineUserId = linkMap.get(`${customerId}:${branchId}`)
    if (!lineUserId) return false
    return linePush(branch.line_token, lineUserId, messages)
  }

  const contactLine = (branchId: string | null) => {
    const phone = branchId ? branchMap.get(branchId)?.contact_phone : null
    return phone ? `\n\nติดต่อร้าน: ${phone}` : ''
  }

  // ═══ 1-3) เช่ารายวัน ═══
  for (const rental of rentals ?? []) {
    // ข้ามตั้งแต่ต้นถ้าสาขา/ลูกค้าส่งไม่ได้ — จะได้ไม่จอง log ทิ้งไว้
    if (!rental.branch_id || !linkMap.get(`${rental.customer_id}:${rental.branch_id}`)) continue
    const branch = branchMap.get(rental.branch_id)
    if (!branch?.line_token || branch.line_notify_customer === false) continue

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customer = rental.customers as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bike = rental.bikes as any

    const dueAt = rental.expected_end_datetime
    const dueMs = new Date(dueAt).getTime()
    const dueText = `${thaiTime.format(new Date(dueAt))} น.`
    const plate = bike?.license_plate ?? ''
    const bikeName = [bike?.brand, bike?.model].filter(Boolean).join(' ')
    const name = customer?.name ?? 'ลูกค้า'

    let kind: string
    let claimDueAt: string
    let text: string

    if (dueMs > now) {
      // 1) ใกล้ครบกำหนด (ภายใน 60 นาที)
      kind = 'rental_due_soon'
      claimDueAt = dueAt
      text =
        `🛵 สวัสดีคุณ${name}\n` +
        `รถ ${bikeName} ทะเบียน ${plate} จะครบกำหนดคืนเวลา ${dueText}\n\n` +
        `หากต้องการต่อเวลา รบกวนแจ้งพนักงาน หรือทักแชทนี้ได้เลยครับ\n` +
        `หากไม่ต่อ รบกวนนำรถมาคืนตามเวลานัดครับ ขอบคุณครับ 🙏`
    } else {
      const overMs = now - dueMs
      const daysOver = Math.floor(overMs / DAY_MS)
      if (daysOver >= 1) {
        // 3) เกินครบทุก 1 วัน — ทวงพร้อมยอด
        kind = 'rental_overdue_daily'
        claimDueAt = new Date(dueMs + daysOver * DAY_MS).toISOString()
        const total = (daysOver * Number(rental.daily_rate)).toLocaleString()
        const rate = Number(rental.daily_rate).toLocaleString()
        text =
          `⚠️ เรียนคุณ${name}\n` +
          `รถทะเบียน ${plate} เกินกำหนดคืนมาแล้ว ${daysOver} วัน (ครบกำหนด ${dueText})\n\n` +
          `ยอดค้างชำระ: ฿${total} (${daysOver} วัน × ฿${rate})\n` +
          `กรุณานำรถมาคืนที่ร้าน หรือติดต่อพนักงานเพื่อชำระและต่อเวลาครับ` +
          contactLine(rental.branch_id)
      } else if (overMs >= OVERDUE_AFTER_HOURS * 60 * 60 * 1000) {
        // 2) เกินกำหนด 3 ชม. — ทวงครั้งแรก
        kind = 'rental_overdue'
        claimDueAt = dueAt
        text =
          `⚠️ เรียนคุณ${name}\n` +
          `รถทะเบียน ${plate} เกินกำหนดคืนแล้ว (ครบกำหนด ${dueText})\n\n` +
          `กรุณานำรถมาคืนที่ร้าน หรือหากต้องการต่อเวลา รบกวนแจ้งพนักงานครับ` +
          contactLine(rental.branch_id)
      } else {
        continue // เกินแล้วแต่ยังไม่ถึง 3 ชม. — รอรอบถัดไป
      }
    }

    const claimId = await claim(kind, rental.id, claimDueAt)
    if (!claimId) continue
    const ok = await sendToCustomer(rental.branch_id, rental.customer_id, [textMessage(text)])
    if (ok) sent++
    else { failed++; await release(claimId) }
  }

  // ═══ 4) ค่าเช่ารายเดือนถึงกำหนด (ส่งหลัง 9 โมงเช้าของวันครบกำหนด) ═══
  if (bkkHour >= DAILY_SEND_HOUR || testMode) {
    const daysInMonth = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth() + 1, 0)).getUTCDate()
    const bkkDay = bkk.getUTCDate()

    for (const monthly of monthlies ?? []) {
      if (!monthly.branch_id || !linkMap.get(`${monthly.customer_id}:${monthly.branch_id}`)) continue
      const branch = branchMap.get(monthly.branch_id)
      if (!branch?.line_token || branch.line_notify_customer === false) continue

      // วันจ่ายของเดือนนี้ (เดือนสั้นให้เลื่อนมาวันสุดท้าย เช่น กำหนดวันที่ 31 ใน ก.พ. = วันที่ 28)
      const dueDay = Math.min(Number(monthly.payment_day ?? 1), daysInMonth)
      if (bkkDay !== dueDay) continue

      const claimId = await claim('monthly_due', monthly.id, bkkToday)
      if (!claimId) continue

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customer = monthly.customers as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bike = monthly.bikes as any
      const rate = Number(monthly.monthly_rate)

      const messages: LineMessage[] = [textMessage(
        `📅 เรียนคุณ${customer?.name ?? 'ลูกค้า'}\n` +
        `ค่าเช่ารายเดือนรถทะเบียน ${bike?.license_plate ?? ''} ครบกำหนดชำระวันนี้ครับ\n` +
        `ยอดชำระ: ฿${rate.toLocaleString()}\n\n` +
        `• ต่อสัญญา: โอนตาม QR ด้านล่าง แล้วส่งสลิปในแชทนี้ได้เลยครับ\n` +
        `• ไม่ต่อ: รบกวนนำรถมาคืนที่ร้านภายในเวลาทำการครับ\n\n` +
        `ขอบคุณที่ใช้บริการครับ 🙏`
      )]
      if (branch.promptpay_id) {
        messages.push(imageMessage(`${origin}/api/line/qr?branch=${monthly.branch_id}&amount=${rate}`))
      }

      const ok = await sendToCustomer(monthly.branch_id, monthly.customer_id, messages)
      if (ok) sent++
      else { failed++; await release(claimId) }
    }

    // ═══ 5) งานรูทีนถึงกำหนด (เช่น เปลี่ยนน้ำมันเครื่อง/เฟืองท้าย) ═══
    // ครบตามวัน (next_due_date) หรือครบตามระยะ (next_due_km เทียบเลขไมล์ล่าสุดของรถ)
    const dueRoutines = (routines ?? []).filter(r => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const odometer = (r.bikes as any)?.odometer ?? 0
      return (r.next_due_date != null && r.next_due_date <= bkkToday)
        || (r.next_due_km != null && Number(r.next_due_km) <= odometer)
    })
    // คีย์กันส่งซ้ำต่อรอบ: ใช้วันครบกำหนด หรือถ้าครบตามกม. ใช้เลขกม.เป้าหมายแปลงเป็น timestamp
    // (ทำรูทีนเสร็จ next_due ขยับ → รอบใหม่แจ้งใหม่ได้)
    const routineDueKey = (r: { next_due_date: string | null; next_due_km: number | null }) =>
      r.next_due_date ?? new Date(Number(r.next_due_km) * 1000).toISOString()

    // 5a) แจ้งลูกค้ารายเดือนที่ถือรถอยู่ ให้นัดเข้าเซอร์วิส
    const monthlyByBike = new Map((monthlies ?? []).map(m => [m.bike_id, m]))
    for (const routine of dueRoutines) {
      const monthly = monthlyByBike.get(routine.bike_id)
      if (!monthly?.branch_id || !linkMap.get(`${monthly.customer_id}:${monthly.branch_id}`)) continue
      const branch = branchMap.get(monthly.branch_id)
      if (!branch?.line_token || branch.line_notify_customer === false) continue

      const claimId = await claim('routine_due', routine.id, routineDueKey(routine))
      if (!claimId) continue

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customer = monthly.customers as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bike = monthly.bikes as any

      const ok = await sendToCustomer(monthly.branch_id, monthly.customer_id, [textMessage(
        `🔧 เรียนคุณ${customer?.name ?? 'ลูกค้า'}\n` +
        `รถทะเบียน ${bike?.license_plate ?? ''} ถึงกำหนด "${routine.task_name}" แล้วครับ\n\n` +
        `รบกวนติดต่อพนักงานเพื่อนัดหมายนำรถเข้ามาเซอร์วิส หรือแจ้งในแชทนี้ได้เลยครับ 🙏` +
        contactLine(monthly.branch_id)
      )])
      if (ok) sent++
      else { failed++; await release(claimId) }
    }

    // ═══ 6) สรุปงานค้างเข้าไลน์เจ้าของ — แยกข้อความเป็นรายสาขา ส่งซ้ำทุกวันจนกว่าจะเคลียร์ ═══
    // รายการหลุดจากลิสต์เองเมื่อ staff ทำรายการในแอพ (ทำรูทีนเสร็จ / ต่อภาษี-พรบ แล้วอัพเดทวันหมดอายุ)
    if (shop?.line_token && shop.line_target_id) {
      type DigestItem = { branchId: string; section: 'doc' | 'routine'; line: string }
      const items: DigestItem[] = []

      // เอกสาร: ภาษี / พรบ ใกล้หมดหรือหมดแล้ว
      if (shop.line_notify_docs !== false) {
        for (const doc of docs ?? []) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const bike = doc.bikes as any
          const label = DOC_LABEL[doc.doc_type] ?? doc.doc_type
          const daysLeft = Math.ceil((new Date(doc.expiry_date).getTime() - now) / DAY_MS)
          const when = daysLeft > 0 ? `อีก ${daysLeft} วัน` : daysLeft === 0 ? 'วันนี้' : `เกินมา ${-daysLeft} วัน`
          items.push({
            branchId: bike?.branch_id ?? '',
            section: 'doc',
            line: `• ${bike?.license_plate ?? '?'} — ${label} หมดอายุ ${thaiDate.format(new Date(doc.expiry_date))} (${when})`,
          })
        }
      }

      // งานเซอร์วิส: น้ำมันเครื่อง / เฟืองท้าย ฯลฯ
      if (shop.line_notify_routine !== false) {
        for (const routine of dueRoutines) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const bike = routine.bikes as any
          const detail = routine.next_due_date != null && routine.next_due_date <= bkkToday
            ? `ครบกำหนด ${thaiDate.format(new Date(routine.next_due_date))}`
            : `ครบที่ ${Number(routine.next_due_km).toLocaleString()} กม. (ไมล์ตอนนี้ ${Number(bike?.odometer ?? 0).toLocaleString()} กม.)`
          items.push({
            branchId: bike?.branch_id ?? '',
            section: 'routine',
            line: `• ${bike?.license_plate ?? '?'} — ${routine.task_name} (${detail})`,
          })
        }
      }

      if (items.length > 0) {
        // dedupe รายวัน: ref_id คงที่ + due_at = วันที่ (ส่งได้วันละครั้ง)
        const DIGEST_REF = '00000000-0000-0000-0000-000000000000'
        const claimId = await claim('owner_digest', DIGEST_REF, bkkToday)
        if (claimId) {
          // จัดกลุ่มตามสาขา — สาขาละ 1 ข้อความ ก๊อปส่งต่อ staff สาขานั้นได้เลย
          const branchIds = sortBranchIds(items.map(i => i.branchId))

          const dateText = thaiDate.format(new Date(now))
          const messages: LineMessage[] = branchIds.map(branchId => {
            const docLines = items.filter(i => i.branchId === branchId && i.section === 'doc').map(i => i.line)
            const routineLines = items.filter(i => i.branchId === branchId && i.section === 'routine').map(i => i.line)
            let text = `📋 งานค้างที่ยังไม่ได้ทำ (${dateText}) ${displayBranch(branchId)}`
            if (docLines.length > 0) text += `\n\n📄 เอกสารรถ\n${docLines.join('\n')}`
            if (routineLines.length > 0) text += `\n\n🔧 งานเซอร์วิส\n${routineLines.join('\n')}`
            return textMessage(text)
          })

          // LINE จำกัด 5 ข้อความ/การส่ง — ส่งเป็นชุดถ้าสาขาเยอะ
          let allOk = true
          for (let i = 0; i < messages.length; i += 5) {
            const ok = await linePush(shop.line_token, shop.line_target_id, messages.slice(i, i + 5))
            allOk = allOk && ok
          }
          if (allOk) sent += messages.length
          else { failed++; await release(claimId) }
        }
      }
    }
  }

  // ═══ 7) รถว่างวันนี้ → กลุ่ม owner (หลัง 8 โมงเช้า) แยกบอลลูนรายสาขา ═══
  if ((bkkHour >= AVAILABLE_SEND_HOUR || testMode) && shop?.line_token && shop.line_target_id) {
    const claimId = await claim('owner_available', '00000000-0000-0000-0000-000000000000', bkkToday)
    if (claimId) {
      const [{ data: allBikes }, { data: activeRentalBikes }] = await Promise.all([
        supabase.from('bikes').select('id, branch_id, license_plate, brand, model, status'),
        supabase.from('rentals').select('bike_id').in('status', ['active', 'extended']),
      ])
      // ว่างจริง = สถานะ available และไม่มีสัญญา active คาอยู่ (กันสถานะรถค้าง)
      const busy = new Set<string>([
        ...(activeRentalBikes ?? []).map(r => r.bike_id),
        ...(monthlies ?? []).map(m => m.bike_id),
      ])
      const available = (allBikes ?? []).filter(b => b.status === 'available' && !busy.has(b.id))

      const dateText = thaiDate.format(new Date(now))
      const branchIds = sortBranchIds(available.map(b => b.branch_id ?? ''))
      const messages: LineMessage[] = branchIds.map(branchId => {
        const list = available.filter(b => (b.branch_id ?? '') === branchId)
        const lines = list.map(b => `• ${b.license_plate} ${[b.brand, b.model].filter(Boolean).join(' ')}`)
        return textMessage(`🛵 รถว่างวันนี้ (${dateText}) ${displayBranch(branchId)} — ${list.length} คัน\n\n${lines.join('\n')}`)
      })
      if (messages.length === 0) {
        messages.push(textMessage(`🛵 รถว่างวันนี้ (${dateText}) — ไม่มีรถว่างเลย ทุกคันออกงานหมด 🎉`))
      }

      let allOk = true
      for (let i = 0; i < messages.length; i += 5) {
        allOk = (await linePush(shop.line_token, shop.line_target_id, messages.slice(i, i + 5))) && allOk
      }
      if (allOk) sent += messages.length
      else { failed++; await release(claimId) }
    }
  }

  // ═══ 8) รายได้วันนี้ → กลุ่ม owner (หลัง 3 ทุ่ม) ═══
  // รอบวัน: 3 ทุ่มเมื่อวาน → 3 ทุ่มวันนี้ (เงินเข้าหลัง 3 ทุ่มไปรวมยอดของพรุ่งนี้ ไม่ตกหล่น)
  if ((bkkHour >= REVENUE_SEND_HOUR || testMode) && shop?.line_token && shop.line_target_id) {
    const claimId = await claim('owner_revenue', '00000000-0000-0000-0000-000000000000', bkkToday)
    if (claimId) {
      const windowEnd = new Date(`${bkkToday}T${String(REVENUE_SEND_HOUR - 7).padStart(2, '0')}:00:00Z`) // 21:00 ไทย
      const windowStart = new Date(windowEnd.getTime() - DAY_MS)

      const [{ data: dayRentals }, { data: dayPayments }] = await Promise.all([
        supabase.from('rentals')
          .select('branch_id, total_amount')
          .in('status', ['active', 'extended', 'returned', 'completed'])
          .gte('start_datetime', windowStart.toISOString())
          .lt('start_datetime', windowEnd.toISOString()),
        supabase.from('monthly_payments')
          .select('amount, monthly_rentals(branch_id)')
          .eq('paid_date', bkkToday),
      ])

      type Rev = { rental: number; rentalCount: number; monthly: number; monthlyCount: number }
      const revByBranch = new Map<string, Rev>()
      const bump = (branchId: string, field: 'rental' | 'monthly', amount: number) => {
        const rev = revByBranch.get(branchId) ?? { rental: 0, rentalCount: 0, monthly: 0, monthlyCount: 0 }
        rev[field] += amount
        if (field === 'rental') rev.rentalCount++
        else rev.monthlyCount++
        revByBranch.set(branchId, rev)
      }
      for (const r of dayRentals ?? []) bump(r.branch_id ?? '', 'rental', Number(r.total_amount ?? 0))
      for (const p of dayPayments ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mr = p.monthly_rentals as any
        bump(mr?.branch_id ?? '', 'monthly', Number(p.amount ?? 0))
      }

      const dateText = thaiDate.format(new Date(now))
      // โชว์ครบทุกสาขาแม้ยอด 0 — จะได้เห็นว่าสาขาไหนเงียบ
      const branchIds = sortBranchIds([...Array.from(branchNames.keys()), ...Array.from(revByBranch.keys())])
      let grandTotal = 0
      const lines = branchIds.map(branchId => {
        const rev = revByBranch.get(branchId) ?? { rental: 0, rentalCount: 0, monthly: 0, monthlyCount: 0 }
        const total = rev.rental + rev.monthly
        grandTotal += total
        let line = `${displayBranch(branchId)}: ฿${total.toLocaleString()}`
        const parts: string[] = []
        if (rev.rentalCount > 0) parts.push(`เช่าใหม่ ${rev.rentalCount} สัญญา ฿${rev.rental.toLocaleString()}`)
        if (rev.monthlyCount > 0) parts.push(`รายเดือน ${rev.monthlyCount} ราย ฿${rev.monthly.toLocaleString()}`)
        if (parts.length > 0) line += `\n   (${parts.join(' + ')})`
        return line
      })

      const ok = await linePush(shop.line_token, shop.line_target_id, [textMessage(
        `💰 รายได้วันนี้ (${dateText})\n\n${lines.join('\n')}\n\nรวมทุกสาขา: ฿${grandTotal.toLocaleString()}`
      )])
      if (ok) sent++
      else { failed++; await release(claimId) }
    }
  }

  // ═══ 9) รายงานสิ้นเดือน → กลุ่ม owner (วันสุดท้ายของเดือน หลัง 3 ทุ่ม) ═══
  const [ry, rm, rd] = bkkToday.split('-').map(Number) // rm = 1-based
  const daysInMonth = new Date(Date.UTC(ry, rm, 0)).getUTCDate()
  const isLastDayOfMonth = rd === daysInMonth
  if ((isLastDayOfMonth || testMode) && bkkHour >= REVENUE_SEND_HOUR && shop?.line_token && shop.line_target_id) {
    const claimId = await claim('month_report', '00000000-0000-0000-0000-000000000000', bkkToday)
    if (claimId) {
      const H7 = 7 * 3_600_000
      const monthStartMs = Date.UTC(ry, rm - 1, 1) - H7   // 00:00 ไทย วันที่ 1
      const monthEndMs = Date.UTC(ry, rm, 1) - H7         // 00:00 ไทย วันที่ 1 เดือนหน้า
      const prevStartMs = Date.UTC(ry, rm - 2, 1) - H7
      const dMonth = Math.round((monthEndMs - monthStartMs) / 86_400_000)
      const isoOf = (ms: number) => new Date(ms).toISOString()
      const firstOfMonth = `${ry}-${String(rm).padStart(2, '0')}-01`
      const pmY = rm === 1 ? ry - 1 : ry
      const pmM = rm === 1 ? 12 : rm - 1
      const pmFirst = `${pmY}-${String(pmM).padStart(2, '0')}-01`
      const pmLast = new Date(Date.UTC(pmY, pmM, 0)).toISOString().split('T')[0]
      const CAPACITY_EXCLUDE = ['repair', 'maintenance', 'retired', 'inactive'] // รถเสียตัดออก

      const [{ data: allBikes }, { data: dRentals }, { data: dRentalsPrev }, { data: mMonthly }, { data: mPayCur }, { data: mPayPrev }, { data: expDocs }] = await Promise.all([
        supabase.from('bikes').select('id, branch_id, status'),
        supabase.from('rentals')
          .select('branch_id, start_datetime, expected_end_datetime, actual_end_datetime, total_amount')
          .lt('start_datetime', isoOf(monthEndMs)).gt('expected_end_datetime', isoOf(monthStartMs))
          .in('status', ['active', 'extended', 'returned', 'completed']),
        supabase.from('rentals')
          .select('branch_id, start_datetime, expected_end_datetime, actual_end_datetime, total_amount')
          .lt('start_datetime', isoOf(monthStartMs)).gt('expected_end_datetime', isoOf(prevStartMs))
          .in('status', ['active', 'extended', 'returned', 'completed']),
        supabase.from('monthly_rentals').select('branch_id, start_date, end_date, status'),
        supabase.from('monthly_payments').select('amount, monthly_rentals(branch_id)').eq('status', 'paid').gte('paid_date', firstOfMonth).lte('paid_date', bkkToday),
        supabase.from('monthly_payments').select('amount').eq('status', 'paid').gte('paid_date', pmFirst).lte('paid_date', pmLast),
        supabase.from('bike_documents').select('id, bikes(branch_id)').in('doc_type', ['tax', 'pob']).gte('expiry_date', firstOfMonth).lt('expiry_date', new Date(Date.UTC(ry, rm + 1, 1)).toISOString().split('T')[0]),
      ])

      // clamp ช่วงเช่าให้อยู่ในหน้าต่างที่กำหนด → คัน-วัน
      const clampDays = (sMs: number, eMs: number, winS: number, winE: number) => {
        const s = Math.max(sMs, winS), e = Math.min(eMs, winE)
        return e > s ? (e - s) / 86_400_000 : 0
      }
      const dayMsFromDate = (dateStr: string) => new Date(dateStr + 'T00:00:00+07:00').getTime()
      const prevEndMs = monthStartMs
      const dPrev = Math.round((prevEndMs - prevStartMs) / 86_400_000)

      type BStat = { cap: number; used: number; usedPrev: number; revenue: number; dailyCount: number }
      const stat = new Map<string, BStat>()
      const get = (b: string): BStat => {
        let s = stat.get(b); if (!s) { s = { cap: 0, used: 0, usedPrev: 0, revenue: 0, dailyCount: 0 }; stat.set(b, s) } return s
      }
      let repairCount = 0
      for (const b of allBikes ?? []) {
        const s = get(b.branch_id ?? '')
        if (b.status === 'repair' || b.status === 'maintenance') repairCount++
        if (!CAPACITY_EXCLUDE.includes(b.status)) s.cap++
      }
      for (const r of dRentals ?? []) {
        const s = get(r.branch_id ?? '')
        const sMs = new Date(r.start_datetime).getTime()
        const eMs = new Date(r.actual_end_datetime ?? r.expected_end_datetime).getTime()
        s.used += clampDays(sMs, eMs, monthStartMs, monthEndMs)
        if (sMs >= monthStartMs && sMs < monthEndMs) { s.revenue += Number(r.total_amount ?? 0); s.dailyCount++ }
      }
      for (const r of dRentalsPrev ?? []) {
        const s = get(r.branch_id ?? '')
        const sMs = new Date(r.start_datetime).getTime()
        const eMs = new Date(r.actual_end_datetime ?? r.expected_end_datetime).getTime()
        s.usedPrev += clampDays(sMs, eMs, prevStartMs, prevEndMs)
      }
      for (const m of mMonthly ?? []) {
        if (m.status !== 'active' && m.status !== 'ended') continue
        const sMs = dayMsFromDate(m.start_date)
        const eMs = m.end_date ? dayMsFromDate(m.end_date) : monthEndMs
        const s = get(m.branch_id ?? '')
        s.used += clampDays(sMs, eMs, monthStartMs, monthEndMs)
        s.usedPrev += clampDays(sMs, eMs, prevStartMs, prevEndMs)
      }
      for (const p of mPayCur ?? []) { const mr = p.monthly_rentals as { branch_id?: string } | null; get(mr?.branch_id ?? '').revenue += Number(p.amount ?? 0) }

      const activeMonthlyCount = (mMonthly ?? []).filter(m => m.status === 'active').length
      const revPrev = (dRentalsPrev ?? []).reduce((s, r) => {
        const sMs = new Date(r.start_datetime).getTime()
        return s + (sMs >= prevStartMs && sMs < prevEndMs ? Number(r.total_amount ?? 0) : 0)
      }, 0) + (mPayPrev ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0)

      const branchIds = sortBranchIds([...Array.from(branchNames.keys()), ...Array.from(stat.keys())])
      const monthLabel = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', month: 'long', year: 'numeric' }).format(new Date(monthStartMs + 15 * 86_400_000))

      let grand = 0, dailyTotal = 0, totalCap = 0, totalUsed = 0, totalUsedPrev = 0
      const revLines: string[] = [], utilLines: string[] = []
      for (const b of branchIds) {
        const s = stat.get(b) ?? { cap: 0, used: 0, usedPrev: 0, revenue: 0, dailyCount: 0 }
        grand += s.revenue; dailyTotal += s.dailyCount; totalCap += s.cap; totalUsed += s.used; totalUsedPrev += s.usedPrev
        revLines.push(`• ${displayBranch(b)}: ฿${Math.round(s.revenue).toLocaleString()}`)
        const util = s.cap > 0 ? Math.min(100, Math.round((s.used / (s.cap * dMonth)) * 100)) : 0
        utilLines.push(`• ${displayBranch(b)}: ใช้ ${util}% / ว่าง ${100 - util}% (${s.cap} คัน)`)
      }
      const revPctText = revPrev > 0
        ? `${grand >= revPrev ? '↑' : '↓'}${Math.abs(Math.round(((grand - revPrev) / revPrev) * 100))}% จากเดือนก่อน`
        : 'เดือนแรกที่มีข้อมูล'
      const utilNow = totalCap > 0 ? Math.round((totalUsed / (totalCap * dMonth)) * 100) : 0
      const utilPrev = totalCap > 0 && dPrev > 0 ? Math.round((totalUsedPrev / (totalCap * dPrev)) * 100) : 0
      const utilCmp = utilPrev > 0 ? ` (${utilNow >= utilPrev ? '↑' : '↓'}${Math.abs(utilNow - utilPrev)}% จากเดือนก่อน)` : ''

      const msg =
        `📊 สรุปเดือน ${monthLabel}\n\n` +
        `💰 รายได้รวม: ฿${Math.round(grand).toLocaleString()} (${revPctText})\n${revLines.join('\n')}\n\n` +
        `🛵 อัตราการใช้รถเฉลี่ย: ${utilNow}%${utilCmp} (ไม่นับรถเสีย)\n${utilLines.join('\n')}\n\n` +
        `📄 สัญญาเดือนนี้: เช่ารายวัน ${dailyTotal} ครั้ง • รายเดือน active ${activeMonthlyCount} คัน\n` +
        `🔧 รถเสียตอนนี้: ${repairCount} คัน\n` +
        `⚠️ เดือนหน้า: ภาษี/พรบ หมด ${(expDocs ?? []).length} คัน`

      const ok = await linePush(shop.line_token, shop.line_target_id, [textMessage(msg)])
      if (ok) sent++
      else { failed++; await release(claimId) }
    }
  }

  return NextResponse.json({
    checkedAt: nowIso,
    rentals: rentals?.length ?? 0,
    monthlies: monthlies?.length ?? 0,
    sent, failed,
  })
}
