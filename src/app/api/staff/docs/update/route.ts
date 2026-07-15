import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { logStaffAction } from '@/lib/log'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, bikeId, docType, expiryDate, photoUrl, cost } = await request.json()
  // หน้าเล่ม (registration) เป็นเอกสารถาวร — ต้องมีรูป ไม่ต้องมีวันหมดอายุ
  const isRegistration = docType === 'registration'
  if (!bikeId || !docType || (!isRegistration && !expiryDate) || (isRegistration && !photoUrl)) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('bike_documents')
    .upsert({
      id: id ?? undefined,
      bike_id: bikeId,
      doc_type: docType,
      expiry_date: expiryDate ?? null,
      doc_photo_url: photoUrl ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'bike_id,doc_type' })

  if (error) {
    console.error('Doc update error:', error.message)
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
  }

  const { data: bike } = await supabase.from('bikes').select('branch_id, license_plate').eq('id', bikeId).single()
  const label = docType === 'tax' ? 'ต่อภาษี' : docType === 'pob' ? 'ต่อพรบ' : isRegistration ? 'อัพโหลดหน้าเล่ม' : `ต่อ${docType}`
  const plate = bike?.license_plate ?? ''

  // ลงบัญชีรายจ่าย — ค่าต่อภาษี/พรบ เข้า Dashboard/Statement อัตโนมัติ
  if (cost && Number(cost) > 0) {
    const bkkToday = new Date(Date.now() + 7 * 3600_000).toISOString().split('T')[0]
    await supabase.from('expenses').insert({
      branch_id: bike?.branch_id ?? null,
      recorded_by: staffId,
      category: 'other',
      description: `${label} — ${plate}`,
      amount: Number(cost),
      expense_date: bkkToday,
    })
  }

  await logStaffAction(staffId, 'doc_updated',
    `${label} ${plate}${expiryDate ? ` — หมดอายุใหม่ ${expiryDate}` : ''}${cost ? ` — ฿${Number(cost).toLocaleString()}` : ''}`,
    { bikeId, docType, expiryDate: expiryDate ?? null, cost: cost ?? null })

  return NextResponse.json({ success: true })
}
