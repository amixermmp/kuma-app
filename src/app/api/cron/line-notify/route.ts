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
//   6. doc_expiry          — ภาษี/พรบ ใกล้หมดอายุ → แชทกลุ่ม owner

const REMIND_BEFORE_MIN = 60      // เตือนล่วงหน้าก่อนครบกำหนด (นาที)
const OVERDUE_AFTER_HOURS = 3     // ทวงครั้งแรกหลังเกินกำหนด (ชั่วโมง)
const DAILY_SEND_HOUR = 9         // แจ้งเตือนแบบรายวัน (รายเดือน/รูทีน/เอกสาร) ส่งหลัง 9 โมงเช้า
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

  const [{ data: branchSettings }, { data: shop }] = await Promise.all([
    supabase
      .from('branch_settings')
      .select('branch_id, line_token, promptpay_id, line_notify_customer, contact_phone'),
    supabase
      .from('shop_settings')
      .select('line_token, line_target_id, line_notify_docs, line_notify_routine, doc_alert_days')
      .limit(1)
      .maybeSingle(),
  ])

  const branchMap = new Map<string, BranchLineSettings>(
    (branchSettings ?? []).map(b => [b.branch_id, b as BranchLineSettings])
  )

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
      const { data: branchRows } = await supabase.from('branches').select('id, name')
      const branchNames = new Map<string, string>((branchRows ?? []).map(b => [b.id, b.name]))

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
          const branchIds = Array.from(new Set(items.map(i => i.branchId)))
            .sort((a, b) => (branchNames.get(a) ?? 'ไม่ระบุ').localeCompare(branchNames.get(b) ?? 'ไม่ระบุ', 'th'))

          const dateText = thaiDate.format(new Date(now))
          const messages: LineMessage[] = branchIds.map(branchId => {
            const rawName = branchNames.get(branchId) ?? 'ไม่ระบุสาขา'
            const displayName = rawName.startsWith('สาขา') || rawName === 'ไม่ระบุสาขา' ? rawName : `สาขา${rawName}`
            const docLines = items.filter(i => i.branchId === branchId && i.section === 'doc').map(i => i.line)
            const routineLines = items.filter(i => i.branchId === branchId && i.section === 'routine').map(i => i.line)
            let text = `📋 งานค้างที่ยังไม่ได้ทำ (${dateText}) ${displayName}`
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

  return NextResponse.json({
    checkedAt: nowIso,
    rentals: rentals?.length ?? 0,
    monthlies: monthlies?.length ?? 0,
    sent, failed,
  })
}
