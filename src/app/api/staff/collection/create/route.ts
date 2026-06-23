import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

const BRANCH_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { rentalId, periodLabel, dueDate, amountDue, amountPaid, paymentMethod, paymentNote, collectedAt } = body

  if (!rentalId || !periodLabel || amountPaid == null) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const status = amountPaid >= amountDue ? 'paid' : 'partial'

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('monthly_collections')
    .insert({
      rental_id: rentalId,
      branch_id: BRANCH_ID,
      period_label: periodLabel,
      due_date: dueDate,
      amount_due: amountDue,
      amount_paid: amountPaid,
      status,
      payment_method: paymentMethod ?? null,
      payment_note: paymentNote ?? null,
      collected_by: staffId,
      collected_at: collectedAt ?? new Date().toISOString(),
    })

  if (error) {
    console.error('Collection error:', error.message)
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
