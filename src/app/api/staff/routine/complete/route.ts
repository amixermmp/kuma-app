import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { routineId, bikeId, doneKm, shop, cost, receiptUrl, intervalKm, intervalDays } = await request.json()
  if (!routineId) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  // Calculate next due
  const today = new Date().toISOString().split('T')[0]
  const nextDueKm = doneKm && intervalKm ? doneKm + intervalKm : null
  const nextDueDate = intervalDays
    ? new Date(Date.now() + intervalDays * 86_400_000).toISOString().split('T')[0]
    : null

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('bike_routines')
    .update({
      last_done_km: doneKm ?? null,
      last_done_date: today,
      next_due_km: nextDueKm,
      next_due_date: nextDueDate,
      last_cost: cost ?? null,
      receipt_url: receiptUrl ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', routineId)

  if (error) {
    console.error('Routine complete error:', error.message)
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
  }

  // Update bike odometer if provided
  if (doneKm && bikeId) {
    await supabase.from('bikes').update({ odometer: doneKm }).eq('id', bikeId)
  }

  return NextResponse.json({ success: true })
}
