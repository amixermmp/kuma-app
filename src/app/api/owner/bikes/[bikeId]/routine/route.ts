import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest, { params }: { params: Promise<{ bikeId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bikeId } = await params
  const { task_name, last_done_date, interval_days, interval_km } = await request.json()

  if (!task_name) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  // คำนวณ next_due_date = last_done_date + interval_days (ถ้ามีทั้งคู่)
  let next_due_date: string | null = null
  if (last_done_date && interval_days) {
    const next = new Date(last_done_date)
    next.setDate(next.getDate() + Number(interval_days))
    next_due_date = next.toISOString().split('T')[0]
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('bike_routines')
    .upsert(
      {
        bike_id: bikeId,
        task_name,
        last_done_date: last_done_date ?? null,
        interval_days: interval_days ? Number(interval_days) : null,
        interval_km: interval_km ? Number(interval_km) : null,
        next_due_date,
      },
      { onConflict: 'bike_id,task_name' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, next_due_date })
}
