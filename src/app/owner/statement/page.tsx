import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import StatementClient, { StatementRow } from './StatementClient'

export const dynamic = 'force-dynamic'

const MONTHS_TH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']

export default async function StatementPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; branch?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const { period = 'month', from, to, branch } = await searchParams

  // ขอบเขตช่วงเวลาคิดตามเวลาไทย (convention เดียวกับ dashboard)
  const H7 = 7 * 60 * 60 * 1000
  const now = new Date()
  const bkk = new Date(now.getTime() + H7)

  let periodStart: Date
  let periodEnd: Date = new Date(now)
  let periodLabel: string

  if (period === 'custom' && from && to) {
    periodStart = new Date(`${from}T00:00:00+07:00`)
    periodEnd   = new Date(`${to}T23:59:59+07:00`)
    const fmtD  = (s: string) => { const [y, m, d] = s.split('-').map(Number); return `${d} ${MONTHS_TH[m - 1].slice(0, 3)}. ${y + 543}` }
    periodLabel = `${fmtD(from)} — ${fmtD(to)}`
  } else if (period === 'today') {
    periodStart = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate()) - H7)
    periodEnd   = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000 - 1)
    periodLabel = 'วันนี้'
  } else if (period === 'week') {
    periodStart = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate() - 6) - H7)
    periodLabel = '7 วันล่าสุด'
  } else {
    periodStart = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), 1) - H7)
    periodEnd   = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth() + 1, 1) - H7 - 1)
    periodLabel = MONTHS_TH[bkk.getUTCMonth()] + ' ' + (bkk.getUTCFullYear() + 543)
  }

  const bkkDateStr = (d: Date) => new Date(d.getTime() + H7).toISOString().split('T')[0]
  const startDate = bkkDateStr(periodStart)
  const endDate   = bkkDateStr(periodEnd)

  const admin = createAdminClient()

  const [branchesRes, rentalPaysRes, monthlyPaysRes, expensesRes, repairsRes] = await Promise.all([
    admin.from('branches').select('id, name').order('name'),
    admin.from('rental_payments')
      .select('id, kind, amount, paid_at, voided_at, void_reason, branch_id, rentals(customers(name), bikes(license_plate))')
      .gte('paid_at', periodStart.toISOString())
      .lte('paid_at', periodEnd.toISOString()),
    admin.from('monthly_payments')
      .select('id, amount, paid_date, voided_at, void_reason, monthly_rentals(branch_id, customers(name), bikes(license_plate))')
      .in('status', ['paid', 'partial'])
      .gte('paid_date', startDate)
      .lte('paid_date', endDate),
    admin.from('expenses')
      .select('id, amount, expense_date, category, description, branch_id, voided_at, void_reason')
      .gte('expense_date', startDate)
      .lte('expense_date', endDate),
    admin.from('repairs')
      .select('id, title, repair_cost, resolved_at, branch_id, voided_at, void_reason, bikes(license_plate)')
      .eq('status', 'done')
      .not('repair_cost', 'is', null)
      .gte('resolved_at', periodStart.toISOString())
      .lte('resolved_at', periodEnd.toISOString()),
  ])

  const branches = branchesRes.data ?? []
  const branchName = new Map(branches.map(b => [b.id, b.name]))

  const KIND_LABEL: Record<string, string> = { rental: '🛵 เช่ารายวัน', extend: '⏱ ต่อเวลา', overtime: '⏰ ค่าล่วงเวลา' }
  const CAT_LABEL: Record<string, string> = { salary: 'เงินเดือน', rent: 'ค่าเช่าที่', utility: 'ค่าน้ำ/ไฟ', maintenance: 'ซ่อมบำรุง', other: 'อื่นๆ' }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const one = (v: any) => Array.isArray(v) ? v[0] : v

  const rows: StatementRow[] = []

  for (const p of rentalPaysRes.data ?? []) {
    const rental = one((p as any).rentals)
    const cust = one(rental?.customers)?.name ?? ''
    const plate = one(rental?.bikes)?.license_plate ?? ''
    rows.push({
      source: 'rental', id: p.id, date: p.paid_at,
      branchId: p.branch_id ?? '', branch: branchName.get(p.branch_id) ?? '—',
      typeLabel: KIND_LABEL[p.kind] ?? p.kind,
      detail: [plate, cust].filter(Boolean).join(' • '),
      amount: Number(p.amount ?? 0),
      voided: !!p.voided_at, voidReason: p.void_reason, waivable: true,
    })
  }
  for (const p of monthlyPaysRes.data ?? []) {
    const mr = one((p as any).monthly_rentals)
    const cust = one(mr?.customers)?.name ?? ''
    const plate = one(mr?.bikes)?.license_plate ?? ''
    rows.push({
      source: 'monthly', id: p.id, date: `${p.paid_date}T12:00:00+07:00`,
      branchId: mr?.branch_id ?? '', branch: branchName.get(mr?.branch_id) ?? '—',
      typeLabel: '📅 รายเดือน',
      detail: [plate, cust].filter(Boolean).join(' • '),
      amount: Number(p.amount ?? 0),
      voided: !!p.voided_at, voidReason: p.void_reason, waivable: true,
    })
  }
  for (const e of expensesRes.data ?? []) {
    rows.push({
      source: 'expense', id: e.id, date: `${e.expense_date}T12:00:00+07:00`,
      branchId: e.branch_id ?? '', branch: branchName.get(e.branch_id) ?? '—',
      typeLabel: '💸 รายจ่าย',
      detail: [CAT_LABEL[e.category] ?? e.category, e.description].filter(Boolean).join(' • '),
      amount: -Number(e.amount ?? 0),
      voided: !!e.voided_at, voidReason: e.void_reason, waivable: true,
    })
  }
  for (const r of repairsRes.data ?? []) {
    const plate = one((r as any).bikes)?.license_plate ?? ''
    rows.push({
      source: 'repair', id: r.id, date: r.resolved_at,
      branchId: r.branch_id ?? '', branch: branchName.get(r.branch_id) ?? '—',
      typeLabel: '🔧 ค่าซ่อม',
      detail: [plate, r.title].filter(Boolean).join(' • '),
      amount: -Number(r.repair_cost ?? 0),
      voided: !!r.voided_at, voidReason: r.void_reason, waivable: true,
    })
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const filtered = branch ? rows.filter(r => r.branchId === branch) : rows

  return (
    <StatementClient
      rows={filtered}
      branches={branches}
      period={period}
      from={from}
      to={to}
      branch={branch ?? ''}
      periodLabel={periodLabel}
    />
  )
}
