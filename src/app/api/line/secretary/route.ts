import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { lineReply, linePush, textMessage } from '@/lib/line'
import { utcToBangkokLocal, bangkokToUTC } from '@/lib/time'
import { searchBikes } from '@/lib/bikeSearch'
import { findBike, findCustomer, revenue, listActiveRentals, queryTable, describeTable, todayBkk, clip, QUERYABLE_TABLES } from '@/lib/secretaryTools'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// "เลขา" ของเจ้าของ — บอท LINE ตัวที่ส่งรายงานเข้ากลุ่มเจ้าของ (คนละตัวกับบอทตอบลูกค้า)
// รับเฉพาะข้อความที่ขึ้นต้นด้วยคำปลุก และมาจากกลุ่มเจ้าของ (shop_settings.line_target_id) เท่านั้น — อ่านข้อมูลอย่างเดียว ไม่มีคำสั่งเขียน
const WAKE_WORD = 'ถุงเท้า'
const MODELS = ['claude-sonnet-5-5', 'claude-haiku-4-5'] // ตัวแรกแม่นกว่า ถ้าเรียกไม่ได้ถอยไปตัวถัดไป
const MAX_TOOL_LOOPS = 10

const SYSTEM_PROMPT = (now: string, today: string) => `คุณคือ "${WAKE_WORD}" เลขาส่วนตัวของเจ้าของร้านเช่ามอเตอร์ไซค์ (3 สาขา: KUMA สาขามอเกษตร, KUMA สาขาบางแสน, ZAME สาขาศรีราชา)
ผู้ที่คุยด้วยคือเจ้าของร้าน (สิทธิ์เต็ม ดูข้อมูลได้ทุกอย่างทุกสาขา) หน้าที่คือค้นหาข้อมูลในระบบมาตอบ

กฎ:
- ตอบภาษาไทย สุภาพ กระชับ ลงท้าย "ครับ" ห้ามใช้ markdown (LINE แสดงไม่ได้) ใช้ข้อความธรรมดา ขึ้นบรรทัดใหม่ได้ ใช้ emoji เล็กน้อยได้
- ต้องใช้เครื่องมือค้นข้อมูลจริงทุกครั้ง ห้ามเดาหรือแต่งตัวเลข/ชื่อ/วันที่ ถ้าค้นแล้วไม่เจอให้บอกตรงๆ
- อ่านอย่างเดียว ไม่แก้ ไม่ลบ ไม่ส่งข้อความหาลูกค้า ถ้าถูกขอให้แก้ข้อมูล ให้บอกว่าทำไม่ได้ ให้ทำในแอป
- ถ้าพิมพ์มาแค่ทะเบียน หรือเลขท้ายทะเบียน (เช่น "5กฆ 8525", "8525") ให้ใช้ find_bike แล้วตอบ: รถอะไร สถานะ ตอนนี้ใครเช่าอยู่ (รายวัน/รายสัปดาห์/รายเดือน) กำหนดคืนวันไหน เหลือกี่วันหรือเลยกำหนดแล้ว สาขา ถ้าไม่มีคนเช่าให้บอกว่าว่าง/ซ่อม/ล็อก ตามสถานะ
- ถ้าตรงหลายคัน ให้ถามกลับว่าคันไหน
- ถามว่ารถว่างไหม/คันไหนว่างให้จองในช่วงวันเวลา: ใช้ check_availability (แปลงวันเวลาจากที่พิมพ์เป็น YYYY-MM-DDTHH:mm เวลาไทย ปีใช้ปีปัจจุบันตามวันนี้ ถ้าไม่บอกเวลาให้ถามกลับ) แล้วสรุปรุ่น/จำนวน/ทะเบียนที่ว่าง และถ้าอยากรู้ว่าคันไหนไม่ว่างเพราะอะไร ก็บอกเหตุผลสั้นๆ
- รายได้: ใช้ tool revenue เท่านั้น (นับใบเสร็จตามวันที่เก็บเงินจริง ไม่รวมยอดจอง/มัดจำ ไม่ใช้ยอดรวมของสัญญา)
- คำถามอื่นที่ไม่มีเครื่องมือเฉพาะ: ใช้ describe_table ดูคอลัมน์ แล้ว query_table ค้นให้ตรงคำถาม
- วันที่ที่แสดงใช้รูปแบบไทยสั้นๆ เช่น "20 ต.ค." และเวลาเป็นเวลาไทย
- ตารางหลัก: rentals (สัญญารายวัน/สัปดาห์ status: active/extended/overdue/returned/converted/cancelled), monthly_rentals (รายเดือน status: active/ended), rental_payments / monthly_payments (ใบเสร็จ มี voided_at ถ้ายกเลิก), bikes (status: available/rented/repair/locked), customers, bookings, repairs, bike_routines (รูทีนซ่อมบำรุง), expenses, bike_documents (ภาษี/พ.ร.บ.)

ตอนนี้ (เวลาไทย): ${now} / วันนี้: ${today}`

const TOOLS = [
  { name: 'find_bike', description: 'ค้นรถจากทะเบียนหรือเลขท้ายทะเบียน คืนข้อมูลรถ ใครเช่าอยู่ตอนนี้ (รายวัน/รายเดือน) กำหนดคืน งานซ่อมที่เปิดอยู่ คิวจอง รูทีนซ่อมบำรุง และคนที่เช่าล่าสุด',
    input_schema: { type: 'object' as const, properties: { query: { type: 'string', description: 'ทะเบียนหรือเลขท้าย เช่น "5กฆ 8525" หรือ "8525"' } }, required: ['query'] } },
  { name: 'find_customer', description: 'ค้นลูกค้าจากชื่อหรือเบอร์โทร คืนสัญญาที่ใช้อยู่ของลูกค้านั้น',
    input_schema: { type: 'object' as const, properties: { query: { type: 'string', description: 'ชื่อ หรือเบอร์โทร (อย่างน้อย 4 หลัก)' } }, required: ['query'] } },
  { name: 'revenue', description: 'รายได้รวมตามช่วงวันที่ (เวลาไทย) แยกตามสาขาและประเภท นับตามใบเสร็จที่เก็บเงินจริง ไม่รวมมัดจำ/ยอดจอง',
    input_schema: { type: 'object' as const, properties: { from: { type: 'string', description: 'วันเริ่ม YYYY-MM-DD' }, to: { type: 'string', description: 'วันสุดท้าย YYYY-MM-DD (รวมวันนี้)' }, branch: { type: 'string', description: 'ชื่อสาขาบางส่วน เช่น "มอเกษตร" "บางแสน" "ศรีราชา" (ไม่ใส่ = ทุกสาขา)' } }, required: ['from', 'to'] } },
  { name: 'list_active_rentals', description: 'รายการสัญญาที่ใช้งานอยู่ตอนนี้ (รายวัน/สัปดาห์ + รายเดือน) เรียงตามกำหนดคืน ใช้ถามว่าใครเลยกำหนด/ใครใกล้คืน',
    input_schema: { type: 'object' as const, properties: { branch: { type: 'string', description: 'ชื่อสาขาบางส่วน (ไม่ใส่ = ทุกสาขา)' }, overdue_only: { type: 'boolean', description: 'true = เฉพาะที่เลยกำหนดคืนแล้ว' } } } },
  { name: 'check_availability', description: 'เช็กรถว่างตามช่วงวันเวลารับ-คืนที่ต้องการ (ใช้ตัวค้นหาเดียวกับหน้าค้นหาของพนักงาน นับสัญญา รายเดือน คิวจอง งานซ่อม ล็อค ครบแล้ว) คืนรุ่นและทะเบียนที่ว่าง กับคันที่ไม่ว่างพร้อมเหตุผล ใช้เมื่อถามว่ารถว่างไหม/คันไหนว่างให้จอง',
    input_schema: { type: 'object' as const, properties: { start: { type: 'string', description: 'วัน-เวลารับ เวลาไทย รูปแบบ YYYY-MM-DDTHH:mm เช่น 2026-10-21T10:00' }, end: { type: 'string', description: 'วัน-เวลาคืน เวลาไทย YYYY-MM-DDTHH:mm' }, branch: { type: 'string', description: 'ชื่อสาขาบางส่วน เช่น "บางแสน" "มอเกษตร" "ศรีราชา" (ไม่ใส่ = ทุกสาขา)' } }, required: ['start', 'end'] } },
  { name: 'describe_table', description: `ดูชื่อคอลัมน์ของตาราง (อนุญาต: ${QUERYABLE_TABLES.join(', ')})`,
    input_schema: { type: 'object' as const, properties: { table: { type: 'string' } }, required: ['table'] } },
  { name: 'query_table', description: 'ค้นตารางทั่วไป (อ่านอย่างเดียว) สำหรับคำถามที่ไม่มีเครื่องมือเฉพาะ ใช้ describe_table ดูคอลัมน์ก่อนถ้าไม่แน่ใจ',
    input_schema: { type: 'object' as const, properties: {
      table: { type: 'string' },
      select: { type: 'string', description: 'คอลัมน์ที่ต้องการ เช่น "id,status,bikes(license_plate)" (ไม่ใส่ = ทุกคอลัมน์)' },
      filters: { type: 'array', items: { type: 'object', properties: { column: { type: 'string' }, op: { type: 'string', enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in'] }, value: {} }, required: ['column', 'op', 'value'] } },
      order_by: { type: 'string' }, ascending: { type: 'boolean' }, limit: { type: 'number', description: 'ไม่เกิน 100' },
    }, required: ['table'] } },
]

function verifySignature(body: string, sig: string, secret: string): boolean {
  const hash = crypto.createHmac('SHA256', secret).update(body).digest('base64')
  return hash.length === sig.length && crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(sig))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkAvailability(db: any, start: string, end: string, branch?: string) {
  const re = /^d{4}-d{2}-d{2}Td{2}:d{2}$/
  if (!re.test(String(start)) || !re.test(String(end))) return { error: 'วัน-เวลาต้องเป็นรูปแบบ YYYY-MM-DDTHH:mm (เวลาไทย)' }
  if (new Date(end) <= new Date(start)) return { error: 'เวลาคืนต้องหลังเวลารับ' }
  const { data: branches } = await db.from('branches').select('id, name')
  const picked = branch ? (branches ?? []).filter((b: { name: string }) => b.name.includes(branch)) : (branches ?? [])
  if (branch && picked.length === 0) return { error: `ไม่พบสาขาที่ชื่อมีคำว่า "${branch}"`, branches: (branches ?? []).map((b: { name: string }) => b.name) }
  const { bikes } = await searchBikes(db, picked.map((b: { id: string }) => b.id), bangkokToUTC(start), bangkokToUTC(end))
  const byModel = new Map<string, { model: string; branch: string; plates: string[] }>()
  const unavailable: { plate: string; model: string; reason: string }[] = []
  for (const b of bikes as { brand: string; model: string; license_plate: string; branch_id: string; available: boolean; conflict_reason?: string }[]) {
    const branchName = (branches ?? []).find((x: { id: string }) => x.id === b.branch_id)?.name ?? ''
    if (b.available) {
      const key = `${branchName}|${b.brand} ${b.model}`
      const row = byModel.get(key) ?? { model: `${b.brand} ${b.model}`, branch: branchName, plates: [] as string[] }
      row.plates.push(b.license_plate)
      byModel.set(key, row)
    } else unavailable.push({ plate: b.license_plate, model: `${b.brand} ${b.model}`, reason: b.conflict_reason ?? '' })
  }
  const available = Array.from(byModel.values()).map(r => ({ ...r, count: r.plates.length }))
  return { period: `${start} ถึง ${end} (เวลาไทย)`, branch: branch ?? 'ทุกสาขา', available_total: available.reduce((n, r) => n + r.count, 0), available, unavailable_total: unavailable.length, unavailable: unavailable.slice(0, 40) }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runTool(db: any, name: string, input: any) {
  switch (name) {
    case 'find_bike': return findBike(db, input.query)
    case 'find_customer': return findCustomer(db, input.query)
    case 'revenue': return revenue(db, input.from, input.to, input.branch)
    case 'list_active_rentals': return listActiveRentals(db, input.branch, !!input.overdue_only)
    case 'check_availability': return checkAvailability(db, input.start, input.end, input.branch)
    case 'describe_table': return describeTable(db, input.table)
    case 'query_table': return queryTable(db, input)
    default: return { error: 'unknown tool' }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callClaude(messages: unknown[], system: string, withTools = true): Promise<any> {
  let lastErr = ''
  for (const model of MODELS) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 1500, system, ...(withTools ? { tools: TOOLS } : {}), messages }),
    })
    if (res.ok) return res.json()
    lastErr = `${model} ${res.status}: ${(await res.text()).slice(0, 200)}`
    console.error('[secretary] Claude error:', lastErr)
  }
  throw new Error(lastErr)
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const secret = process.env.LINE_SECRETARY_SECRET
  if (!secret) {
    console.error('[secretary] LINE_SECRETARY_SECRET is not set')
    return NextResponse.json({ ok: true })
  }
  if (!verifySignature(rawBody, request.headers.get('x-line-signature') ?? '', secret)) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 })
  }

  const db = createAdminClient()
  const { data: shop } = await db.from('shop_settings').select('line_token, line_target_id').limit(1).maybeSingle()
  if (!shop?.line_token || !shop.line_target_id) return NextResponse.json({ ok: true })

  const body = JSON.parse(rawBody)
  for (const event of body.events ?? []) {
    if (event.type !== 'message' || event.message?.type !== 'text') continue
    // รับเฉพาะกลุ่มเจ้าของ (กลุ่มที่รับรายงาน) เท่านั้น
    if (event.source?.type !== 'group' || event.source.groupId !== shop.line_target_id) continue
    const text = String(event.message.text ?? '').trim()
    if (!text.startsWith(WAKE_WORD)) continue
    const question = text.slice(WAKE_WORD.length).replace(/^[\s,:;.!?-]+/, '')
    const replyToken = event.replyToken as string
    const groupId = event.source.groupId as string

    const send = async (msg: string) => {
      const out = msg.length > 4800 ? msg.slice(0, 4800) + '…' : msg
      const ok = await lineReply(shop.line_token, replyToken, [textMessage(out)])
      if (!ok) await linePush(shop.line_token, groupId, [textMessage(out)]) // reply token หมดอายุ → ส่งเข้ากลุ่มแทน
    }

    if (!question) { await send('ครับ มีอะไรให้ช่วยหาครับ (พิมพ์ ถุงเท้า ตามด้วยทะเบียนรถ ชื่อลูกค้า หรือคำถามได้เลยครับ)'); continue }

    try {
      // ประวัติคุย (จำได้ถามต่อได้) เก็บในตารางเดิมของบอท ใช้คีย์แยก ไม่ปนกับลูกค้า
      const sessionKey = `secretary:${groupId}`
      const { data: branch } = await db.from('branches').select('id').limit(1).maybeSingle()
      const { data: session } = branch
        ? await db.from('line_chat_sessions').select('messages, updated_at').eq('line_user_id', sessionKey).eq('branch_id', branch.id).maybeSingle()
        : { data: null }
      const fresh = session?.updated_at && Date.now() - new Date(session.updated_at).getTime() < 3 * 3600_000
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const history: any[] = fresh ? (session?.messages ?? []) : []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let messages: any[] = [...history, { role: 'user', content: question }].slice(-12)

      const system = SYSTEM_PROMPT(utcToBangkokLocal(new Date().toISOString()), todayBkk())
      let response = await callClaude(messages, system)
      for (let i = 0; response.stop_reason === 'tool_use' && i < MAX_TOOL_LOOPS; i++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolUses = response.content.filter((c: any) => c.type === 'tool_use')
        const results = []
        for (const tu of toolUses) {
          let result: unknown
          try { result = await runTool(db, tu.name, tu.input ?? {}) } catch (e) { result = { error: String(e) } }
          results.push({ type: 'tool_result', tool_use_id: tu.id, content: clip(result) })
        }
        messages = [...messages, { role: 'assistant', content: response.content }, { role: 'user', content: results }]
        response = await callClaude(messages, system)
      }

      // ค้นครบรอบแล้วยังไม่ได้คำตอบ (ยังขอเรียกเครื่องมือต่อ) — บังคับให้สรุปเท่าที่ได้ แทนที่จะตอบว่า "ตอบไม่ได้"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (response.stop_reason === 'tool_use') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pending = response.content.filter((c: any) => c.type === 'tool_use')
        messages = [
          ...messages,
          { role: 'assistant', content: response.content },
          { role: 'user', content: [
            ...pending.map((tu: { id: string }) => ({ type: 'tool_result', tool_use_id: tu.id, content: 'หมดรอบค้นหาแล้ว' })),
            { type: 'text', text: 'สรุปคำตอบให้เจ้าของจากข้อมูลที่ค้นได้ตอนนี้ ถ้าข้อมูลไม่พอให้บอกตรงๆ ว่าขาดอะไร' },
          ] },
        ]
        response = await callClaude(messages, system, false)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reply: string = response.content?.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n').trim() || 'ขอโทษครับ ตอบไม่ได้ในตอนนี้ ลองถามใหม่อีกครั้งครับ'
      await send(reply)

      if (branch) {
        await db.from('line_chat_sessions').upsert({
          line_user_id: sessionKey, branch_id: branch.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          messages: [...history, { role: 'user', content: question }, { role: 'assistant', content: reply }].filter((m: any) => typeof m.content === 'string').slice(-12),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'line_user_id,branch_id' })
      }
    } catch (err) {
      console.error('[secretary] error:', err)
      await send('ขอโทษครับ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งครับ')
    }
  }
  return NextResponse.json({ ok: true })
}
