import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { webApiGuard, isUuid } from '@/lib/webApiAuth'
import { buildWebQuote } from '@/lib/webQuote'

export const dynamic = 'force-dynamic'

const LANGS = ['th', 'en', 'ja', 'zh']
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ' // ไม่มี 0/O/1/I ลูกค้าพิมพ์/อ่านผิดยาก
const FLOOD_LIMIT_PER_HOUR = 300 // เกราะสุดท้ายกันตารางโดนถล่ม (เว็บมีลิมิตต่อ IP ของตัวเองอีกชั้น)

function makeCode() {
  let s = ''
  for (let i = 0; i < 4; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return `Z-${s}`
}

// บันทึกคำขอจองจากเว็บ (ลูกค้ากดปุ่ม "จองผ่านไลน์") — ไม่ใช่ใบจอง ไม่กันรถ
// ราคาคำนวณใหม่ฝั่งนี้เสมอ ไม่เชื่อตัวเลขที่เว็บส่งมา
export async function POST(request: Request) {
  const denied = webApiGuard(request)
  if (denied) return denied

  const body = await request.json().catch(() => null)
  if (!body || !isUuid(body.branch_id) || typeof body.brand !== 'string' || typeof body.model !== 'string') {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }
  const pickupTime = typeof body.pickup_time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(body.pickup_time) ? body.pickup_time : null
  const lang = LANGS.includes(body.lang) ? body.lang : null

  const admin = createAdminClient()

  const since = new Date(Date.now() - 3_600_000).toISOString()
  const { count: recent } = await admin.from('web_inquiries').select('id', { count: 'exact', head: true }).gte('created_at', since)
  if ((recent ?? 0) >= FLOOD_LIMIT_PER_HOUR) return NextResponse.json({ error: 'busy' }, { status: 429 })

  const result = await buildWebQuote(admin, {
    branchId: body.branch_id,
    brand: body.brand,
    model: body.model,
    startDate: body.start_date,
    endDate: body.end_date,
    send: body.send,
    ret: body.return,
  })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 422 })
  const { quote } = result

  const row = {
    branch_id: body.branch_id,
    brand: body.brand,
    model: body.model,
    start_date: result.startDate,
    end_date: result.endDate,
    total_days: quote.days,
    pickup_time: pickupTime,
    send_type: quote.delivery.send.type,
    send_zone_name: quote.delivery.send.zone_name_th,
    return_type: quote.delivery.return.type,
    return_zone_name: quote.delivery.return.zone_name_th,
    est_rent: quote.rent_total,
    est_delivery_fee: quote.delivery.total,
    delivery_fee_unknown: quote.delivery.unknown,
    est_total: quote.grand_total,
    deposit: quote.deposit.amount,
    lang,
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = makeCode()
    const { error } = await admin.from('web_inquiries').insert({ ...row, code })
    if (!error) return NextResponse.json({ code, quote })
    if (error.code !== '23505') return NextResponse.json({ error: 'save_failed' }, { status: 500 })
  }
  return NextResponse.json({ error: 'save_failed' }, { status: 500 })
}
