import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { monthlyRentalId, dueDate, amountPaid, paymentMethod, paymentNote, collectedAt } = body

  if (!monthlyRentalId || !dueDate || amountPaid == null) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Get monthly_rental to know the rate
  const { data: rental } = await supabase
    .from('monthly_rentals')
    .select('monthly_rate')
    .eq('id', monthlyRentalId)
    .single()

  if (!rental) return NextResponse.json({ error: 'ไม่พบสัญญา' }, { status: 404 })

  // Sum existing payments for this period
  const { data: existing } = await supabase
    .from('monthly_payments')
    .select('amount')
    .eq('monthly_rental_id', monthlyRentalId)
    .eq('due_date', dueDate)

  const alreadyPaid = (existing ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const newTotal = alreadyPaid + amountPaid
  const status = newTotal >= rental.monthly_rate ? 'paid' : 'partial'

  // Insert new payment record
  const { error } = await supabase.from('monthly_payments').insert({
    monthly_rental_id: monthlyRentalId,
    due_date: dueDate,
    paid_date: collectedAt ? new Date(collectedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    amount: amountPaid,
    payment_method: paymentMethod ?? null,
    payment_note: paymentNote ?? null,
    staff_id: staffId,
    status,
  })

  if (error) return NextResponse.json({ error: 'บันทึกไม่สำเร็จ: ' + error.message }, { status: 500 })

  // Mark any existing pending/overdue records for this period as paid
  if (status === 'paid') {
    await supabase.from('monthly_payments')
      .update({ status: 'paid' })
      .eq('monthly_rental_id', monthlyRentalId)
      .eq('due_date', dueDate)
      .in('status', ['pending', 'overdue'])
  }

  return NextResponse.json({ success: true, status })
}
