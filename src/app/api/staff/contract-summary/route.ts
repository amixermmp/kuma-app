import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds } from '@/lib/staffBranch'
import { buildContractSummary, bangkokTodayLocal } from '@/lib/contractSummary'
import { utcToBangkokLocal } from '@/lib/time'

// ข้อความสรุปการเช่าให้พนักงานก๊อปส่งลูกค้า — สร้างจาก "สัญญาที่บันทึกลงระบบแล้ว" (ไม่ใช่ค่าในฟอร์ม) เพื่อให้ตรงกับที่บันทึกจริงเสมอ
// สัญญารายเดือนไม่ได้เก็บว่าตอนส่งรถน้ำมันเต็มไหม — หน้าสำเร็จส่ง fuelFull มาให้ (เปิดดูย้อนหลังไม่มีค่านี้ ถือว่าเต็มถัง)
export async function GET(request: NextRequest) {
  const staffId = (await cookies()).get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const type = searchParams.get('type')
  const id = searchParams.get('id')
  if ((type !== 'daily' && type !== 'monthly') || !id) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const supabase = createAdminClient()
  const allowedBranchIds = await getStaffBranchIds(staffId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let contract: any
  if (type === 'daily') {
    const { data } = await supabase.from('rentals')
      .select('branch_id, start_datetime, expected_end_datetime, send_fuel_full, return_type, return_address, return_fee, bikes(brand, model, license_plate)')
      .eq('id', id).maybeSingle()
    contract = data
  } else {
    const { data } = await supabase.from('monthly_rentals')
      .select('branch_id, start_date, pickup_time, payment_day, bikes(brand, model, license_plate)')
      .eq('id', id).maybeSingle()
    contract = data
  }
  if (!contract) return NextResponse.json({ error: 'ไม่พบสัญญา' }, { status: 404 })
  if (allowedBranchIds && !allowedBranchIds.includes(contract.branch_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: settings } = await supabase.from('branch_settings')
    .select('contact_phone, receipt_phone, document_theme').eq('branch_id', contract.branch_id).maybeSingle()
  const bike = Array.isArray(contract.bikes) ? contract.bikes[0] : contract.bikes

  const text = buildContractSummary({
    theme: settings?.document_theme === 'zame' ? 'zame' : 'kuma',
    type,
    brand: bike?.brand ?? '', model: bike?.model ?? '', plate: bike?.license_plate ?? '',
    startLocal: type === 'daily'
      ? utcToBangkokLocal(contract.start_datetime)
      : `${contract.start_date}${contract.pickup_time ? `T${String(contract.pickup_time).slice(0, 5)}` : ''}`,
    endLocal: type === 'daily' ? utcToBangkokLocal(contract.expected_end_datetime) : null,
    paymentDay: type === 'monthly' ? contract.payment_day : null,
    fuelFull: type === 'daily' ? contract.send_fuel_full !== false : searchParams.get('fuelFull') !== '0',
    returnType: type === 'daily' ? contract.return_type : null,
    returnAddress: type === 'daily' ? contract.return_address : null,
    returnFee: type === 'daily' ? Number(contract.return_fee ?? 0) : null,
    emergencyPhone: settings?.contact_phone || settings?.receipt_phone || null,
    todayLocal: bangkokTodayLocal(),
  })

  return NextResponse.json({ text })
}
