import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { rentalId, periodLabel, dueDate, amountDue, amountPaid, paymentMethod, paymentNote, collectedAt } = body

  if (!rentalId || !periodLabel || amountPaid == null) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Check if record for this period already exists
  const { data: existing } = await supabase
    .from('monthly_collections')
    .select('id, amount_paid, payment_history')
    .eq('rental_id', rentalId)
    .eq('period_label', periodLabel)
    .single()

  const newPaymentEntry = {
    amount: amountPaid,
    method: paymentMethod ?? null,
    note: paymentNote ?? null,
    paid_at: collectedAt ?? new Date().toISOString(),
    staff_id: staffId,
  }

  if (existing) {
    // Accumulate
    const prevHistory: object[] = Array.isArray(existing.payment_history) ? existing.payment_history : []
    const newTotal = Number(existing.amount_paid) + amountPaid
    const newStatus = newTotal >= amountDue ? 'paid' : 'partial'

    const { error } = await supabase
      .from('monthly_collections')
      .update({
        amount_paid: newTotal,
        status: newStatus,
        payment_method: paymentMethod ?? null,
        payment_note: paymentNote ?? null,
        collected_at: collectedAt ?? new Date().toISOString(),
        payment_history: [...prevHistory, newPaymentEntry],
      })
      .eq('id', existing.id)

    if (error) return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
  } else {
    // First payment for this period
    const status = amountPaid >= amountDue ? 'paid' : 'partial'

    const { error } = await supabase
      .from('monthly_collections')
      .insert({
        rental_id: rentalId,
        period_label: periodLabel,
        due_date: dueDate,
        amount_due: amountDue,
        amount_paid: amountPaid,
        status,
        payment_method: paymentMethod ?? null,
        payment_note: paymentNote ?? null,
        collected_by: staffId,
        collected_at: collectedAt ?? new Date().toISOString(),
        payment_history: [newPaymentEntry],
      })

    if (error) return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
