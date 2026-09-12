import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds } from '@/lib/staffBranch'

export const dynamic = 'force-dynamic'

const REMIND_BEFORE_MS = 15 * 60 * 1000

type Reminder = {
  type: 'send' | 'return'
  id: string
  ref: string
  customerName: string
  address: string | null
  time: string
  bikeLabel: string
}

export async function GET() {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const allowedBranchIds = await getStaffBranchIds(staffId)
  const dueBefore = new Date(Date.now() + REMIND_BEFORE_MS).toISOString()

  let sendQuery = admin
    .from('bookings')
    .select('id, booking_ref, start_datetime, customer_name, delivery_address, branch_id, bikes(license_plate, brand, model)')
    .eq('status', 'confirmed')
    .eq('delivery_type', 'offsite')
    .lte('start_datetime', dueBefore)
  if (allowedBranchIds) sendQuery = sendQuery.in('branch_id', allowedBranchIds)

  let returnQuery = admin
    .from('rentals')
    .select('id, expected_end_datetime, return_address, branch_id, bikes(license_plate, brand, model), customers(name)')
    .in('status', ['active', 'extended'])
    .eq('return_type', 'offsite')
    .lte('expected_end_datetime', dueBefore)
  if (allowedBranchIds) returnQuery = returnQuery.in('branch_id', allowedBranchIds)

  const [{ data: sends }, { data: returns }, { data: acks }] = await Promise.all([
    sendQuery,
    returnQuery,
    admin.from('offsite_reminder_acks').select('source_type, source_id').eq('staff_id', staffId),
  ])

  const ackedKeys = new Set((acks ?? []).map(a => `${a.source_type}:${a.source_id}`))

  const reminders: Reminder[] = []

  for (const b of sends ?? []) {
    if (ackedKeys.has(`send:${b.id}`)) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bike = b.bikes as any
    reminders.push({
      type: 'send', id: b.id, ref: b.booking_ref, customerName: b.customer_name,
      address: b.delivery_address, time: b.start_datetime,
      bikeLabel: bike ? `${bike.brand ?? ''} ${bike.model ?? ''} • ${bike.license_plate ?? ''}` : '',
    })
  }
  for (const r of returns ?? []) {
    if (ackedKeys.has(`return:${r.id}`)) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bike = r.bikes as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customer = r.customers as any
    reminders.push({
      type: 'return', id: r.id, ref: bike?.license_plate ?? '', customerName: customer?.name ?? 'ลูกค้า',
      address: r.return_address, time: r.expected_end_datetime,
      bikeLabel: bike ? `${bike.brand ?? ''} ${bike.model ?? ''} • ${bike.license_plate ?? ''}` : '',
    })
  }

  reminders.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

  return NextResponse.json({ reminders })
}
