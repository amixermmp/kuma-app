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
  const now = new Date()

  // Date range based on period
  let periodStart: Date
  let periodEnd: Date = new Date(now)
  let periodLabel: string

  if (period === 'custom' && from && to) {
    periodStart = new Date(`${from}T00:00:00`)
    periodEnd   = new Date(`${to}T23:59:59`)
    const fmtD  = (d: Date) => `${d.getDate()} ${MONTHS_TH_FULL[d.getMonth()].slice(0, 3)}. ${d.getFullYear() + 543}`
    periodLabel = `${fmtD(periodStart)} — ${fmtD(periodEnd)}`
  } else if (period === 'today') {
    periodStart = new Date(now); periodStart.setHours(0, 0, 0, 0)
    periodEnd = new Date(now); periodEnd.setHours(23, 59, 59, 999)
    periodLabel = 'วันนี้'
  } else if (period === 'week') {
    periodStart = new Date(now); periodStart.setDate(now.getDate() - 6); periodStart.setHours(0, 0, 0, 0)
    periodLabel = '7 วันล่าสุด'
  } else {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    periodEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    periodLabel = MONTHS_TH_FULL[now.getMonth()] + ' ' + (now.getFullYear() + 543)
  }

  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(now.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const periodStartDate = periodStart.toISOString().split('T')[0]
  const periodEndDate   = periodEnd.toISOString().split('T')[0]

  const [bikesRes, bookingsMonthRes, bookingsRecentRes, branchesRes, pendingRes, rentalsMonthRes, monthlyRentalsRes, expensesRes, repairCostsRes] = await Promise.all([
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
    // Daily rentals — นับเมื่อส่งรถจริงเท่านั้น (ทั้ง walk-in และจากการจอง)
    admin.from('rentals')
      .select('total_amount, branch_id, start_datetime, bikes(license_plate, brand, model)')
      .in('status', ['active', 'extended', 'completed'])
      .gte('start_datetime', periodStart.toISOString())
      .lte('start_datetime', periodEnd.toISOString()),
    // Monthly rentals
    admin.from('monthly_rentals')
      .select('monthly_rate, branch_id, start_date')
      .eq('status', 'active')
      .gte('start_date', periodStartDate)
      .lte('start_date', periodEndDate),
    // Expenses
    admin.from('expenses')
      .select('amount')
      .gte('expense_date', periodStartDate)
      .lte('expense_date', periodEndDate),
    // Repair costs
    admin.from('repairs')
      .select('repair_cost')
      .eq('status', 'done')
      .not('repair_cost', 'is', null)
      .gte('resolved_at', periodStart.toISOString())
      .lte('resolved_at', periodEnd.toISOString()),
  ])

  const bikes          = bikesRes.data ?? []
  const bookingsMonth  = bookingsMonthRes.data ?? []
  const bookingsRecent = bookingsRecentRes.data ?? []
  const branches       = branchesRes.data ?? []
  const pendingCount   = pendingRes.count ?? 0
  const rentalsMonth    = rentalsMonthRes.data ?? []
  const monthlyRentals  = monthlyRentalsRes.data ?? []
  const totalExpenses   = (expensesRes.data ?? []).reduce((s, e) => s + (Number(e.amount) || 0), 0)
                        + (repairCostsRes.data ?? []).reduce((s, r) => s + (Number(r.repair_cost) || 0), 0)

  // Fleet stats
  const total       = bikes.length
  const available   = bikes.filter(b => b.status === 'available').length
  const rented      = bikes.filter(b => b.status === 'rented').length
  const repair      = bikes.filter(b => b.status === 'repair').length
  const utilization = total > 0 ? Math.round((rented / total) * 100) : 0

  // Monthly revenue — นับเฉพาะตอนส่งรถจริง ไม่นับการจองล่วงหน้า
  const rentalsRevenue   = rentalsMonth.reduce((s, r) => s + (r.total_amount ?? 0), 0)
  const monthlyRentRev   = monthlyRentals.reduce((s, r) => s + (r.monthly_rate ?? 0), 0)
  const monthlyRevenue   = rentalsRevenue + monthlyRentRev
  const monthlyCount     = rentalsMonth.length + monthlyRentals.length

  // 7-day bar chart
  const dayRevs: number[] = Array(7).fill(0)
  for (const r of rentalsMonth) {
    const d = new Date(r.start_datetime)
    const idx = Math.floor((d.getTime() - sevenDaysAgo.getTime()) / (24 * 60 * 60 * 1000))
    if (idx >= 0 && idx < 7) {
      dayRevs[idx] += r.total_amount ?? 0
    }
  }
  const maxRev = Math.max(...dayRevs, 1)

  // Revenue by branch
  const branchMap: Record<string, { name: string; revenue: number; bikeCount: number }> = {}
  for (const br of branches) {
    branchMap[br.id] = { name: br.name, revenue: 0, bikeCount: bikes.filter(b => b.branch_id === br.id).length }
  }
  for (const r of rentalsMonth) {
    if (r.branch_id && branchMap[r.branch_id]) {
      branchMap[r.branch_id].revenue += r.total_amount ?? 0
    }
  }
  for (const r of monthlyRentals) {
    if (r.branch_id && branchMap[r.branch_id]) {
      branchMap[r.branch_id].revenue += r.monthly_rate ?? 0
    }
  }

  // Top bikes — from actual rentals only
  const bikeRevMap: Record<string, { label: string; revenue: number; count: number }> = {}
  for (const r of rentalsMonth) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bike = Array.isArray((r as any).bikes) ? (r as any).bikes[0] : (r as any).bikes as { license_plate?: string; brand?: string; model?: string } | null
    if (!bike?.license_plate) continue
    const key = bike.license_plate
    if (!bikeRevMap[key]) bikeRevMap[key] = { label: `${bike.brand} ${bike.model} — ${bike.license_plate}`, revenue: 0, count: 0 }
    bikeRevMap[key].revenue += r.total_amount ?? 0
    bikeRevMap[key].count++
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
            const d = new Date(sevenDaysAgo)
            d.setDate(d.getDate() + i)
            const isToday  = d.toDateString() === now.toDateString()
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
                  {DAY_SHORT[d.getDay()]}
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
            { label: 'ว่าง',    count: available, bg: '#f0fdf4', color: '#16a34a' },
            { label: 'เช่าอยู่', count: rented,    bg: '#f1f5f9', color: '#374151' },
            { label: 'ซ่อม',    count: repair,    bg: '#fef2f2', color: '#dc2626' },
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
          { icon: '💸', label: 'บันทึกค่าใช้จ่าย', sub: 'รายจ่ายประจำเดือนของร้าน',           href: '/owner/expenses',   color: '#dc2626' },
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
