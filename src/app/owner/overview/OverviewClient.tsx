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
          {groups.atShop.map(b => <AtShopRow key={b.id} bike={b} showBranchName={showBranchName} />)}
        </Section>
      )}
      {show('daily') && (
        <Section title="เช่ารายวัน/รายสัปดาห์" count={groups.dailyRentals.length} showHeader={filter === 'all'}>
          {groups.dailyRentals.map(r => <DailyRow key={r.id} rental={r} showBranchName={showBranchName} />)}
        </Section>
      )}
      {show('monthly') && (
        <Section title="เช่ารายเดือน" count={groups.monthlyRentals.length} showHeader={filter === 'all'}>
          {groups.monthlyRentals.map(r => <MonthlyRow key={r.id} rental={r} showBranchName={showBranchName} />)}
        </Section>
      )}
      {show('repair') && (
        <Section title="ซ่อม" count={groups.repairs.length} showHeader={filter === 'all'}>
          {groups.repairs.map(r => <RepairRow key={r.id} repair={r} showBranchName={showBranchName} />)}
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{children}</div>
    </div>
  )
}

function RowShell({ dotColor, title, badge, badgeColor, meta1, meta2, meta3 }: {
  dotColor: string; title: string; badge: string; badgeColor: string
  meta1: string; meta2?: string; meta3?: string
}) {
  return (
    <div style={{
      background: '#1e293b', borderRadius: '12px', padding: '12px 14px',
      border: '1px solid rgba(255,255,255,.06)', borderLeft: `3px solid ${dotColor}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0' }}>{title}</span>
        <span style={{ fontSize: '11px', fontWeight: 700, color: badgeColor, whiteSpace: 'nowrap' }}>{badge}</span>
      </div>
      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{meta1}</div>
      {meta2 && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{meta2}</div>}
      {meta3 && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{meta3}</div>}
    </div>
  )
}

function branchSuffix(name: string, show: boolean) {
  return show && name ? ` • ${name}` : ''
}

function AtShopRow({ bike, showBranchName }: { bike: AtShopBike; showBranchName: boolean }) {
  return (
    <RowShell
      dotColor="#22c55e"
      title={`${bike.brand} ${bike.model}`}
      badge="ว่าง" badgeColor="#22c55e"
      meta1={`ทะเบียน ${bike.licensePlate}${branchSuffix(bike.branchName, showBranchName)}`}
      meta2={`📍 ${bike.odometer.toLocaleString()} กม. • ฿${bike.dailyRate.toLocaleString()}/วัน`}
    />
  )
}

function DailyRow({ rental, showBranchName }: { rental: DailyRental; showBranchName: boolean }) {
  const hrs = hoursUntil(rental.expectedEndDatetime)
  let badge: string, badgeColor: string, dotColor: string
  if (hrs < 0) { badge = `เกินกำหนด ${Math.abs(hrs)} ชม.`; badgeColor = '#ef4444'; dotColor = '#ef4444' }
  else if (isTodayBkk(rental.expectedEndDatetime)) { badge = `คืนวันนี้ ${fmtTime(rental.expectedEndDatetime)}`; badgeColor = '#f59e0b'; dotColor = '#f59e0b' }
  else { badge = `คืน ${fmtDate(rental.expectedEndDatetime)}`; badgeColor = '#f87171'; dotColor = '#ef4444' }
  return (
    <RowShell
      dotColor={dotColor}
      title={`${rental.brand} ${rental.model}`}
      badge={badge} badgeColor={badgeColor}
      meta1={`ทะเบียน ${rental.licensePlate}${branchSuffix(rental.branchName, showBranchName)}`}
      meta2={`👤 ${rental.customerName}${rental.customerPhone ? ' • ' + rental.customerPhone : ''}`}
      meta3={rental.returnType === 'offsite' ? `🛵 คืนที่: ${rental.returnAddress || 'นอกสถานที่'}` : undefined}
    />
  )
}

function MonthlyRow({ rental, showBranchName }: { rental: MonthlyRental; showBranchName: boolean }) {
  return (
    <RowShell
      dotColor="#a78bfa"
      title={`${rental.brand} ${rental.model}`}
      badge="รายเดือน" badgeColor="#a78bfa"
      meta1={`ทะเบียน ${rental.licensePlate}${branchSuffix(rental.branchName, showBranchName)}`}
      meta2={`👤 ${rental.customerName}${rental.customerPhone ? ' • ' + rental.customerPhone : ''}`}
      meta3={`฿${rental.monthlyRate.toLocaleString()}/เดือน • ครบวันที่ ${rental.paymentDay} ทุกเดือน`}
    />
  )
}

function RepairRow({ repair, showBranchName }: { repair: RepairJob; showBranchName: boolean }) {
  return (
    <RowShell
      dotColor="#f59e0b"
      title={`${repair.brand} ${repair.model}`}
      badge={repair.status === 'in_progress' ? 'กำลังซ่อม' : 'รอซ่อม'} badgeColor="#f59e0b"
      meta1={`ทะเบียน ${repair.licensePlate}${branchSuffix(repair.branchName, showBranchName)}`}
      meta2={repair.description}
      meta3={repair.locationType === 'offsite' ? `📍 นอกร้าน — ${repair.locationAddress || 'ไม่ระบุที่อยู่'}` : '🏠 อยู่ที่ร้าน'}
    />
  )
}
