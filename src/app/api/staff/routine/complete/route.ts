import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { recalcNeverDoneRoutines } from '@/lib/routines'
import { logStaffAction } from '@/lib/log'

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
    // รูทีนอื่นของรถคันนี้ที่ไม่เคยทำ อาจโดนเลขไมล์ใหม่ทำให้แจ้งเตือนผิด
    await recalcNeverDoneRoutines(supabase, bikeId, Number(doneKm))
  }

  const [{ data: bike }, { data: routineRow }] = await Promise.all([
    bikeId
      ? supabase.from('bikes').select('branch_id, license_plate').eq('id', bikeId).single()
      : Promise.resolve({ data: null }),
    supabase.from('bike_routines').select('task_name').eq('id', routineId).single(),
  ])
  const taskName = routineRow?.task_name ?? 'งานรูทีน'
  const plate = bike?.license_plate ?? ''

  // ลงบัญชีรายจ่าย — ค่าทำรูทีนเข้า Dashboard/Statement อัตโนมัติ (waive ได้ถ้าลงผิด)
  if (cost && Number(cost) > 0 && bikeId) {
    const bkkToday = new Date(Date.now() + 7 * 3600_000).toISOString().split('T')[0]
    await supabase.from('expenses').insert({
      branch_id: bike?.branch_id ?? null,
      recorded_by: staffId,
      category: 'maintenance',
      description: `${taskName} — ${plate}${shop ? ` (${shop})` : ''}`,
      amount: Number(cost),
      expense_date: bkkToday,
    })
  }

  await logStaffAction(staffId, 'routine_completed',
    `ทำรูทีนเสร็จ: ${taskName} — ${plate}${doneKm ? ` ที่ ${Number(doneKm).toLocaleString()} กม.` : ''}${cost ? ` — ฿${Number(cost).toLocaleString()}` : ''}`,
    { routineId, bikeId, doneKm: doneKm ?? null, cost: cost ?? null, shop: shop ?? null })

  return NextResponse.json({ success: true })
}
