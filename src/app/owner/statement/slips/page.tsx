import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { idAndSlipNameMatch } from '@/lib/customer'
import SlipsClient, { SlipRow } from './SlipsClient'

export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<string, string> = { rental: '🛵 เช่ารายวัน', extend: '⏱ ต่อเวลา', overtime: '⏰ ค่าล่วงเวลา' }

export default async function SlipsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; branch?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const H7 = 7 * 60 * 60 * 1000
  const bkk = new Date(Date.now() + H7)
  const todayStr = bkk.toISOString().split('T')[0]

  const { date = todayStr, branch } = await searchParams

  const dayStart = new Date(`${date}T00:00:00+07:00`)
  const dayEnd = new Date(`${date}T23:59:59+07:00`)

  const admin = createAdminClient()

  const [branchesRes, rentalPaysRes, monthlyPaysRes] = await Promise.all([
    admin.from('branches').select('id, name').order('name'),
    admin.from('rental_payments')
      .select('id, kind, amount, paid_at, branch_id, voided_at, rentals(customers(name), bikes(license_plate), send_photos)')
      .gte('paid_at', dayStart.toISOString())
      .lte('paid_at', dayEnd.toISOString()),
    admin.from('monthly_payments')
      .select('id, amount, paid_date, payment_method, photo_url, slip_customer_name, voided_at, monthly_rentals(branch_id, customers(name), bikes(license_plate))')
      .eq('paid_date', date),
  ])

  const branches = branchesRes.data ?? []
  const branchName = new Map(branches.map(b => [b.id, b.name]))

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const one = (v: any) => Array.isArray(v) ? v[0] : v

  const rows: SlipRow[] = []

  for (const p of rentalPaysRes.data ?? []) {
    if (p.voided_at) continue
    const rental = one((p as any).rentals)
    const cust = one(rental?.customers)?.name ?? ''
    const plate = one(rental?.bikes)?.license_plate ?? ''
    const photoUrl = rental?.send_photos?.payment ?? null
    rows.push({
      source: 'rental', id: p.id, time: p.paid_at,
      branchId: p.branch_id ?? '', branch: branchName.get(p.branch_id) ?? '—',
      typeLabel: KIND_LABEL[p.kind] ?? p.kind,
      customer: cust, plate, amount: Number(p.amount ?? 0),
      photoUrl, slipName: null, nameMismatch: false,
    })
  }
  for (const p of monthlyPaysRes.data ?? []) {
    if (p.voided_at) continue
    const mr = one((p as any).monthly_rentals)
    const cust = one(mr?.customers)?.name ?? ''
    const plate = one(mr?.bikes)?.license_plate ?? ''
    const slipName = p.slip_customer_name ?? null
    rows.push({
      source: 'monthly', id: p.id, time: `${p.paid_date}T12:00:00+07:00`,
      branchId: mr?.branch_id ?? '', branch: branchName.get(mr?.branch_id) ?? '—',
      typeLabel: `📅 รายเดือน${p.payment_method ? ` • ${p.payment_method}` : ''}`,
      customer: cust, plate, amount: Number(p.amount ?? 0),
      photoUrl: p.photo_url ?? null, slipName,
      nameMismatch: !!slipName && !idAndSlipNameMatch(cust, slipName),
    })
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  rows.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  const filtered = branch ? rows.filter(r => r.branchId === branch) : rows

  return (
    <SlipsClient
      rows={filtered}
      branches={branches}
      date={date}
      branch={branch ?? ''}
    />
  )
}
