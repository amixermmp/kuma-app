import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { lineReply } from '@/lib/line'

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
ตอบเป็นภาษาไทยเสมอ ใช้คำสุภาพ ลงท้ายประโยคด้วย "ครับ" เสมอ
ห้ามพูดถึงเรื่องที่ไม่เกี่ยวกับร้านเช่ารถ ถ้าถามเรื่องอื่นให้บอกว่าไม่ทราบ

═══════════════════════════════
🏍️  ข้อมูลร้าน
═══════════════════════════════
- ชื่อร้าน: คุมะมอ สาขาเกษตร-นวมินทร์
- เปิด: ทุกวัน 08:00–20:00 น.
- โทร: (กรุณาใส่เบอร์ร้านที่นี่)

═══════════════════════════════
💰  ราคาและเงื่อนไขการเช่า
═══════════════════════════════
- ราคาขึ้นอยู่กับรุ่นรถ เริ่มต้น ~230 บาท/วัน
- เงินมัดจำ: 500–1,000 บาท ขึ้นอยู่กับรุ่น (คืนเมื่อส่งรถ)
- เช่าขั้นต่ำ 1 วัน (24 ชั่วโมง)
- ราคารายสัปดาห์และรายเดือนถูกกว่า ถามเจ้าหน้าที่ได้เลย

═══════════════════════════════
📋  เงื่อนไขการใช้งาน
═══════════════════════════════
- ผู้เช่าต้องมีใบขับขี่ประเภท ข. (มอเตอร์ไซค์) หรือ ค. (รถยนต์) ที่ยังไม่หมดอายุ
- ห้ามนำรถออกนอกเขตกรุงเทพฯ และปริมณฑล โดยไม่แจ้งร้านก่อน
- ห้ามให้บุคคลอื่นขับรถแทน
- กรณีรถเสียระหว่างเช่า ต้องแจ้งร้านทันที ห้ามซ่อมเองโดยไม่ได้รับอนุญาต
- ผู้เช่าต้องรับผิดชอบค่าเสียหายที่เกิดจากการใช้งานผิดปกติ
- ต้องคืนรถตามเวลาที่นัด มิฉะนั้นคิดเพิ่มตามจริง

═══════════════════════════════
📅  การจอง
═══════════════════════════════
- จองล่วงหน้าได้ ไม่มีค่าธรรมเนียม
- หากไม่มารับรถภายใน 1 ชั่วโมงจากเวลานัด ถือว่ายกเลิก
- ต้องการยืนยันจอง ต้องแจ้ง: ชื่อ, เบอร์โทร, วันเริ่มเช่า, วันคืนรถ

เมื่อลูกค้าสนใจเช่าหรือจอง ให้ถามข้อมูลต่อไปนี้ให้ครบก่อน:
1. วันที่ต้องการเช่า (วัน/เดือน/ปี หรือวันเริ่มต้น–สิ้นสุด)
2. รุ่นรถที่สนใจ (ถ้ามี) หรือบอกความต้องการ
3. ชื่อ-นามสกุล
4. เบอร์โทรศัพท์
จากนั้นใช้ tool เพื่อเช็ครถว่างและจองให้ทันที`

// ─── Anthropic tool definitions ───────────────────────────────────────────────
const TOOLS = [
  {
    name: 'check_availability',
    description: 'เช็ครถว่างในช่วงวันที่ที่ลูกค้าต้องการ คืนรายการรถว่างพร้อมราคาต่อวัน',
    input_schema: {
      type: 'object' as const,
      properties: {
        start_date: { type: 'string', description: 'วันเริ่มเช่า format YYYY-MM-DD' },
        end_date: { type: 'string', description: 'วันคืนรถ format YYYY-MM-DD' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'create_booking',
    description: 'สร้างการจองคิวสำหรับลูกค้า คืน booking_ref ถ้าสำเร็จ',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_name:  { type: 'string', description: 'ชื่อ-นามสกุลลูกค้า' },
        customer_phone: { type: 'string', description: 'เบอร์โทรศัพท์' },
        start_date:     { type: 'string', description: 'วันเริ่มเช่า YYYY-MM-DD' },
        end_date:       { type: 'string', description: 'วันคืนรถ YYYY-MM-DD' },
        brand:          { type: 'string', description: 'ยี่ห้อรถ เช่น Honda, Yamaha' },
        model:          { type: 'string', description: 'รุ่นรถ เช่น Scoopy-i, PCX' },
        daily_rate:     { type: 'number', description: 'ราคาต่อวัน (บาท)' },
      },
      required: ['customer_name', 'customer_phone', 'start_date', 'end_date', 'brand', 'model', 'daily_rate'],
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

// ─── Tool execution ───────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeTool(name: string, input: Record<string, any>, branchId: string) {
  const supabase = createAdminClient()
  const BKK = 'Asia/Bangkok'

  if (name === 'check_availability') {
    const startUtc = new Date(`${input.start_date}T00:00:00+07:00`).toISOString()
    const endUtc   = new Date(`${input.end_date}T23:59:59+07:00`).toISOString()
    const bufMs    = 3 * 3_600_000
    const bufStart = new Date(new Date(startUtc).getTime() - bufMs).toISOString()
    const bufEnd   = new Date(new Date(endUtc).getTime()   + bufMs).toISOString()
    const nowIso   = new Date().toISOString()

    const [{ data: bikes }, { data: rentals }, { data: monthlies }, { data: bookings }] = await Promise.all([
      supabase.from('bikes').select('id, brand, model, daily_rate, status')
        .eq('branch_id', branchId)
        .not('status', 'in', '("repair","maintenance","locked","retired","inactive")'),
      supabase.from('rentals').select('bike_id, expected_end_datetime')
        .in('status', ['active', 'extended'])
        .lt('start_datetime', bufEnd),
      supabase.from('monthly_rentals').select('bike_id').eq('status', 'active'),
      supabase.from('bookings').select('bike_id, requested_brand, requested_model')
        .eq('branch_id', branchId).eq('status', 'confirmed')
        .lt('start_datetime', bufEnd).gt('end_datetime', bufStart),
    ])

    const busyIds = new Set<string>()
    for (const r of rentals ?? []) {
      if (r.expected_end_datetime <= nowIso || r.expected_end_datetime > bufStart) busyIds.add(r.bike_id)
    }
    for (const m of monthlies ?? []) busyIds.add(m.bike_id)
    for (const b of bookings ?? []) { if (b.bike_id) busyIds.add(b.bike_id) }

    // นับ model-based bookings ที่กินสล็อต
    const modelBookingCount = new Map<string, number>()
    for (const b of bookings ?? []) {
      if (!b.bike_id && b.requested_brand && b.requested_model) {
        const k = `${b.requested_brand}__${b.requested_model}`
        modelBookingCount.set(k, (modelBookingCount.get(k) ?? 0) + 1)
      }
    }
    const modelBookingUsed = new Map<string, number>()

    const days = Math.max(1, Math.ceil((new Date(endUtc).getTime() - new Date(startUtc).getTime()) / 86_400_000))

    // Group available bikes by model
    const modelMap = new Map<string, { brand: string; model: string; daily_rate: number; count: number }>()
    for (const bike of bikes ?? []) {
      if (busyIds.has(bike.id)) continue
      const k = `${bike.brand}__${bike.model}__${bike.daily_rate}`
      const booked = modelBookingCount.get(`${bike.brand}__${bike.model}`) ?? 0
      const used   = modelBookingUsed.get(k) ?? 0
      if (used < booked) { modelBookingUsed.set(k, used + 1); continue }
      if (!modelMap.has(k)) modelMap.set(k, { brand: bike.brand, model: bike.model, daily_rate: bike.daily_rate, count: 0 })
      modelMap.get(k)!.count++
    }

    const available = Array.from(modelMap.values()).sort((a, b) => a.daily_rate - b.daily_rate)

    if (available.length === 0) {
      return { available: false, message: 'ไม่มีรถว่างในช่วงวันที่นี้' }
    }

    const fmt = (d: string) => new Date(d).toLocaleDateString('th-TH', { timeZone: BKK, day: 'numeric', month: 'short', year: 'numeric' })
    return {
      available: true,
      period: `${fmt(startUtc)} – ${fmt(endUtc)} (${days} วัน)`,
      bikes: available.map(b => ({
        brand: b.brand,
        model: b.model,
        daily_rate: b.daily_rate,
        total: b.daily_rate * days,
        available_count: b.count,
      })),
    }
  }

  if (name === 'create_booking') {
    const startUtc = new Date(`${input.start_date}T09:00:00+07:00`).toISOString()
    const endUtc   = new Date(`${input.end_date}T09:00:00+07:00`).toISOString()
    const days     = Math.max(1, Math.ceil((new Date(endUtc).getTime() - new Date(startUtc).getTime()) / 86_400_000))

    // หา staff คนแรกของสาขา (ใช้เป็น staff_id ของ bot)
    const { data: staffRow } = await supabase
      .from('staff').select('id').eq('branch_id', branchId).limit(1).maybeSingle()

    const { data: booking, error } = await supabase.from('bookings').insert({
      branch_id:        branchId,
      bike_id:          null,
      requested_brand:  input.brand,
      requested_model:  input.model,
      requested_daily_rate: input.daily_rate,
      staff_id:         staffRow?.id ?? null,
      customer_name:    input.customer_name,
      customer_phone:   input.customer_phone,
      start_datetime:   startUtc,
      end_datetime:     endUtc,
      total_days:       days,
      daily_rate:       input.daily_rate,
      total_amount:     input.daily_rate * days,
      discount:         0,
      source:           'line',
      status:           'confirmed',
      booking_ref:      genRef(),
    }).select('booking_ref').single()

    if (error || !booking) {
      return { success: false, error: 'บันทึกการจองไม่สำเร็จ' }
    }
    return { success: true, booking_ref: booking.booking_ref }
  }

  return { error: 'unknown tool' }
}

// ─── Claude call ──────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callClaude(messages: unknown[]): Promise<any> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    }),
  })
  if (!res.ok) {
    console.error('Claude error:', res.status, await res.text())
    throw new Error('Claude API error')
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

  // หา branch_id จากชื่อสาขา
  const { data: branch } = await supabase
    .from('branches').select('id')
    .ilike('name', config.branchNameLike)
    .limit(1).maybeSingle()

  if (!branch) return NextResponse.json({ ok: true })

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
        text: 'ขออภัยครับ ระบบขัดข้องชั่วคราว กรุณาโทรหาร้านโดยตรงครับ',
      }])
    }
  }

  return NextResponse.json({ ok: true })
}
