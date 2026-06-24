import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

const BRANCH_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bikeId, description, severity, photoUrl, locationNote } = await request.json()
  if (!bikeId || !description) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const supabase = createAdminClient()

  const { data: repair, error: repairErr } = await supabase
    .from('repairs')
    .insert({
      bike_id: bikeId,
      branch_id: BRANCH_ID,
      reported_by: staffId,
      description,
      severity: severity ?? 'medium',
      photo_url: photoUrl ?? null,
      location_note: locationNote ?? null,
      status: 'in_repair',
    })
    .select('id')
    .single()

  if (repairErr || !repair) {
    console.error('Repair create error:', repairErr?.message)
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
  }

  await supabase.from('bikes').update({ status: 'repair' }).eq('id', bikeId)

  return NextResponse.json({ success: true, repairId: repair.id })
}
