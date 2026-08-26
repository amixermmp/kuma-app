import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

// บันทึกชื่อ/ที่อยู่/เลขที่ผู้รับบิล (เช่น ขอออกใบเสร็จเป็นชื่อบริษัท) ผูกกับสัญญา —
// ใช้ซ้ำได้ทุกใบเสร็จของสัญญาเดียวกัน (ต่อเวลา/เก็บรายเดือนรอบถัดไป) ไม่ต้องพิมพ์ใหม่ทุกครั้ง
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { contractType, contractId, billingName, billingAddress, billingPhone, billingId } = await request.json()
  if (!contractType || !contractId) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  if (contractType !== 'rental' && contractType !== 'monthly') {
    return NextResponse.json({ error: 'ประเภทสัญญาไม่ถูกต้อง' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const table = contractType === 'rental' ? 'rentals' : 'monthly_rentals'

  const { error } = await supabase
    .from(table)
    .update({
      billing_name: billingName?.trim() || null,
      billing_address: billingAddress?.trim() || null,
      billing_phone: billingPhone?.trim() || null,
      billing_id: billingId?.trim() || null,
    })
    .eq('id', contractId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
