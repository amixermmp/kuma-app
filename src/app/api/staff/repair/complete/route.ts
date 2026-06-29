import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { repairId, bikeId } = await request.json()
  if (!repairId || !bikeId) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const supabase = createAdminClient()

  const { error: repairErr } = await supabase
    .from('repairs')
    .update({ status: 'done' })
    .eq('id', repairId)

  if (repairErr) {
    console.error('Repair complete error:', repairErr.message)
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
  }

  await supabase.from('bikes').update({ status: 'available' }).eq('id', bikeId)

  return NextResponse.json({ success: true })
}
