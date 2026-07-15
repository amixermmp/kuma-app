import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffOwnBranchId } from '@/lib/staffBranch'
import { logStaffAction } from '@/lib/log'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const BRANCH_ID = await getStaffOwnBranchId(staffId)

  const { bikeId, description } = await request.json()
  if (!bikeId || !description) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const supabase = createAdminClient()

  const { data: repair, error: repairErr } = await supabase
    .from('repairs')
    .insert({
      bike_id: bikeId,
      branch_id: BRANCH_ID,
      title: description.substring(0, 100),
      description,
      status: 'in_progress',
    })
    .select('id')
    .single()

  if (repairErr || !repair) {
    console.error('Repair create error:', repairErr?.message)
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
  }

  await supabase.from('bikes').update({ status: 'repair' }).eq('id', bikeId)

  const { data: bike } = await supabase.from('bikes').select('license_plate').eq('id', bikeId).single()
  await logStaffAction(staffId, 'repair_created',
    `แจ้งซ่อม ${bike?.license_plate ?? ''} — ${description.substring(0, 80)}`,
    { repairId: repair.id, bikeId })

  return NextResponse.json({ success: true, repairId: repair.id })
}
