import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { rentalId, payment, newEndDatetime, newCredit } = body

  if (!rentalId || !newEndDatetime || payment == null || newCredit == null) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: current, error: fetchErr } = await supabase
    .from('rentals')
    .select('total_amount')
    .eq('id', rentalId)
    .in('status', ['active', 'extended'])
    .single()

  if (fetchErr || !current) {
    return NextResponse.json({ error: 'ไม่พบรายการเช่า' }, { status: 404 })
  }

  const { error } = await supabase
    .from('rentals')
    .update({
      status: 'extended',
      expected_end_datetime: newEndDatetime,
      total_amount: current.total_amount + payment,
      outstanding_credit: newCredit,
    })
    .eq('id', rentalId)

  if (error) {
    console.error('Extend error:', error.message)
    return NextResponse.json({ error: 'ต่อเวลาไม่สำเร็จ' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
