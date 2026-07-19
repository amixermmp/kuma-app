import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { PeriodSelector } from './PeriodSelector'

export const dynamic = 'force-dynamic'

const MONTHS_TH_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
const DAY_SHORT = ['อา','จ','อ','พ','พฤ','ศ','ส']

function fmt(n: number) {
  return '฿' + n.toLocaleString('th-TH')
}

export default async function OwnerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const { period = 'month', from, to } = await searchParams

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

  const [bikesRes, bookingsMonthRes, bookingsRecentRes, branchesRes, pendingRes, rentalsMonthRes, monthlyPaymentsRes, expensesRes, repairCostsRes] = await Promise.all([
    admin.from('bikes').select('id, status, branch_id, brand, model, license_plate'),
    admin.from('bookings')
      .select('id, branch_id, daily_rate, total_days, start_datetime, customer_name, bikes(license_plate, brand, model)')
      .in('status', ['confirmed', 'active', 'completed'])
      .gte('start_datetime', periodStart.toISOString())
      .lte('start_datetime', periodEnd.toISOString()),
    admin.from('bookings')
      .select('id, status, customer_name, start_datetime, daily_rate, total_days, bikes(license_plate)')
      .in('status', ['confirmed', 'active', 'completed'])
      .order('start_datetime', { ascending: false })
      .limit(5),
    admin.from('branches').select('id, name').order('name'),
    admin.from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .lte('start_datetime', new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()),
    // Daily rentals — นับเงินตามวันที่เก็บจริง (เปิดสัญญา/ต่อเวลา/ค่าล่วงเวลาตอนคืน)
    admin.from('rental_payments')
      .select('amount, kind, paid_at, branch_id, rentals(bikes(license_plate, brand, model))')
      .is('voided_at', null)
      .gte('paid_at', periodStart.toISOString())
      .lte('paid_at', periodEnd.toISOString()),
    // Monthly payments — นับเงินที่เก็บได้จริงในช่วง (งวดแรกของสัญญาใหม่ก็ลงตารางนี้)
    admin.from('monthly_payments')
      .select('amount, paid_date, monthly_rentals(branch_id)')
      .in('status', ['paid', 'partial'])
      .is('voided_at', null)
      .gte('paid_date', periodStartDate)
      .lte('paid_date', periodEndDate),
    // Expenses
    admin.from('expenses')
      .select('amount')
      .is('voided_at', null)
      .gte('expense_date', periodStartDate)
      .lte('expense_date', periodEndDate),
    // Repair costs
    admin.from('repairs')
      .select('repair_cost')
      .eq('status', 'done')
      .not('repair_cost', 'is', null)
      .is('voided_at', null)
      .gte('resolved_at', periodStart.toISOString())
      .lte('resolved_at', periodEnd.toISOString()),
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

  // Fleet stats
  const total       = bikes.length
  const available   = bikes.filter(b => b.status === 'available').length
  const rented      = bikes.filter(b => b.status === 'rented').length
  const locked      = bikes.filter(b => b.status === 'locked').length // เกินกำหนดคืน ยังไม่จบสัญญา — รถยังไม่ว่าง
  const repair      = bikes.filter(b => b.status === 'repair' || b.status === 'maintenance').length
  // ล็อคก็คือ "ไม่ว่าง" เหมือนกัน (แค่เกินกำหนด) เลยนับรวมเป็น utilization ด้วย
  const utilization = total > 0 ? Math.round(((rented + locked) / total) * 100) : 0

  // Revenue — ทั้งรายวันและรายเดือนนับจากเงินที่เก็บได้จริงตามวันทำรายการ (ตรงกับรีพอร์ต LINE)
  const rentalsRevenue   = rentalPayments.reduce((s, p) => s + Number(p.amount ?? 0), 0)
  const monthlyRentRev   = monthlyPayments.reduce((s, p) => s + Number(p.amount ?? 0), 0)
  const monthlyRevenue   = rentalsRevenue + monthlyRentRev
  // นับจำนวนรายการ: สัญญาใหม่รายวัน + งวดที่เก็บได้ (ไม่นับต่อเวลา/ล่วงเวลาเป็นรายการแยก)
  const monthlyCount     = rentalPayments.filter(p => p.kind === 'rental').length + monthlyPayments.length

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

  // Revenue by branch
  const branchMap: Record<string, { name: string; revenue: number; bikeCount: number }> = {}
  for (const br of branches) {
    branchMap[br.id] = { name: br.name, revenue: 0, bikeCount: bikes.filter(b => b.branch_id === br.id).length }
  }
  for (const p of rentalPayments) {
    if (p.branch_id && branchMap[p.branch_id]) {
      branchMap[p.branch_id].revenue += Number(p.amount ?? 0)
    }
  }
  for (const p of monthlyPayments) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mr = Array.isArray((p as any).monthly_rentals) ? (p as any).monthly_rentals[0] : (p as any).monthly_rentals as { branch_id?: string } | null
    if (mr?.branch_id && branchMap[mr.branch_id]) {
      branchMap[mr.branch_id].revenue += Number(p.amount ?? 0)
    }
  }

  // Top bikes — from actual payments (นับครั้งเช่าเฉพาะสัญญาใหม่ แต่รายได้รวมต่อเวลา/ล่วงเวลา)
  const bikeRevMap: Record<string, { label: string; revenue: number; count: number }> = {}
  for (const p of rentalPayments) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rental = Array.isArray((p as any).rentals) ? (p as any).rentals[0] : (p as any).rentals
    const bike = Array.isArray(rental?.bikes) ? rental.bikes[0] : rental?.bikes as { license_plate?: string; brand?: string; model?: string } | null
    if (!bike?.license_plate) continue
    const key = bike.license_plate
    if (!bikeRevMap[key]) bikeRevMap[key] = { label: `${bike.brand} ${bike.model} — ${bike.license_plate}`, revenue: 0, count: 0 }
    bikeRevMap[key].revenue += Number(p.amount ?? 0)
    if (p.kind === 'rental') bikeRevMap[key].count++
  }
  const topBikes = Object.values(bikeRevMap).sort((a, b) => b.revenue - a.revenue).slice(0, 3)

  const monthName = MONTHS_TH_FULL[now.getMonth()] + ' ' + (now.getFullYear() + 543)

  return (
    <div className="app-wrap">

      {/* Header */}
      <div className="app-header" style={{ background: '#111827', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <h1>Dashboard</h1>
          <div className="sub">ภาพรวมธุรกิจ — {periodLabel}</div>
        </div>
        <PeriodSelector current={period} currentFrom={from} currentTo={to} />
        <form action="/api/owner/logout" method="POST" style={{ marginLeft: '8px' }}>
          <button style={{
            background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '8px',
            color: '#fff', fontSize: '12px', padding: '6px 12px', cursor: 'pointer', fontWeight: 600,
          }}>ออก</button>
        </form>
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '16px 16px 0' }}>
        {([
          { icon: '💰', val: fmt(monthlyRevenue), lbl: `รายได้${periodLabel}`,  border: '#16a34a', color: '#16a34a' },
          { icon: '📋', val: String(monthlyCount), lbl: `รายการเช่า${periodLabel}`, border: '#374151', color: '#374151' },
          { icon: '🛵', val: `${utilization}%`,    lbl: 'อัตราการใช้งานรถ',     border: '#d97706', color: '#d97706' },
          { icon: '📌', val: String(pendingCount),  lbl: 'งานค้างทั้งหมด',       border: '#dc2626', color: '#dc2626' },
        ] as const).map(({ icon, val, lbl, border, color }) => (
          <div key={lbl} style={{
            background: '#fff', borderRadius: '14px', padding: '14px',
            boxShadow: '0 1px 4px rgba(0,0,0,.07)', borderTop: `3px solid ${border}`,
          }}>
            <div style={{ fontSize: '22px', marginBottom: '6px' }}>{icon}</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color }}>{val}</div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* 7-day bar chart */}
      <div style={{ margin: '16px', background: '#fff', borderRadius: '14px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '14px' }}>📈 รายได้ 7 วันล่าสุด (บาท)</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px' }}>
          {dayRevs.map((rev, i) => {
            // sevenDaysAgo = เที่ยงคืนไทยของ 6 วันก่อน → แท่งสุดท้ายคือวันนี้เสมอ
            const d = new Date(sevenDaysAgo.getTime() + H7 + i * 24 * 60 * 60 * 1000)
            const isToday  = i === 6
            const heightPct = Math.max((rev / maxRev) * 100, 4)
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', height: '100%', justifyContent: 'flex-end' }}>
                {rev > 0 && (
                  <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: 600 }}>
                    {rev >= 1000 ? (rev / 1000).toFixed(1) + 'K' : rev}
                  </div>
                )}
                <div style={{
                  width: '100%', borderRadius: '4px 4px 0 0',
                  background: isToday ? '#e11d48' : '#e5e7eb',
                  height: `${heightPct}%`, minHeight: '4px',
                }} />
                <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: isToday ? 700 : 400 }}>
                  {DAY_SHORT[d.getUTCDay()]}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Fleet status */}
      <div style={{ margin: '0 16px 16px', background: '#fff', borderRadius: '14px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '12px' }}>สถานะรถทั้งหมด ({total} คัน)</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {([
            { label: 'ว่าง',       count: available, bg: '#f0fdf4', color: '#16a34a' },
            { label: 'เช่าอยู่',    count: rented,    bg: '#f1f5f9', color: '#374151' },
            { label: 'เกินกำหนด',  count: locked,    bg: '#fff7ed', color: '#c2410c' },
            { label: 'ซ่อม',       count: repair,    bg: '#fef2f2', color: '#dc2626' },
          ] as const).map(({ label, count, bg, color }) => (
            <div key={label} style={{ flex: 1, background: bg, borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 800, color }}>{count}</div>
              <div style={{ fontSize: '11px', color }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Utilization Rate</div>
        <div style={{ background: '#e5e7eb', borderRadius: '6px', height: '10px', overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(90deg,#16a34a,#34d399)', height: '100%', width: `${utilization}%`, borderRadius: '6px' }} />
        </div>
        <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 700, marginTop: '4px' }}>
          {utilization}% — {utilization >= 80 ? 'ดีมาก' : utilization >= 60 ? 'ดี' : 'ควรปรับปรุง'}
        </div>
      </div>

      {/* Revenue by branch */}
      {branches.length > 0 && (
        <div style={{ margin: '0 16px 16px', background: '#fff', borderRadius: '14px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '12px' }}>รายได้แยกตามสาขา</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                {['สาขา', 'รายได้', 'รถ', 'Util.'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '0 8px 8px 0', fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {branches.map(br => {
                const d = branchMap[br.id]
                const branchRented = bikes.filter(b => b.branch_id === br.id && b.status === 'rented').length
                const branchUtil   = d.bikeCount > 0 ? Math.round((branchRented / d.bikeCount) * 100) : 0
                return (
                  <tr key={br.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 8px 8px 0', fontWeight: 600 }}>{br.name}</td>
                    <td style={{ padding: '8px 8px 8px 0', fontWeight: 700, color: '#16a34a' }}>{fmt(d.revenue)}</td>
                    <td style={{ padding: '8px 8px 8px 0', color: '#6b7280' }}>{d.bikeCount} คัน</td>
                    <td style={{ padding: '8px 0' }}>
                      <div style={{ background: '#e5e7eb', borderRadius: '4px', height: '6px', width: '60px' }}>
                        <div style={{ background: '#111827', height: '100%', width: `${branchUtil}%`, borderRadius: '4px' }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Top bikes */}
      {topBikes.length > 0 && (
        <div style={{ margin: '0 16px 16px', background: '#fff', borderRadius: '14px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '12px' }}>🏆 รถที่สร้างรายได้สูงสุด</div>
          {topBikes.map((bike, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
              <div style={{ fontSize: '22px' }}>{['🥇', '🥈', '🥉'][i]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{bike.label}</div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>เช่า {bike.count} ครั้ง</div>
              </div>
              <div style={{ fontWeight: 700, color: '#16a34a' }}>{fmt(bike.revenue)}</div>
            </div>
          ))}
        </div>
      )}

      {/* รายรับ vs รายจ่าย */}
      <div style={{ margin: '0 16px 16px', background: '#fff', borderRadius: '14px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>💹 รายรับ vs รายจ่าย</div>
          <button style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', color: '#374151', cursor: 'pointer' }}>
            + บันทึกค่าใช้จ่าย
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>รายรับ</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a' }}>{fmt(monthlyRevenue)}</div>
          </div>
          <div style={{ background: '#fef2f2', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>รายจ่าย</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626' }}>{fmt(totalExpenses)}</div>
          </div>
        </div>
        {(() => {
          const profit = monthlyRevenue - totalExpenses
          return (
            <div style={{ background: profit >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: '10px', padding: '12px', textAlign: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>กำไรสุทธิ (ประมาณ)</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: profit >= 0 ? '#16a34a' : '#dc2626' }}>{fmt(profit)}</div>
            </div>
          )
        })()}
      </div>

      {/* Recent transactions */}
      <div style={{ margin: '0 16px 16px', background: '#fff', borderRadius: '14px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '12px' }}>รายการล่าสุด</div>
        {bookingsRecent.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>ยังไม่มีรายการ</div>
        ) : bookingsRecent.map((bk, i) => {
          const bike = Array.isArray(bk.bikes) ? bk.bikes[0] : bk.bikes as { license_plate?: string } | null
          const amt = (bk.daily_rate ?? 0) * (bk.total_days ?? 0)
          const icon  = bk.status === 'completed' ? '📥' : bk.status === 'active' ? '📤' : '📅'
          const label = bk.status === 'completed' ? 'รับรถคืน' : bk.status === 'active' ? 'ส่งรถ' : 'จองล่วงหน้า'
          const dateStr = new Date(bk.start_datetime).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
          return (
            <div key={bk.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
              <div style={{ fontSize: '22px' }}>{icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{label} — {bk.customer_name}</div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>{bike?.license_plate ?? '—'} • {dateStr}</div>
              </div>
              <div style={{ fontWeight: 700, color: '#16a34a' }}>{amt > 0 ? fmt(amt) : '—'}</div>
            </div>
          )
        })}
      </div>

      {/* Management links */}
      <div style={{ margin: '0 16px 80px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {([
          { icon: '➕', label: 'เพิ่มรถคันใหม่',     sub: 'ลงทะเบียนรถและสร้าง QR Code',       href: '/owner/bikes/add',  color: '#111827' },
          { icon: '🛵', label: 'รายการรถทั้งหมด',  sub: 'ดู/แก้ไขข้อมูลรถทุกสาขา',           href: '/owner/bikes',      color: '#374151' },
          { icon: '📋', label: 'ประวัติการเช่า',   sub: 'การเช่าที่ active อยู่ + คืนรถ',      href: '/owner/rentals',    color: '#059669' },
          { icon: '📜', label: 'Activity Log',    sub: 'ใครทำอะไร เมื่อไหร่ในระบบ',           href: '/owner/logs',       color: '#374151' },
          { icon: '🧾', label: 'Statement บัญชี',  sub: 'รายรับรายจ่ายทุกสาขา + waive รายการผิด', href: '/owner/statement',  color: '#059669' },
          { icon: '💸', label: 'บันทึกค่าใช้จ่าย', sub: 'รายจ่ายประจำเดือนของร้าน',           href: '/owner/expenses',   color: '#dc2626' },
          { icon: '⛔', label: 'บัญชีแบล็คลิสต์',  sub: 'มิจฉาชีพ/ขโมยรถ — เช็คอัตโนมัติตอนทำสัญญา', href: '/owner/blacklist',  color: '#991b1b' },
          { icon: '⚙️', label: 'ตั้งค่าระบบ',      sub: 'พนักงาน, สาขา, โปรโมชั่น',          href: '/owner/settings',   color: '#374151' },
        ] as const).map(({ icon, label, sub, href, color }) => (
          <Link key={href} href={href} style={{ textDecoration: 'none' }}>
            <div style={{
              background: '#fff', borderRadius: '14px', padding: '16px',
              boxShadow: '0 1px 4px rgba(0,0,0,.07)',
              display: 'flex', alignItems: 'center', gap: '14px',
              borderLeft: `4px solid ${color}`,
            }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                background: `${color}15`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '22px',
              }}>{icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>{label}</div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{sub}</div>
              </div>
              <div style={{ color: '#d1d5db', fontSize: '18px' }}>›</div>
            </div>
          </Link>
        ))}
      </div>

    </div>
  )
}
