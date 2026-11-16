import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { webApiGuard, isUuid } from '@/lib/webApiAuth'
import { buildWebQuote } from '@/lib/webQuote'

export const dynamic = 'force-dynamic'

// ราคาประมาณสำหรับหน้ารุ่นรถบนเว็บ (สูตรเดียวกับหน้าส่งรถ) — ไม่บันทึกอะไร
export async function POST(request: Request) {
  const denied = webApiGuard(request)
  if (denied) return denied

  const body = await request.json().catch(() => null)
  if (!body || !isUuid(body.branch_id) || typeof body.brand !== 'string' || typeof body.model !== 'string') {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const result = await buildWebQuote(createAdminClient(), {
    branchId: body.branch_id,
    brand: body.brand,
    model: body.model,
    startDate: body.start_date,
    endDate: body.end_date,
    send: body.send,
    ret: body.return,
  })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 422 })
  return NextResponse.json({ quote: result.quote })
}
