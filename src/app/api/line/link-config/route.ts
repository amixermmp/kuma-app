import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// LIFF ID ของสาขาที่สัญญาเช่านี้สังกัด (public — LIFF ID ไม่ใช่ความลับ)
// ?rental=<id> สำหรับเช่ารายวัน หรือ ?monthly=<id> สำหรับเช่ารายเดือน
export async function GET(request: NextRequest) {
  const rentalId = request.nextUrl.searchParams.get('rental')
  const monthlyId = request.nextUrl.searchParams.get('monthly')
  if (!rentalId && !monthlyId) {
    return NextResponse.json({ error: 'ไม่พบรหัสสัญญาเช่า' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: contract } = rentalId
    ? await supabase.from('rentals').select('branch_id').eq('id', rentalId).single()
    : await supabase.from('monthly_rentals').select('branch_id').eq('id', monthlyId!).single()

  if (!contract?.branch_id) {
    return NextResponse.json({ error: 'ไม่พบสัญญาเช่า' }, { status: 404 })
  }

  const { data: settings } = await supabase
    .from('branch_settings')
    .select('line_liff_id')
    .eq('branch_id', contract.branch_id)
    .maybeSingle()

  if (!settings?.line_liff_id) {
    return NextResponse.json({ error: 'สาขานี้ยังไม่ได้ตั้งค่า LIFF ID' }, { status: 404 })
  }
  return NextResponse.json({ liffId: settings.line_liff_id })
}
