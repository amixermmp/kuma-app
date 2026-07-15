import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { logStaffAction } from '@/lib/log'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { repairId, bikeId, repairNotes, repairShop, repairCost, lockForSwap } = await request.json()
  if (!repairId || !bikeId) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const supabase = createAdminClient()

  const { error: repairErr } = await supabase
    .from('repairs')
    .update({
      status: 'done',
      notes: repairNotes ?? null,
      repair_shop: repairShop ?? null,
      repair_cost: repairCost ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', repairId)

  if (repairErr) {
    console.error('Repair complete error:', repairErr.message)
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
  }

  await supabase.from('bikes').update({ status: lockForSwap ? 'locked' : 'available' }).eq('id', bikeId)

  const { data: bike } = await supabase.from('bikes').select('license_plate').eq('id', bikeId).single()
  await logStaffAction(staffId, 'repair_completed',
    `ซ่อมเสร็จ ${bike?.license_plate ?? ''}${repairShop ? ` — ร้าน ${repairShop}` : ''}${repairCost ? ` — ฿${Number(repairCost).toLocaleString()}` : ''}`,
    { repairId, bikeId, repairCost: repairCost ?? null, repairShop: repairShop ?? null })

  return NextResponse.json({ success: true })
}
