import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { createAdminClient } from '@/lib/supabase/admin'
import { promptPayPayload } from '@/lib/promptpay'

export const dynamic = 'force-dynamic'

// รูป QR PromptPay ของสาขา — LINE ดึงรูปจาก URL นี้ตอนส่งข้อความ
// ?branch=<branchId> (จำเป็น) &amount=<ยอด> (ไม่บังคับ — ไม่ใส่ = ลูกค้ากรอกยอดเอง)
export async function GET(request: NextRequest) {
  const branchId = request.nextUrl.searchParams.get('branch')
  if (!branchId) return NextResponse.json({ error: 'ไม่ระบุสาขา' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: settings } = await supabase
    .from('branch_settings')
    .select('promptpay_id')
    .eq('branch_id', branchId)
    .maybeSingle()

  if (!settings?.promptpay_id) {
    return NextResponse.json({ error: 'สาขานี้ยังไม่ได้ตั้งค่า PromptPay' }, { status: 404 })
  }

  const amountParam = request.nextUrl.searchParams.get('amount')
  const amount = amountParam ? Number(amountParam) : NaN
  const payload = promptPayPayload(settings.promptpay_id, Number.isFinite(amount) && amount > 0 ? amount : undefined)

  const png = await QRCode.toBuffer(payload, { width: 512, margin: 2 })
  return new NextResponse(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
  })
}
