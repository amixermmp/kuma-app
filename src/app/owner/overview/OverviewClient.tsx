'use client'

import { useState } from 'react'
import type { AtShopBike, DailyRental, MonthlyRental, RepairJob, ShopOverviewGroups } from '@/lib/shopOverview'

type FilterKey = 'all' | 'atshop' | 'daily' | 'monthly' | 'repair'

type Props = { groups: ShopOverviewGroups; showBranchName: boolean }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false })
}
function hoursUntil(iso: string) {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 3_600_000)
}
function isTodayBkk(iso: string) {
  const d = (s: string) => new Date(s).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
  return d(iso) === d(new Date().toISOString())
}

export default function OverviewClient({ groups, showBranchName }: Props) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const chips: { key: FilterKey; label: string; count: number; color: string }[] = [
    { key: 'all',     label: 'ทั้งหมด',        count: groups.atShop.length + groups.dailyRentals.length + groups.monthlyRentals.length + groups.repairs.length, color: '#e2e8f0' },
    { key: 'atshop',  label: 'อยู่ที่ร้าน',    count: groups.atShop.length,        color: '#22c55e' },
    { key: 'daily',   label: 'รายวัน/สัปดาห์', count: groups.dailyRentals.length,  color: '#ef4444' },
    { key: 'monthly', label: 'รายเดือน',       count: groups.monthlyRentals.length, color: '#a78bfa' },
    { key: 'repair',  label: 'ซ่อม',           count: groups.repairs.length,       color: '#f59e0b' },
  ]

  const show = (key: FilterKey) => filter === 'all' || filter === key

  return (
    <div style={{ padding: '4px 0 40px' }}>
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '12px 16px' }}>
        {chips.map(({ key, label, count, color }) => {
          const active = filter === key
          return (
            <button key={key} onClick={() => setFilter(key)} style={{
              flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
              background: active ? color : 'transparent',
              color: active ? '#0f172a' : color,
              border: `1.5px solid ${color}`, borderRadius: '10px', padding: '6px 14px', minWidth: '72px',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <span style={{ fontSize: '16px', fontWeight: 800 }}>{count}</span>
              <span style={{ fontSize: '10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
            </button>
          )
        })}
      </div>

      {show('atshop') && (
        <Section title="รถอยู่ที่ร้านตอนนี้" count={groups.atShop.length} showHeader={filter === 'all'}>
          {groups.atShop.map(b => <AtShopCard key={b.id} bike={b} showBranchName={showBranchName} />)}
        </Section>
      )}
      {show('daily') && (
        <Section title="เช่ารายวัน/รายสัปดาห์" count={groups.dailyRentals.length} showHeader={filter === 'all'}>
          {groups.dailyRentals.map(r => <DailyCard key={r.id} rental={r} showBranchName={showBranchName} />)}
        </Section>
      )}
      {show('monthly') && (
        <Section title="เช่ารายเดือน" count={groups.monthlyRentals.length} showHeader={filter === 'all'}>
          {groups.monthlyRentals.map(r => <MonthlyCard key={r.id} rental={r} showBranchName={showBranchName} />)}
        </Section>
      )}
      {show('repair') && (
        <Section title="ซ่อม" count={groups.repairs.length} showHeader={filter === 'all'}>
          {groups.repairs.map(r => <RepairCard key={r.id} repair={r} showBranchName={showBranchName} />)}
        </Section>
      )}
    </div>
  )
}

function Section({ title, count, showHeader, children }: { title: string; count: number; showHeader: boolean; children: React.ReactNode }) {
  if (count === 0) {
    if (!showHeader) return <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748b', fontSize: '13px' }}>ไม่มีรายการ</div>
    return null
  }
  return (
    <div style={{ margin: '0 16px 16px' }}>
      {showHeader && (
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', padding: '10px 2px 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {title} ({count})
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>{children}</div>
    </div>
  )
}

function GridCard({ accentColor, title, subtitle, lines, pills }: {
  accentColor: string; title: string; subtitle: string
  lines: string[]
  pills: { label: string; color: string }[]
}) {
  return (
    <div style={{
      background: '#1e293b', borderRadius: '14px', padding: '12px 12px 10px',
      border: '1px solid rgba(255,255,255,.06)', borderTop: `3px solid ${accentColor}`,
      display: 'flex', flexDirection: 'column', gap: '3px',
    }}>
      <div style={{ fontSize: '14px', fontWeight: 800, color: '#e2e8f0' }}>{title}</div>
      <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>{subtitle}</div>
      {lines.map((l, i) => (
        <div key={i} style={{ fontSize: '11px', color: '#94a3b8' }}>{l}</div>
      ))}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
        {pills.map((p, i) => (
          <span key={i} style={{ fontSize: '10px', fontWeight: 700, color: p.color, display: 'inline-block' }}>{p.label}</span>
        ))}
      </div>
    </div>
  )
}

function branchSuffix(name: string, show: boolean) {
  return show && name ? ` • ${name}` : ''
}

function AtShopCard({ bike, showBranchName }: { bike: AtShopBike; showBranchName: boolean }) {
  const pills = [{ label: 'ว่าง', color: '#22c55e' }]
  if (bike.dueTasks.length > 0) pills.push({ label: `🛢️ ถึงกำหนด: ${bike.dueTasks.join(', ')}`, color: '#ef4444' })
  return (
    <GridCard
      accentColor={bike.dueTasks.length > 0 ? '#ef4444' : '#22c55e'}
      title={`${bike.licensePlate}${branchSuffix(bike.branchName, showBranchName)}`}
      subtitle={`${bike.brand} ${bike.model}`}
      lines={[`📍 ${bike.odometer.toLocaleString()} กม. • ฿${bike.dailyRate.toLocaleString()}/วัน`]}
      pills={pills}
    />
  )
}

function DailyCard({ rental, showBranchName }: { rental: DailyRental; showBranchName: boolean }) {
  const hrs = hoursUntil(rental.expectedEndDatetime)
  let pill: { label: string; color: string }, accentColor: string
  if (hrs < 0) { pill = { label: `เกินกำหนด ${Math.abs(hrs)} ชม.`, color: '#ef4444' }; accentColor = '#ef4444' }
  else if (isTodayBkk(rental.expectedEndDatetime)) { pill = { label: `คืนวันนี้ ${fmtTime(rental.expectedEndDatetime)}`, color: '#f59e0b' }; accentColor = '#f59e0b' }
  else { pill = { label: `คืน ${fmtDate(rental.expectedEndDatetime)}`, color: '#f87171' }; accentColor = '#ef4444' }
  const lines = [`👤 ${rental.customerName}${rental.customerPhone ? ' • ' + rental.customerPhone : ''}`]
  if (rental.returnType === 'offsite') lines.push(`🛵 คืนที่: ${rental.returnAddress || 'นอกสถานที่'}`)
  const pills = [pill]
  if (rental.dueTasks.length > 0) pills.push({ label: `🛢️ ถึงกำหนด: ${rental.dueTasks.join(', ')}`, color: '#ef4444' })
  return (
    <GridCard
      accentColor={rental.dueTasks.length > 0 ? '#ef4444' : accentColor}
      title={`${rental.licensePlate}${branchSuffix(rental.branchName, showBranchName)}`}
      subtitle={`${rental.brand} ${rental.model}`}
      lines={lines}
      pills={pills}
    />
  )
}

function MonthlyCard({ rental, showBranchName }: { rental: MonthlyRental; showBranchName: boolean }) {
  const pills = [{ label: 'รายเดือน', color: '#a78bfa' }]
  if (rental.dueTasks.length > 0) pills.push({ label: `🛢️ ถึงกำหนด: ${rental.dueTasks.join(', ')}`, color: '#ef4444' })
  return (
    <GridCard
      accentColor={rental.dueTasks.length > 0 ? '#ef4444' : '#a78bfa'}
      title={`${rental.licensePlate}${branchSuffix(rental.branchName, showBranchName)}`}
      subtitle={`${rental.brand} ${rental.model}`}
      lines={[
        `👤 ${rental.customerName}${rental.customerPhone ? ' • ' + rental.customerPhone : ''}`,
        `฿${rental.monthlyRate.toLocaleString()}/เดือน • ครบวันที่ ${rental.paymentDay}`,
      ]}
      pills={pills}
    />
  )
}

function RepairCard({ repair, showBranchName }: { repair: RepairJob; showBranchName: boolean }) {
  return (
    <GridCard
      accentColor="#f59e0b"
      title={`${repair.licensePlate}${branchSuffix(repair.branchName, showBranchName)}`}
      subtitle={`${repair.brand} ${repair.model}`}
      lines={[
        repair.description,
        repair.locationType === 'offsite' ? `📍 นอกร้าน — ${repair.locationAddress || 'ไม่ระบุที่อยู่'}` : '🏠 อยู่ที่ร้าน',
      ]}
      pills={[{ label: repair.status === 'in_progress' ? 'กำลังซ่อม' : 'รอซ่อม', color: '#f59e0b' }]}
    />
  )
}
