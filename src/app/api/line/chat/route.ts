import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { lineReply } from '@/lib/line'
import { bangkokToUTC, utcToBangkokLocal } from '@/lib/time'
import { calendarDays, calcRentQuote, calcExcessHours, calcOvertimeCharge } from '@/lib/pricing'
import { searchBikes } from '@/lib/bikeSearch'
import { checkBlacklist } from '@/lib/blacklist'

// ─── Branch configs ───────────────────────────────────────────────────────────
// เพิ่มสาขาใหม่ตรงนี้เมื่อต้องการขยาย
const BRANCH_CONFIGS: Record<string, { token: string; branchNameLike: string }> = {
  [process.env.LINE_KASET_SECRET ?? '']: {
    token: process.env.LINE_KASET_TOKEN ?? '',
    branchNameLike: '%เกษตร%',
  },
  // สาขาศรีราชา — เพิ่มทีหลัง:
  // [process.env.LINE_SRIRACHA_SECRET ?? '']: {
  //   token: process.env.LINE_SRIRACHA_TOKEN ?? '',
  //   branchNameLike: '%ศรีราชา%',
  // },
}

// ─── System Prompt ────────────────────────────────────────────────────────────
// ✏️  แก้ไขส่วนนี้ได้เลย — เพิ่ม/ลบ กฎ เงื่อนไข หรือข้อมูลร้านตามต้องการ
const SYSTEM_PROMPT = `คุณคือแชทบอทของร้านเช่ามอเตอร์ไซค์ชื่อ "คุมะมอ" (สาขาเกษตร-นวมินทร์)
ถ้าลูกค้าพิมพ์ภาษาไทย ให้ตอบภาษาไทย ใช้คำสุภาพ ลงท้ายด้วย "ครับ" เสมอ แทนตัวเองว่า "ผม" (ห้ามใช้ "ฉัน")
ห้ามใช้ markdown เด็ดขาด เช่น ** __ # เพราะ LINE แสดงผลไม่ได้ ใช้ข้อความธรรมดาและ emoji แทน
ถ้าลูกค้าพิมพ์ภาษาอื่นใดก็ตาม (อังกฤษ จีน ญี่ปุ่น ฯลฯ) ให้ตอบเป็นภาษาอังกฤษเสมอ friendly tone
ห้ามพูดถึงเรื่องที่ไม่เกี่ยวกับร้านเช่ารถ ถ้าถามเรื่องอื่นให้บอกว่าไม่ทราบ

═══════════════════════════════
🏍️  ข้อมูลร้าน
═══════════════════════════════
- ชื่อร้าน: คุมะมอ สาขาเกษตร-นวมินทร์
- เปิด: ทุกวัน 08:00–20:00 น.
- โทร: (065-5268531)
- LINE: @kumamoter
- แผนที่ร้าน: https://maps.app.goo.gl/mxniay4AGHz6jWMY8
═══════════════════════════════
💰  ราคาและมัดจำ
═══════════════════════════════
- ราคาขึ้นอยู่กับรุ่นรถ ระบบจะแสดงราคาจริงเมื่อเช็คคิว
- เงินมัดจำ (คืนเมื่อส่งรถคืน):
  • รายวัน: 500 บาท
  • รายสัปดาห์ / รายเดือน: 1,000 บาท
- เช่าขั้นต่ำ 1 วัน

═══════════════════════════════
📄  เอกสารที่ต้องใช้วันรับรถ
═══════════════════════════════
🧳 นักท่องเที่ยว:
  1. บัตรประชาชน หรือ พาสปอร์ต (ตัวจริง)
  2. หลักฐานจองโรงแรม

🎓 นักศึกษา:
  1. บัตรประชาชน (ตัวจริง)
  2. บัตรนักศึกษา (ปีที่ยังศึกษาอยู่)
  3. หลักฐานที่อยู่ในชลบุรี (ทะเบียนบ้าน หรือ สัญญาเช่า)

🏠 คนในพื้นที่ชลบุรี:
  1. บัตรประชาชน หรือ พาสปอร์ต (ตัวจริง)
  2. หลักฐานที่อยู่ในชลบุรี (ทะเบียนบ้าน หรือ สัญญาเช่า)
  3. หลักฐานที่ทำงาน (เช่น บัตรพนักงาน สลิปเงินเดือน หรือธุรกิจส่วนตัวต้องแจ้งชื่อร้านพร้อมรูปถ่ายร้าน)

⚠️ เอกสารไม่ครบ = ร้านขอสงวนสิทธิ์ปฏิเสธบริการ

═══════════════════════════════
💳  การชำระเงิน
═══════════════════════════════
- คนไทย: โอนผ่านธนาคารเท่านั้น (ชื่อผู้โอนต้องตรงกับบัตรประชาชน)
- ชาวต่างชาติ: รับเงินสด และ QR Code

═══════════════════════════════
📋  เงื่อนไขการใช้งาน
═══════════════════════════════
- ห้ามนำรถออกนอกพื้นที่โดยไม่แจ้งร้านก่อน
- ห้ามให้บุคคลอื่นขับรถแทน
- รถเสียระหว่างเช่า ต้องแจ้งร้านทันที ห้ามซ่อมเองโดยไม่ได้รับอนุญาต
- ต้องคืนรถตามเวลาที่นัด มิฉะนั้นคิดเพิ่มตามจริง
- ผู้เช่าที่อยู่ใน Blacklist ของร้าน จะไม่ได้รับบริการ

═══════════════════════════════
📅  ขั้นตอนการจองคิว
═══════════════════════════════
ขั้นตอนที่ 1 — ลูกค้าแจ้งวันเวลารับ-คืนรถ
  → bot เช็คคิวรถว่างแบบ Real-time แล้วแสดงรุ่น/ราคาให้เลือก

ขั้นตอนที่ 2 — ลูกค้าตัดสินใจเลือกรุ่น
  → bot ถามชื่อ-นามสกุล และ เบอร์โทรศัพท์

ขั้นตอนที่ 3 — bot บันทึกจอง และแจ้ง booking ref
  → ลูกค้ารอรับ "ใบจอง" จากพนักงาน ภายใน 30 นาที
  → ถ้าไม่ได้รับใบจองภายใน 30 นาที ให้ติดต่อแอดมินอีกครั้ง

⚠️ หากไม่มารับรถภายใน 1 ชั่วโมงจากเวลานัด ถือว่ายกเลิกอัตโนมัติ

═══════════════════════════════
🕐  เวลารับ-คืนรถ
═══════════════════════════════
- รับรถและคืนรถต้องอยู่ในเวลาทำการ 08:00–20:00 น. เท่านั้น
- ยกเว้น: เช่ามากกว่า 10 วัน สามารถนัดเวลารับ-คืนรถได้ตั้งแต่ 09:00–20:00 น.
- ห้ามนัดรับ/คืนรถนอกเวลาทำการ ไม่ว่ากรณีใดก็ตาม (ยกเว้นตามเงื่อนไขข้างต้น)

═══════════════════════════════
🤖  กฎการตอบ
═══════════════════════════════
- เมื่อลูกค้าถามว่ารถว่างไหม / อยากดูรถ / สอบถามราคา:
  ต้องรู้ วัน+เวลารับรถ และ วัน+เวลาคืนรถ ก่อน ถ้าลูกค้าบอกไม่ครบ (เช่นบอกแค่วัน) ให้ถามเวลาก่อน ห้ามเดาเวลาเอง
  เช็คว่าเวลาอยู่ในเวลาทำการตามกฎด้านบน ถ้าไม่อยู่ ให้แจ้งลูกค้าและขอเวลาใหม่ก่อนเช็ค
  จากนั้นใช้ tool check_availability แล้วแสดงรุ่นที่ว่างพร้อมราคารวมตามที่ tool คืนมาเท่านั้น
  ห้ามคำนวณราคาเอง ใช้ตัวเลขจาก tool เสมอ (ระบบคิดโปรและค่าเกินเวลาให้แล้ว)
  ถ้ามีค่าเกินเวลา (overtime) ให้บอกลูกค้าด้วยว่าเพราะเวลาคืนเลยเวลารับ และแนะนำว่าถ้าคืนเวลาเดียวกับที่รับจะไม่มีค่าส่วนนี้
  แล้วถามว่า "สนใจรุ่นไหนครับ หรือจะจองเลยไหมครับ?" ห้ามเร่งให้จอง รอให้ลูกค้าตัดสินใจเองก่อน

- เมื่อลูกค้าตัดสินใจจองแล้ว:
  ถามชื่อ-นามสกุล และ เบอร์โทรศัพท์
  จากนั้นใช้ tool create_booking บันทึกจอง (ใช้วันเวลาเดียวกับที่เช็ค)
  แจ้ง booking ref และบอกให้รอรับใบจองจากพนักงานภายใน 30 นาที
  ถ้า tool แจ้งว่ารุ่นนั้นเต็มแล้ว ให้ขอโทษ แล้วเช็คใหม่เพื่อเสนอรุ่นอื่น

- ถ้าลูกค้าถามเรื่องของร้านที่ไม่มีข้อมูลอยู่ในนี้ ห้ามเดาหรือแต่งคำตอบเด็ดขาด
  ให้ตอบว่า "ขอเช็คกับแอดมินก่อนนะครับ เดี๋ยวแอดมินจะตอบกลับครับ" หรือให้โทร 065-5268531`

// ─── Anthropic tool definitions ───────────────────────────────────────────────
const DATETIME_DESC = 'เวลาไทย format YYYY-MM-DDTHH:mm เช่น 2026-10-05T10:00'
const TOOLS = [
  {
    name: 'check_availability',
    description: 'เช็ครถว่างตามวันเวลารับ-คืนที่ลูกค้าต้องการ คืนรายการรุ่นที่ว่างพร้อมราคารวม (คิดโปรและค่าเกินเวลาตามระบบร้านแล้ว)',
    input_schema: {
      type: 'object' as const,
      properties: {
        start_datetime: { type: 'string', description: `วันเวลารับรถ ${DATETIME_DESC}` },
        end_datetime:   { type: 'string', description: `วันเวลาคืนรถ ${DATETIME_DESC}` },
      },
      required: ['start_datetime', 'end_datetime'],
    },
  },
  {
    name: 'create_booking',
    description: 'สร้างการจองคิวตามรุ่นสำหรับลูกค้า ระบบคิดราคาเอง คืน booking_ref ถ้าสำเร็จ',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_name:  { type: 'string', description: 'ชื่อ-นามสกุลลูกค้า' },
        customer_phone: { type: 'string', description: 'เบอร์โทรศัพท์' },
        start_datetime: { type: 'string', description: `วันเวลารับรถ ${DATETIME_DESC}` },
        end_datetime:   { type: 'string', description: `วันเวลาคืนรถ ${DATETIME_DESC}` },
        brand:          { type: 'string', description: 'ยี่ห้อรถ ตามที่ check_availability คืนมา' },
        model:          { type: 'string', description: 'รุ่นรถ ตามที่ check_availability คืนมา' },
      },
      required: ['customer_name', 'customer_phone', 'start_datetime', 'end_datetime', 'brand', 'model'],
    },
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function verifySignature(body: string, sig: string, secret: string): boolean {
  const hash = crypto.createHmac('SHA256', secret).update(body).digest('base64')
  return hash === sig
}

function genRef(): string {
  const d = new Date()
  const yy = String(d.getFullYear()).slice(-2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `KM${yy}${mm}${dd}-${Math.floor(Math.random() * 9000) + 1000}`
}

// เวลาไทยแบบไม่มีโซน → utcIso สำหรับ DB/ค้นหา (ตัวแปลงเดียวกับทุกฟอร์มในแอป)
// และ wall = Date ที่ "นาฬิกา UTC เท่ากับนาฬิกาไทย" สำหรับสูตรราคา — pricing.ts นับวันปฏิทินด้วย getter
// แบบ local ซึ่งบนมือถือพนักงานคือเวลาไทย แต่บน Vercel คือ UTC ต้องเลื่อนให้ตรงก่อน ไม่งั้นนับวันเพี้ยน
function parseBkk(local: unknown): { utcIso: string; wall: Date } | null {
  if (typeof local !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null
  const wall = new Date(`${local}:00Z`)
  if (isNaN(wall.getTime())) return null
  return { utcIso: bangkokToUTC(local), wall }
}

// ราคาเดียวกับหน้าจองของพนักงานเป๊ะ — โปร 7 วันจ่าย N + cap รายเดือน + ค่าเกินเวลา
function quoteFor(start: Date, end: Date, dailyRate: number, monthlyRate: number | null, payDays: number) {
  const days = calendarDays(start, end)
  const quote = calcRentQuote(start, days, dailyRate, monthlyRate ?? dailyRate * 30, payDays)
  const overtimeHours = calcExcessHours(start, end, days)
  const overtime = calcOvertimeCharge(overtimeHours, dailyRate)
  const promoApplied = !quote.isLong && !!quote.shortResult && quote.shortResult.calcDays < days
  return { days, rentTotal: quote.total, overtimeHours, overtime, total: quote.total + overtime, promoApplied }
}

function validatePeriod(input: Record<string, unknown>) {
  const s = parseBkk(input.start_datetime)
  const e = parseBkk(input.end_datetime)
  if (!s || !e) return { error: 'รูปแบบวันเวลาไม่ถูกต้อง ต้องเป็น YYYY-MM-DDTHH:mm (เวลาไทย)' } as const
  if (e.wall <= s.wall) return { error: 'เวลาคืนรถต้องหลังเวลารับรถ' } as const
  if (s.utcIso < new Date().toISOString()) return { error: 'เวลารับรถเป็นเวลาที่ผ่านมาแล้ว' } as const
  return { s, e } as const
}

// ─── Tool execution ───────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeTool(name: string, input: Record<string, any>, branchId: string) {
  const supabase = createAdminClient()

  if (name === 'check_availability') {
    const period = validatePeriod(input)
    if ('error' in period) return { error: period.error }
    const { s, e } = period

    // ค้นด้วยตัวกลางตัวเดียวกับหน้าค้นหาของพนักงาน — ผลตรงกับแอปเสมอ
    const { bikes } = await searchBikes(supabase, [branchId], s.utcIso, e.utcIso)

    // จัดกลุ่มรายรุ่นแบบเดียวกับหน้าค้นหา (รุ่นเดียวกันแต่ราคาต่างกัน แยกกลุ่ม)
    const groups = new Map<string, { brand: string; model: string; daily_rate: number; monthly_rate: number | null; promo_pay_days: number; count: number }>()
    for (const b of bikes) {
      if (!b.available) continue
      const key = `${b.brand}__${b.model}__${b.daily_rate}__${b.monthly_rate ?? ''}`
      if (!groups.has(key)) groups.set(key, { brand: b.brand, model: b.model, daily_rate: b.daily_rate, monthly_rate: b.monthly_rate, promo_pay_days: b.promo_pay_days, count: 0 })
      groups.get(key)!.count++
    }

    if (groups.size === 0) return { available: false, message: 'ไม่มีรถว่างในช่วงเวลานี้' }

    const models = Array.from(groups.values()).map(g => {
      const q = quoteFor(s.wall, e.wall, g.daily_rate, g.monthly_rate, g.promo_pay_days)
      return {
        brand: g.brand,
        model: g.model,
        available_count: g.count,
        daily_rate: g.daily_rate,
        rental_days: q.days,
        rent_total: q.rentTotal,
        promo: q.promoApplied ? `โปร 7 วันจ่าย ${g.promo_pay_days} วัน` : null,
        overtime_hours: q.overtimeHours,
        overtime_charge: q.overtime,
        total: q.total,
      }
    }).sort((a, b) => a.total - b.total)

    return { available: true, models }
  }

  if (name === 'create_booking') {
    const period = validatePeriod(input)
    if ('error' in period) return { success: false, error: period.error }
    const { s, e } = period

    // เช็คซ้ำตอนจองจริง + คิดราคาจากระบบเอง (ไม่เชื่อตัวเลขจาก AI) — กันคิวถูกแย่งระหว่างคุย
    const norm = (v: unknown) => String(v ?? '').trim().toLowerCase()
    const { bikes } = await searchBikes(supabase, [branchId], s.utcIso, e.utcIso)
    const bike = bikes.find(b => b.available && norm(b.brand) === norm(input.brand) && norm(b.model) === norm(input.model))
    if (!bike) return { success: false, error: 'รุ่นนี้ไม่ว่างแล้วในช่วงเวลานี้' }

    const q = quoteFor(s.wall, e.wall, bike.daily_rate, bike.monthly_rate, bike.promo_pay_days)

    // หา staff คนแรกของสาขา (ใช้เป็น staff_id ของ bot)
    const { data: staffRow } = await supabase
      .from('staff').select('id').eq('branch_id', branchId).limit(1).maybeSingle()

    // เช็คแบล็คลิสต์แบบเดียวกับหน้าจองของพนักงาน — ไม่บล็อก แค่แท็กเตือนพนักงาน (ไม่บอกลูกค้า)
    const blacklistHit = await checkBlacklist(supabase, { name: input.customer_name, phone: input.customer_phone })

    const { data: booking, error } = await supabase.from('bookings').insert({
      branch_id:            branchId,
      bike_id:              null,
      requested_brand:      bike.brand,
      requested_model:      bike.model,
      requested_daily_rate: bike.daily_rate,
      staff_id:             staffRow?.id ?? null,
      customer_name:        input.customer_name,
      customer_phone:       input.customer_phone,
      start_datetime:       s.utcIso,
      end_datetime:         e.utcIso,
      total_days:           q.days,
      daily_rate:           bike.daily_rate,
      total_amount:         q.total,
      discount:             0,
      source:               'line',
      status:               'confirmed',
      booking_ref:          genRef(),
      ...(blacklistHit ? {
        blacklist_watch: true,
        blacklist_watch_reason: `ชื่อ/เบอร์ตรงกับแบล็คลิสต์ "${blacklistHit.name}"${blacklistHit.reason ? ` — ${blacklistHit.reason}` : ''} (ตรงจาก${blacklistHit.matchedBy === 'phone' ? 'เบอร์โทร' : 'ชื่อ'}) — จองผ่าน LINE bot`,
      } : {}),
    }).select('booking_ref').single()

    if (error || !booking) {
      console.error('LINE bot booking insert error:', error)
      return { success: false, error: 'บันทึกการจองไม่สำเร็จ' }
    }
    return { success: true, booking_ref: booking.booking_ref, total: q.total }
  }

  return { error: 'unknown tool' }
}

// ─── Claude call ──────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callClaude(messages: unknown[]): Promise<any> {
  // บอกวันเวลาปัจจุบัน — ไม่งั้นบอทตีความ "พรุ่งนี้/เสาร์นี้" ไม่ได้
  const now = new Date()
  const weekday = now.toLocaleDateString('th-TH', { weekday: 'long', timeZone: 'Asia/Bangkok' })
  const system = `${SYSTEM_PROMPT}\n\nวันเวลาปัจจุบัน (เวลาไทย): ${utcToBangkokLocal(now.toISOString())} (${weekday})`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system,
      tools: TOOLS,
      messages,
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    console.error('Claude error:', res.status, errText)
    throw new Error(`Claude API ${res.status}: ${errText.slice(0, 300)}`)
  }
  return res.json()
}

// ─── Main webhook ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const rawBody  = await request.text()
  const lineSig  = request.headers.get('x-line-signature') ?? ''

  // หา branch config จาก channel secret
  const config = BRANCH_CONFIGS[Object.keys(BRANCH_CONFIGS).find(
    s => s && verifySignature(rawBody, lineSig, s)
  ) ?? '']

  if (!config) {
    // ไม่ match channel secret ไหนเลย — ตอบ 200 เฉยๆ (LINE ต้องการ 200 เสมอ)
    return NextResponse.json({ ok: true })
  }

  const supabase = createAdminClient()

  // หา branch_id จากชื่อสาขา + เช็ค bot enabled
  const { data: branch } = await supabase
    .from('branches').select('id')
    .ilike('name', config.branchNameLike)
    .limit(1).maybeSingle()

  if (!branch) return NextResponse.json({ ok: true })

  // เช็คว่า bot เปิดอยู่ไหม (default true ถ้าไม่มี row)
  const { data: botSetting } = await supabase
    .from('branch_settings')
    .select('line_bot_enabled')
    .eq('branch_id', branch.id)
    .maybeSingle()
  if (botSetting?.line_bot_enabled === false) return NextResponse.json({ ok: true })

  const body = JSON.parse(rawBody)

  for (const event of body.events ?? []) {
    if (event.type !== 'message' || event.message?.type !== 'text') continue

    const userId    = event.source.userId as string
    const userText  = event.message.text as string
    const replyToken = event.replyToken as string

    try {
      // โหลด conversation history
      const { data: session } = await supabase
        .from('line_chat_sessions')
        .select('messages')
        .eq('line_user_id', userId)
        .eq('branch_id', branch.id)
        .maybeSingle()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const history: any[] = session?.messages ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let messages: any[] = [...history, { role: 'user', content: userText }].slice(-20)

      // เรียก Claude + handle tool use loop
      let response = await callClaude(messages)
      let loopCount = 0

      while (response.stop_reason === 'tool_use' && loopCount < 5) {
        loopCount++
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolBlock = response.content.find((c: any) => c.type === 'tool_use')
        if (!toolBlock) break

        const toolResult = await executeTool(toolBlock.name, toolBlock.input, branch.id)

        messages = [
          ...messages,
          { role: 'assistant', content: response.content },
          { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolBlock.id, content: JSON.stringify(toolResult) }] },
        ]
        response = await callClaude(messages)
      }

      // ดึง text response
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textBlock = response.content?.find((c: any) => c.type === 'text')
      const replyText: string = textBlock?.text ?? 'ขออภัยครับ เกิดข้อผิดพลาด กรุณาลองใหม่หรือโทรหาร้านโดยตรงครับ'

      // ส่งกลับ LINE
      await lineReply(config.token, replyToken, [{ type: 'text', text: replyText }])

      // บันทึก history (เก็บแค่ 20 messages ล่าสุด)
      const updatedHistory = [
        ...messages.filter(m => typeof m.content === 'string'),
        { role: 'assistant', content: replyText },
      ].slice(-20)

      await supabase.from('line_chat_sessions').upsert({
        line_user_id: userId,
        branch_id: branch.id,
        messages: updatedHistory,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'line_user_id,branch_id' })

    } catch (err) {
      console.error('LINE chat error:', err)
      await lineReply(config.token, replyToken, [{
        type: 'text',
        text: 'ขออภัยครับ ระบบขัดข้องชั่วคราว กรุณาโทร 065-5268531 ครับ',
      }])
    }
  }

  return NextResponse.json({ ok: true })
}
