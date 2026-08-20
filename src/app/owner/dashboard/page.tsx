import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { PeriodSelector } from './PeriodSelector'
import { BranchSelector } from './BranchSelector'
import { Donut, DonutLegend } from './Donut'
import { getBikeIdAtDate } from '@/lib/swapHistory'

export const dynamic = 'force-dynamic'

const MONTHS_TH_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
const DAY_SHORT = ['อา','จ','อ','พ','พฤ','ศ','ส']
const DONUT_COLORS = ['#22c55e', '#38bdf8', '#f59e0b', '#a78bfa', '#f472b6', '#fb923c', '#2dd4bf', '#facc15']

function fmt(n: number) {
  return '฿' + n.toLocaleString('th-TH')
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const one = (v: any) => (Array.isArray(v) ? v[0] : v)

function pctChange(curr: number, prev: number): { pct: number; isNew: boolean } | null {
  if (prev <= 0) return curr > 0 ? { pct: 0, isNew: true } : null
  return { pct: Math.round(((curr - prev) / prev) * 100), isNew: false }
}

function ChangeBadge({ cmp }: { cmp: { pct: number; isNew: boolean } | null }) {
  if (!cmp) return null
  const color = cmp.isNew ? '#38bdf8' : cmp.pct >= 0 ? '#22c55e' : '#ef4444'
  return (
    <div style={{ fontSize: '11px', fontWeight: 700, color, marginTop: '2px' }}>
      {cmp.isNew ? 'ใหม่ (ช่วงก่อนไม่มี)' : `${cmp.pct >= 0 ? '↑' : '↓'} ${Math.abs(cmp.pct)}% จากช่วงก่อน`}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      margin: '0 16px 16px', background: '#1e293b', borderRadius: '14px', padding: '16px',
      border: '1px solid rgba(255,255,255,.06)',
    }}>
      {children}
    </div>
  )
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0', marginBottom: '12px' }}>{children}</div>
}

export default async function OwnerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; branch?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const { period = 'month', from, to, branch = '' } = await searchParams

  const admin = createAdminClient()
  // ขอบเขตวัน/เดือนต้องคิดตามเวลาไทย — Vercel รันเป็น UTC ถ้าใช้เวลา local จะเพี้ยน 7 ชม.
  const H7 = 7 * 60 * 60 * 1000
  const now = new Date()
  const bkk = new Date(now.getTime() + H7) // อ่าน component ด้วย getUTC* = เวลาไทย
  const bkkMidnight = (dayOffset = 0) =>
    new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate() + dayOffset) - H7)

  // Date range based on period
  let periodStart: Date
  let periodEnd: Date = new Date(now)
  let periodLabel: string

  if (period === 'custom' && from && to) {
    periodStart = new Date(`${from}T00:00:00+07:00`)
    periodEnd   = new Date(`${to}T23:59:59+07:00`)
    const fmtD  = (s: string) => { const [y, m, d] = s.split('-').map(Number); return `${d} ${MONTHS_TH_FULL[m - 1].slice(0, 3)}. ${y + 543}` }
    periodLabel = `${fmtD(from)} — ${fmtD(to)}`
  } else if (period === 'today') {
    periodStart = bkkMidnight()
    periodEnd   = new Date(bkkMidnight(1).getTime() - 1)
    periodLabel = 'วันนี้'
  } else if (period === 'week') {
    periodStart = bkkMidnight(-6)
    periodLabel = '7 วันล่าสุด'
  } else {
    periodStart = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), 1) - H7)
    periodEnd   = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth() + 1, 1) - H7 - 1)
    periodLabel = MONTHS_TH_FULL[bkk.getUTCMonth()] + ' ' + (bkk.getUTCFullYear() + 543)
  }

  const sevenDaysAgo = bkkMidnight(-6)

  // วันที่แบบ YYYY-MM-DD ตามเวลาไทย สำหรับคอลัมน์ date-only
  const bkkDateStr = (d: Date) => new Date(d.getTime() + H7).toISOString().split('T')[0]
  const periodStartDate = bkkDateStr(periodStart)
  const periodEndDate   = bkkDateStr(periodEnd)

  // ช่วงก่อนหน้า — ความยาวเท่ากัน ต่อกันก่อนหน้าทันที ไว้เทียบ % เพิ่ม/ลด
  const periodLenMs   = periodEnd.getTime() - periodStart.getTime()
  const prevPeriodEnd   = new Date(periodStart.getTime() - 1)
  const prevPeriodStart = new Date(prevPeriodEnd.getTime() - periodLenMs)
  const prevPeriodStartDate = bkkDateStr(prevPeriodStart)
  const prevPeriodEndDate   = bkkDateStr(prevPeriodEnd)

  const [
    bikesRes, bookingsMonthRes, bookingsRecentRes, branchesRes, pendingRes,
    rentalsMonthRes, monthlyPaymentsRes, expensesRes, repairCostsRes,
    rentalsPrevRes, monthlyPaymentsPrevRes,
  ] = await Promise.all([
    admin.from('bikes').select('id, status, branch_id, brand, model, license_plate'),
    admin.from('bookings')
      .select('id, branch_id, daily_rate, total_days, start_datetime, customer_name, bikes(license_plate, brand, model)')
      .in('status', ['confirmed', 'active', 'completed'])
      .gte('start_datetime', periodStart.toISOString())
      .lte('start_datetime', periodEnd.toISOString()),
    (() => {
      let q = admin.from('bookings')
        .select('id, status, customer_name, start_datetime, daily_rate, total_days, bikes(license_plate)')
        .in('status', ['confirmed', 'active', 'completed'])
        .order('start_datetime', { ascending: false })
        .limit(5)
      if (branch) q = q.eq('branch_id', branch)
      return q
    })(),
    admin.from('branches').select('id, name').order('name'),
    (() => {
      let q = admin.from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'confirmed')
        .lte('start_datetime', new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString())
      if (branch) q = q.eq('branch_id', branch)
      return q
    })(),
    // Daily rentals — นับเงินตามวันที่เก็บจริง (เปิดสัญญา/ต่อเวลา/ค่าล่วงเวลาตอนคืน)
    // ดึง bike_id/swap_log ของสัญญาไว้ด้วย (ไม่ join bikes ตรงๆ) เพราะ bike_id ปัจจุบันอาจไม่ใช่คันที่ใช้จริง
    // ตอนเก็บเงินก้อนนั้น ถ้าสัญญานี้เคยสลับรถกลางทาง — ไปหาราคาคันที่ถูกต้องจาก bikes ที่ดึงมาแล้วด้านบนแทน
    (() => {
      let q = admin.from('rental_payments')
        .select('amount, kind, paid_at, branch_id, rentals(bike_id, swap_log)')
        .is('voided_at', null)
        .gte('paid_at', periodStart.toISOString())
        .lte('paid_at', periodEnd.toISOString())
      if (branch) q = q.eq('branch_id', branch)
      return q
    })(),
    // Monthly payments — นับเงินที่เก็บได้จริงในช่วง (งวดแรกของสัญญาใหม่ก็ลงตารางนี้)
    admin.from('monthly_payments')
      .select('amount, paid_date, monthly_rentals(branch_id, bike_id, swap_log)')
      .in('status', ['paid', 'partial'])
      .is('voided_at', null)
      .gte('paid_date', periodStartDate)
      .lte('paid_date', periodEndDate),
    // Expenses
    (() => {
      let q = admin.from('expenses')
        .select('amount, branch_id')
        .is('voided_at', null)
        .gte('expense_date', periodStartDate)
        .lte('expense_date', periodEndDate)
      if (branch) q = q.eq('branch_id', branch)
      return q
    })(),
    // Repair costs
    (() => {
      let q = admin.from('repairs')
        .select('repair_cost, branch_id')
        .eq('status', 'done')
        .not('repair_cost', 'is', null)
        .is('voided_at', null)
        .gte('resolved_at', periodStart.toISOString())
        .lte('resolved_at', periodEnd.toISOString())
      if (branch) q = q.eq('branch_id', branch)
      return q
    })(),
    // ช่วงก่อนหน้า — สำหรับเทียบ % รายได้/จำนวนรายการ
    (() => {
      let q = admin.from('rental_payments')
        .select('amount, kind, branch_id')
        .is('voided_at', null)
        .gte('paid_at', prevPeriodStart.toISOString())
        .lte('paid_at', prevPeriodEnd.toISOString())
      if (branch) q = q.eq('branch_id', branch)
      return q
    })(),
    admin.from('monthly_payments')
      .select('amount, monthly_rentals(branch_id)')
      .in('status', ['paid', 'partial'])
      .is('voided_at', null)
      .gte('paid_date', prevPeriodStartDate)
      .lte('paid_date', prevPeriodEndDate),
  ])

  const bikes          = bikesRes.data ?? []
  const bookingsMonth  = bookingsMonthRes.data ?? []
  const bookingsRecent = bookingsRecentRes.data ?? []
  const branches       = branchesRes.data ?? []
  const pendingCount   = pendingRes.count ?? 0
  const rentalPayments  = rentalsMonthRes.data ?? []
  const monthlyPayments = monthlyPaymentsRes.data ?? []
  const totalExpenses   = (expensesRes.data ?? []).reduce((s, e) => s + (Number(e.amount) || 0), 0)
                        + (repairCostsRes.data ?? []).reduce((s, r) => s + (Number(r.repair_cost) || 0), 0)

  const monthlyPaymentsScoped = (monthlyPayments as any[]).filter(p => !branch || one(p.monthly_rentals)?.branch_id === branch)

  // Fleet stats — สโคปตามสาขาที่เลือก (ถ้ามี)
  const scopedBikes = branch ? bikes.filter(b => b.branch_id === branch) : bikes
  const total       = scopedBikes.length
  const available   = scopedBikes.filter(b => b.status === 'available').length
  const rented      = scopedBikes.filter(b => b.status === 'rented').length
  const locked      = scopedBikes.filter(b => b.status === 'locked').length // เกินกำหนดคืน ยังไม่จบสัญญา — รถยังไม่ว่าง
  const repair      = scopedBikes.filter(b => b.status === 'repair' || b.status === 'maintenance').length
  // ล็อคก็คือ "ไม่ว่าง" เหมือนกัน (แค่เกินกำหนด) เลยนับรวมเป็น utilization ด้วย
  const utilization = total > 0 ? Math.round(((rented + locked) / total) * 100) : 0

  // Revenue — ทั้งรายวันและรายเดือนนับจากเงินที่เก็บได้จริงตามวันทำรายการ (ตรงกับรีพอร์ต LINE)
  const rentalsRevenue   = rentalPayments.reduce((s, p) => s + Number(p.amount ?? 0), 0)
  const monthlyRentRev   = monthlyPaymentsScoped.reduce((s, p) => s + Number(p.amount ?? 0), 0)
  const monthlyRevenue   = rentalsRevenue + monthlyRentRev
  // นับจำนวนรายการ: สัญญาใหม่รายวัน + งวดที่เก็บได้ (ไม่นับต่อเวลา/ล่วงเวลาเป็นรายการแยก)
  const monthlyCount     = rentalPayments.filter(p => p.kind === 'rental').length + monthlyPaymentsScoped.length

  // เทียบกับช่วงก่อนหน้า
  const prevRentalsRevenue = (rentalsPrevRes.data ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0)
  const prevMonthlyPaymentsScoped = (monthlyPaymentsPrevRes.data ?? [] as any[]).filter(p => !branch || one((p as any).monthly_rentals)?.branch_id === branch)
  const prevMonthlyRentRev = prevMonthlyPaymentsScoped.reduce((s, p) => s + Number(p.amount ?? 0), 0)
  const prevRevenue = prevRentalsRevenue + prevMonthlyRentRev
  const prevCount = (rentalsPrevRes.data ?? []).filter(p => p.kind === 'rental').length + prevMonthlyPaymentsScoped.length
  const revenueCmp = pctChange(monthlyRevenue, prevRevenue)
  const countCmp   = pctChange(monthlyCount, prevCount)

  // 7-day bar chart
  const dayRevs: number[] = Array(7).fill(0)
  for (const p of rentalPayments) {
    const d = new Date(p.paid_at)
    const idx = Math.floor((d.getTime() - sevenDaysAgo.getTime()) / (24 * 60 * 60 * 1000))
    if (idx >= 0 && idx < 7) {
      dayRevs[idx] += Number(p.amount ?? 0)
    }
  }
  const maxRev = Math.max(...dayRevs, 1)

  // Revenue by branch (เฉพาะตอนดู "ทุกสาขา")
  const branchMap: Record<string, { name: string; revenue: number; bikeCount: number }> = {}
  for (const br of branches) {
    branchMap[br.id] = { name: br.name, revenue: 0, bikeCount: bikes.filter(b => b.branch_id === br.id).length }
  }
  for (const p of rentalPayments) {
    if (p.branch_id && branchMap[p.branch_id]) {
      branchMap[p.branch_id].revenue += Number(p.amount ?? 0)
    }
  }
  for (const p of monthlyPaymentsScoped) {
    const mr = one((p as any).monthly_rentals)
    if (mr?.branch_id && branchMap[mr.branch_id]) {
      branchMap[mr.branch_id].revenue += Number(p.amount ?? 0)
    }
  }
  const branchDonutData = branches.map((br, i) => ({ label: br.name, value: branchMap[br.id].revenue, color: DONUT_COLORS[i % DONUT_COLORS.length] }))

  // Top bikes / model revenue — from actual payments (นับครั้งเช่าเฉพาะสัญญาใหม่ แต่รายได้รวมต่อเวลา/ล่วงเวลา)
  // เช็คย้อนหลังว่าคันไหนใช้จริง ณ วันที่เก็บเงินก้อนนั้น (เผื่อสัญญาเคยสลับรถกลางทาง) แทนที่จะยึด
  // bike_id ปัจจุบันของสัญญาตรงๆ — ไม่งั้นเงินที่เก็บไปก่อนสลับจะถูกนับผิดไปอยู่กับคันใหม่ที่สลับทีหลัง
  const bikesById = new Map(bikes.map(b => [b.id, b]))
  const bikeRevMap: Record<string, { label: string; revenue: number; count: number }> = {}
  const modelRevMap: Record<string, { label: string; revenue: number }> = {}
  for (const p of rentalPayments) {
    const rental = one((p as any).rentals) as { bike_id?: string; swap_log?: unknown } | null
    if (!rental?.bike_id) continue
    const paidDateStr = String(p.paid_at).slice(0, 10)
    const historicalBikeId = getBikeIdAtDate(rental.bike_id, rental.swap_log as any, paidDateStr)
    const bike = bikesById.get(historicalBikeId)
    if (!bike) continue
    if (bike.license_plate) {
      const key = bike.license_plate
      if (!bikeRevMap[key]) bikeRevMap[key] = { label: `${bike.brand} ${bike.model} — ${bike.license_plate}`, revenue: 0, count: 0 }
      bikeRevMap[key].revenue += Number(p.amount ?? 0)
      if (p.kind === 'rental') bikeRevMap[key].count++
    }
    const mKey = `${bike.brand} ${bike.model}`
    if (!modelRevMap[mKey]) modelRevMap[mKey] = { label: mKey, revenue: 0 }
    modelRevMap[mKey].revenue += Number(p.amount ?? 0)
  }
  for (const p of monthlyPaymentsScoped) {
    const mr = one((p as any).monthly_rentals) as { bike_id?: string; swap_log?: unknown } | null
    if (!mr?.bike_id) continue
    const paidDateStr = String((p as any).paid_date).slice(0, 10)
    const historicalBikeId = getBikeIdAtDate(mr.bike_id, mr.swap_log as any, paidDateStr)
    const bike = bikesById.get(historicalBikeId)
    if (!bike) continue
    const mKey = `${bike.brand} ${bike.model}`
    if (!modelRevMap[mKey]) modelRevMap[mKey] = { label: mKey, revenue: 0 }
    modelRevMap[mKey].revenue += Number(p.amount ?? 0)
  }
  const topBikes = Object.values(bikeRevMap).sort((a, b) => b.revenue - a.revenue).slice(0, 3)
  const topModels = Object.values(modelRevMap).sort((a, b) => b.revenue - a.revenue).slice(0, 6)
  const modelDonutData = topModels.map((m, i) => ({ label: m.label, value: m.revenue, color: DONUT_COLORS[i % DONUT_COLORS.length] }))

  return (
    <div className="app-wrap" style={{ background: '#0f172a' }}>

      {/* Header */}
      <div className="app-header" style={{ background: '#0f172a', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ flex: 1 }}>
          <h1>Dashboard</h1>
          <div className="sub">ภาพรวมธุรกิจ — {periodLabel}</div>
        </div>
        <PeriodSelector current={period} currentFrom={from} currentTo={to} currentBranch={branch} />
        <form action="/api/owner/logout" method="POST" style={{ marginLeft: '8px' }}>
          <button style={{
            background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: '8px',
            color: '#fff', fontSize: '12px', padding: '6px 12px', cursor: 'pointer', fontWeight: 600,
          }}>ออก</button>
        </form>
      </div>

      {/* Branch filter */}
      <BranchSelector branches={branches} current={branch} period={period} from={from} to={to} />

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '16px 16px 0' }}>
        {([
          { icon: '💰', val: fmt(monthlyRevenue), lbl: `รายได้${periodLabel}`,  border: '#22c55e', color: '#22c55e', cmp: revenueCmp },
          { icon: '📋', val: String(monthlyCount), lbl: `รายการเช่า${periodLabel}`, border: '#38bdf8', color: '#38bdf8', cmp: countCmp },
          { icon: '🛵', val: `${utilization}%`,    lbl: 'อัตราการใช้งานรถ',     border: '#f59e0b', color: '#f59e0b', cmp: null },
          { icon: '📌', val: String(pendingCount),  lbl: 'งานค้างทั้งหมด',       border: '#ef4444', color: '#ef4444', cmp: null },
        ] as const).map(({ icon, val, lbl, border, color, cmp }) => (
          <div key={lbl} style={{
            background: '#1e293b', borderRadius: '14px', padding: '14px',
            border: '1px solid rgba(255,255,255,.06)', borderTop: `3px solid ${border}`,
          }}>
            <div style={{ fontSize: '22px', marginBottom: '6px' }}>{icon}</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color }}>{val}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{lbl}</div>
            <ChangeBadge cmp={cmp} />
          </div>
        ))}
      </div>

      {/* 7-day bar chart */}
      <Card>
        <CardTitle>📈 รายได้ 7 วันล่าสุด (บาท)</CardTitle>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px' }}>
          {dayRevs.map((rev, i) => {
            // sevenDaysAgo = เที่ยงคืนไทยของ 6 วันก่อน → แท่งสุดท้ายคือวันนี้เสมอ
            const d = new Date(sevenDaysAgo.getTime() + H7 + i * 24 * 60 * 60 * 1000)
            const isToday  = i === 6
            const heightPct = Math.max((rev / maxRev) * 100, 4)
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', height: '100%', justifyContent: 'flex-end' }}>
                {rev > 0 && (
                  <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600 }}>
                    {rev >= 1000 ? (rev / 1000).toFixed(1) + 'K' : rev}
                  </div>
                )}
                <div style={{
                  width: '100%', borderRadius: '4px 4px 0 0',
                  background: isToday ? '#22c55e' : '#334155',
                  height: `${heightPct}%`, minHeight: '4px',
                }} />
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: isToday ? 700 : 400 }}>
                  {DAY_SHORT[d.getUTCDay()]}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Fleet status */}
      <Card>
        <CardTitle>สถานะรถ{branch ? '' : 'ทั้งหมด'} ({total} คัน)</CardTitle>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {([
            { label: 'ว่าง',       count: available, bg: 'rgba(34,197,94,.12)', color: '#22c55e' },
            { label: 'เช่าอยู่',    count: rented,    bg: 'rgba(148,163,184,.12)', color: '#cbd5e1' },
            { label: 'เกินกำหนด',  count: locked,    bg: 'rgba(245,158,11,.12)', color: '#f59e0b' },
            { label: 'ซ่อม',       count: repair,    bg: 'rgba(239,68,68,.12)', color: '#ef4444' },
          ] as const).map(({ label, count, bg, color }) => (
            <div key={label} style={{ flex: 1, background: bg, borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 800, color }}>{count}</div>
              <div style={{ fontSize: '11px', color }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Utilization Rate</div>
        <div style={{ background: '#334155', borderRadius: '6px', height: '10px', overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(90deg,#22c55e,#4ade80)', height: '100%', width: `${utilization}%`, borderRadius: '6px' }} />
        </div>
        <div style={{ fontSize: '12px', color: '#22c55e', fontWeight: 700, marginTop: '4px' }}>
          {utilization}% — {utilization >= 80 ? 'ดีมาก' : utilization >= 60 ? 'ดี' : 'ควรปรับปรุง'}
        </div>
      </Card>

      {/* Revenue by branch — donut (เฉพาะตอนดูทุกสาขา) */}
      {!branch && branches.length > 0 && (
        <Card>
          <CardTitle>🍩 รายได้แยกตามสาขา</CardTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ flexShrink: 0 }}><Donut data={branchDonutData} /></div>
            <div style={{ flex: 1 }}><DonutLegend data={branchDonutData} fmtValue={fmt} /></div>
          </div>
        </Card>
      )}

      {/* Revenue by model */}
      {modelDonutData.length > 0 && (
        <Card>
          <CardTitle>🍩 ผลงานแยกตามรุ่นรถ</CardTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ flexShrink: 0 }}><Donut data={modelDonutData} /></div>
            <div style={{ flex: 1 }}><DonutLegend data={modelDonutData} fmtValue={fmt} /></div>
          </div>
        </Card>
      )}

      {/* Top bikes */}
      {topBikes.length > 0 && (
        <Card>
          <CardTitle>🏆 รถที่สร้างรายได้สูงสุด</CardTitle>
          {topBikes.map((bike, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,.06)' : 'none' }}>
              <div style={{ fontSize: '22px' }}>{['🥇', '🥈', '🥉'][i]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>{bike.label}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>เช่า {bike.count} ครั้ง</div>
              </div>
              <div style={{ fontWeight: 700, color: '#22c55e' }}>{fmt(bike.revenue)}</div>
            </div>
          ))}
        </Card>
      )}

      {/* รายรับ vs รายจ่าย */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>💹 รายรับ vs รายจ่าย</div>
          <button style={{ background: 'none', border: '1px solid #334155', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', color: '#cbd5e1', cursor: 'pointer' }}>
            + บันทึกค่าใช้จ่าย
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          <div style={{ background: 'rgba(34,197,94,.12)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>รายรับ</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#22c55e' }}>{fmt(monthlyRevenue)}</div>
          </div>
          <div style={{ background: 'rgba(239,68,68,.12)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>รายจ่าย</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#ef4444' }}>{fmt(totalExpenses)}</div>
          </div>
        </div>
        {(() => {
          const profit = monthlyRevenue - totalExpenses
          return (
            <div style={{ background: profit >= 0 ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>กำไรสุทธิ (ประมาณ)</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: profit >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(profit)}</div>
            </div>
          )
        })()}
      </Card>

      {/* Recent transactions */}
      <Card>
        <CardTitle>รายการล่าสุด</CardTitle>
        {bookingsRecent.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '16px 0' }}>ยังไม่มีรายการ</div>
        ) : bookingsRecent.map((bk, i) => {
          const bike = one((bk as any).bikes) as { license_plate?: string } | null
          const amt = (bk.daily_rate ?? 0) * (bk.total_days ?? 0)
          const icon  = bk.status === 'completed' ? '📥' : bk.status === 'active' ? '📤' : '📅'
          const label = bk.status === 'completed' ? 'รับรถคืน' : bk.status === 'active' ? 'ส่งรถ' : 'จองล่วงหน้า'
          const dateStr = new Date(bk.start_datetime).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
          return (
            <div key={bk.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,.06)' : 'none' }}>
              <div style={{ fontSize: '22px' }}>{icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>{label} — {bk.customer_name}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{bike?.license_plate ?? '—'} • {dateStr}</div>
              </div>
              <div style={{ fontWeight: 700, color: '#22c55e' }}>{amt > 0 ? fmt(amt) : '—'}</div>
            </div>
          )
        })}
      </Card>

      {/* Management links */}
      <div style={{ margin: '0 16px 80px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {([
          { icon: '➕', label: 'เพิ่มรถคันใหม่',     sub: 'ลงทะเบียนรถและสร้าง QR Code',       href: '/owner/bikes/add',  color: '#f1f5f9' },
          { icon: '🛵', label: 'รายการรถทั้งหมด',  sub: 'ดู/แก้ไขข้อมูลรถทุกสาขา',           href: '/owner/bikes',      color: '#cbd5e1' },
          { icon: '📋', label: 'ประวัติการเช่า',   sub: 'การเช่าที่ active อยู่ + คืนรถ',      href: '/owner/rentals',    color: '#22c55e' },
          { icon: '📜', label: 'Activity Log',    sub: 'ใครทำอะไร เมื่อไหร่ในระบบ',           href: '/owner/logs',       color: '#cbd5e1' },
          { icon: '🧾', label: 'Statement บัญชี',  sub: 'รายรับรายจ่ายทุกสาขา + waive รายการผิด', href: '/owner/statement',  color: '#22c55e' },
          { icon: '💸', label: 'บันทึกค่าใช้จ่าย', sub: 'รายจ่ายประจำเดือนของร้าน',           href: '/owner/expenses',   color: '#ef4444' },
          { icon: '⛔', label: 'บัญชีแบล็คลิสต์',  sub: 'มิจฉาชีพ/ขโมยรถ — เช็คอัตโนมัติตอนทำสัญญา', href: '/owner/blacklist',  color: '#ef4444' },
          { icon: '⚙️', label: 'ตั้งค่าระบบ',      sub: 'พนักงาน, สาขา, โปรโมชั่น',          href: '/owner/settings',   color: '#cbd5e1' },
        ] as const).map(({ icon, label, sub, href, color }) => (
          <Link key={href} href={href} style={{ textDecoration: 'none' }}>
            <div style={{
              background: '#1e293b', borderRadius: '14px', padding: '16px',
              border: '1px solid rgba(255,255,255,.06)',
              display: 'flex', alignItems: 'center', gap: '14px',
              borderLeft: `4px solid ${color}`,
            }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                background: `${color}22`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '22px',
              }}>{icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#f1f5f9' }}>{label}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{sub}</div>
              </div>
              <div style={{ color: '#475569', fontSize: '18px' }}>›</div>
            </div>
          </Link>
        ))}
      </div>

    </div>
  )
}
