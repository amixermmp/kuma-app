import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('base64')
  return hash === signature
}

// รับ event จาก LINE ของทุกสาขา (แต่ละสาขามี channel/secret ของตัวเอง) —
// หา secret ที่ตรงกับลายเซ็นเพื่อรู้ว่า event นี้เป็นของสาขาไหน แล้วจับ group id
// ของกลุ่มพนักงานเก็บไว้อัตโนมัติตอนบอทได้รับข้อความแรกจากกลุ่มนั้น (ตั้งครั้งเดียว ไม่ทับของเดิม)
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-line-signature') ?? ''

  const admin = createAdminClient()
  const { data: branches } = await admin
    .from('branch_settings')
    .select('branch_id, line_channel_secret, staff_line_group_id')
    .not('line_channel_secret', 'is', null)

  const matched = (branches ?? []).find(
    b => b.line_channel_secret && verifySignature(rawBody, signature, b.line_channel_secret)
  )
  if (!matched) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = rawBody ? JSON.parse(rawBody) : {}
  for (const event of body.events ?? []) {
    const groupId = event.source?.type === 'group' ? event.source.groupId : null
    if (groupId && !matched.staff_line_group_id) {
      await admin.from('branch_settings').update({ staff_line_group_id: groupId }).eq('branch_id', matched.branch_id)
      console.log('[line/webhook] captured staff_line_group_id for branch', matched.branch_id, groupId)
    }
  }

  return NextResponse.json({ ok: true })
}
