import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { linePush, textMessage } from '@/lib/line'

export const dynamic = 'force-dynamic'

// ผูก LINE userId ของลูกค้าเข้ากับสัญญาเช่า (เรียกจากหน้า LIFF หลังลูกค้าสแกน QR)
// รับ rentalId (รายวัน) หรือ monthlyId (รายเดือน) — เก็บแยกตามสาขา
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { rentalId, monthlyId, lineUserId } = body

  if ((!rentalId && !monthlyId) || !lineUserId || typeof lineUserId !== 'string' || !lineUserId.startsWith('U')) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: contract } = rentalId
    ? await supabase
        .from('rentals')
        .select('id, branch_id, customer_id, expected_end_datetime, customers(name), bikes(license_plate, brand, model)')
        .eq('id', rentalId)
        .in('status', ['active', 'extended'])
        .single()
    : await supabase
        .from('monthly_rentals')
        .select('id, branch_id, customer_id, payment_day, customers(name), bikes(license_plate, brand, model)')
        .eq('id', monthlyId)
        .eq('status', 'active')
        .single()

  if (!contract?.branch_id) {
    return NextResponse.json({ error: 'ไม่พบสัญญาเช่า หรือสัญญาปิดไปแล้ว' }, { status: 404 })
  }

  const { error } = await supabase
    .from('customer_line_links')
    .upsert(
      { customer_id: contract.customer_id, branch_id: contract.branch_id, line_user_id: lineUserId },
      { onConflict: 'customer_id,branch_id' }
    )

  if (error) {
    console.error('LINE link error:', error.message)
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customer = contract.customers as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bike = contract.bikes as any
  const bikeText = `${bike?.brand ?? ''} ${bike?.model ?? ''} ทะเบียน ${bike?.license_plate ?? ''}`

  // ส่งข้อความยืนยันเข้าไลน์ลูกค้า ผ่าน OA ของสาขานั้น
  const { data: settings } = await supabase
    .from('branch_settings')
    .select('line_token')
    .eq('branch_id', contract.branch_id)
    .maybeSingle()

  if (settings?.line_token) {
    let detail: string
    if (rentalId) {
      const due = new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      }).format(new Date((contract as { expected_end_datetime: string }).expected_end_datetime))
      detail = `ครบกำหนดคืน: ${due} น.\n\nระบบจะแจ้งเตือนทางไลน์นี้ก่อนถึงเวลาคืนรถครับ 🙏`
    } else {
      const payDay = (contract as { payment_day: number | null }).payment_day
      detail = `สัญญาเช่ารายเดือน — กำหนดชำระทุกวันที่ ${payDay ?? '-'} ของเดือน\n\nระบบจะแจ้งเตือนทางไลน์นี้เมื่อถึงกำหนดชำระครับ 🙏`
    }
    await linePush(settings.line_token, lineUserId, [
      textMessage(
        `✅ ผูกไลน์เรียบร้อยครับ\n\n` +
        `คุณ${customer?.name ?? 'ลูกค้า'} — รถ ${bikeText}\n` +
        detail
      ),
    ])
  }

  return NextResponse.json({ success: true, customerName: customer?.name ?? '' })
}
