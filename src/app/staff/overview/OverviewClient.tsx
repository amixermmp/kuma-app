'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Store } from 'lucide-react'
import TabBar from '@/components/staff/TabBar'
import { JobCard, fmtDate, fmtTime, hoursUntil, isTodayBkk } from '@/components/staff/JobCard'
import type { AtShopBike, DailyRental, MonthlyRental, RepairJob, ShopOverviewGroups } from '@/lib/shopOverview'

type FilterKey = 'all' | 'atshop' | 'daily' | 'monthly' | 'repair'

type Props = { groups: ShopOverviewGroups; branchName: string }

export default function OverviewClient({ groups, branchName }: Props) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')

  const norm = (s: string) => s.toLowerCase().replace(/\s/g, '')
  const term = norm(search)
  const matches = (plate: string, name?: string) =>
    !term || norm(plate).includes(term) || (name ? norm(name).includes(term) : false)

  const atShop = groups.atShop.filter(b => matches(b.licensePlate))
  const dailyRentals = groups.dailyRentals.filter(r => matches(r.licensePlate, r.customerName))
  const monthlyRentals = groups.monthlyRentals.filter(r => matches(r.licensePlate, r.customerName))
  const repairs = groups.repairs.filter(r => matches(r.licensePlate))

  const chips: { key: FilterKey; label: string; count: number; bg: string; color: string }[] = [
    { key: 'all',     label: 'ทั้งหมด',      count: atShop.length + dailyRentals.length + monthlyRentals.length + repairs.length, bg: '#f1f5f9', color: '#111827' },
    { key: 'atshop',  label: 'อยู่ที่ร้าน',   count: atShop.length,        bg: '#f0fdf4', color: '#16a34a' },
    { key: 'daily',   label: 'รายวัน/สัปดาห์', count: dailyRentals.length, bg: '#fef2f2', color: '#dc2626' },
    { key: 'monthly', label: 'รายเดือน',      count: monthlyRentals.length, bg: '#faf5ff', color: '#7c3aed' },
    { key: 'repair',  label: 'ซ่อม',          count: repairs.length,       bg: '#fffbeb', color: '#d97706' },
  ]

  const show = (key: FilterKey) => filter === 'all' || filter === key

  return (
    <div className="app-wrap">
      <div style={{ background: '#111', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Link href="/staff/home" style={{ display: 'flex', color: '#fff' }}>
          <ArrowLeft size={20} strokeWidth={1.75} />
        </Link>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Store size={16} color="#e5231b" strokeWidth={2} />
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>ภาพรวมร้าน</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.55)' }}>{branchName}</div>
          </div>
        </div>
      </div>
      <TabBar />

      {/* Filter chips */}
      <div style={{
        background: '#fff', padding: '10px 12px',
        display: 'flex', gap: '8px', overflowX: 'auto',
        borderBottom: '1px solid #e5e7eb',
      }}>
        {chips.map(({ key, label, count, bg, color }) => {
          const active = filter === key
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                background: active ? color : bg,
                color: active ? '#fff' : color,
                border: `1.5px solid ${active ? color : color + '44'}`,
                borderRadius: '10px', padding: '6px 12px', minWidth: '68px',
                cursor: 'pointer', transition: 'all .15s', fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: '16px', fontWeight: 800 }}>{count}</span>
              <span style={{ fontSize: '10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div style={{ background: '#fff', padding: '10px 12px', borderBottom: '1px solid #e5e7eb' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 ค้นหาทะเบียน / ชื่อลูกค้า"
          style={{
            width: '100%', padding: '9px 12px', borderRadius: '10px',
            border: '1.5px solid #e5e7eb', fontSize: '13px', fontFamily: 'inherit',
            boxSizing: 'border-box', outline: 'none',
          }}
        />
      </div>

      <div style={{ padding: '4px 12px 80px' }}>
        {show('atshop') && (
          <Section title="รถอยู่ที่ร้านตอนนี้" count={atShop.length} showHeader={filter === 'all'}>
            {atShop.map(b => <AtShopCard key={b.id} bike={b} />)}
          </Section>
        )}
        {show('daily') && (
          <Section title="เช่ารายวัน/รายสัปดาห์" count={dailyRentals.length} showHeader={filter === 'all'}>
            {dailyRentals.map(r => <DailyCard key={r.id} rental={r} />)}
          </Section>
        )}
        {show('monthly') && (
          <Section title="เช่ารายเดือน" count={monthlyRentals.length} showHeader={filter === 'all'}>
            {monthlyRentals.map(r => <MonthlyCard key={r.id} rental={r} />)}
          </Section>
        )}
        {show('repair') && (
          <Section title="ซ่อม" count={repairs.length} showHeader={filter === 'all'}>
            {repairs.map(r => <RepairCard key={r.id} repair={r} />)}
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ title, count, showHeader, children }: { title: string; count: number; showHeader: boolean; children: React.ReactNode }) {
  if (count === 0) {
    if (!showHeader) return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af', fontSize: '14px' }}>ไม่มีรายการ</div>
    )
    return null
  }
  return (
    <div>
      {showHeader && (
        <div style={{
          fontSize: '12px', fontWeight: 700, color: '#6b7280',
          padding: '16px 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          {title} ({count})
        </div>
      )}
      {children}
    </div>
  )
}

function AtShopCard({ bike }: { bike: AtShopBike }) {
  return (
    <JobCard
      dotColor="#16a34a"
      title={`${bike.brand} ${bike.model}`}
      badge="ว่าง" badgeBg="#f0fdf4" badgeColor="#16a34a"
      meta1={`ทะเบียน ${bike.licensePlate}`}
      meta2={`📍 ${bike.odometer.toLocaleString()} กม. • ฿${bike.dailyRate.toLocaleString()}/วัน`}
      photoUrl={bike.photoUrl}
      bikeColor={bike.color}
      href={`/staff/bikes/${bike.id}/menu`}
      btnLabel="ดู →"
    />
  )
}

function DailyCard({ rental }: { rental: DailyRental }) {
  const hrs = hoursUntil(rental.expectedEndDatetime)
  let badge: string, badgeBg: string, badgeColor: string, dotColor: string
  if (hrs < 0) {
    badge = `⏱ เกินกำหนด ${Math.abs(hrs)} ชม.`; badgeBg = '#fee2e2'; badgeColor = '#b91c1c'; dotColor = '#b91c1c'
  } else if (isTodayBkk(rental.expectedEndDatetime)) {
    badge = `⚠️ คืนวันนี้ ${fmtTime(rental.expectedEndDatetime)}`; badgeBg = '#fffbeb'; badgeColor = '#d97706'; dotColor = '#d97706'
  } else {
    badge = `📅 คืน ${fmtDate(rental.expectedEndDatetime)}`; badgeBg = '#fef2f2'; badgeColor = '#dc2626'; dotColor = '#dc2626'
  }
  return (
    <JobCard
      dotColor={dotColor}
      title={`${rental.brand} ${rental.model}`}
      badge={badge} badgeBg={badgeBg} badgeColor={badgeColor}
      meta1={`ทะเบียน ${rental.licensePlate}`}
      meta2={`👤 ${rental.customerName}${rental.customerPhone ? ' • ' + rental.customerPhone : ''}`}
      meta3={rental.returnType === 'offsite' ? `🛵 คืนที่: ${rental.returnAddress || 'นอกสถานที่'}` : undefined}
      photoUrl={rental.photoUrl}
      bikeColor={rental.color}
      href={`/staff/bikes/${rental.bikeId}/menu`}
      btnLabel="ดู →"
    />
  )
}

function MonthlyCard({ rental }: { rental: MonthlyRental }) {
  return (
    <JobCard
      dotColor="#7c3aed"
      title={`${rental.brand} ${rental.model}`}
      badge="รายเดือน" badgeBg="#faf5ff" badgeColor="#7c3aed"
      meta1={`ทะเบียน ${rental.licensePlate}`}
      meta2={`👤 ${rental.customerName}${rental.customerPhone ? ' • ' + rental.customerPhone : ''}`}
      meta3={`฿${rental.monthlyRate.toLocaleString()}/เดือน • ครบวันที่ ${rental.paymentDay} ทุกเดือน`}
      photoUrl={rental.photoUrl}
      bikeColor={rental.color}
      href={`/staff/bikes/${rental.bikeId}/menu`}
      btnLabel="ดู →"
    />
  )
}

function RepairCard({ repair }: { repair: RepairJob }) {
  return (
    <JobCard
      dotColor="#d97706"
      title={`${repair.brand} ${repair.model}`}
      badge={repair.status === 'in_progress' ? 'กำลังซ่อม' : 'รอซ่อม'} badgeBg="#fffbeb" badgeColor="#d97706"
      meta1={`ทะเบียน ${repair.licensePlate}`}
      meta2={repair.description}
      meta3={repair.locationType === 'offsite' ? `📍 นอกร้าน — ${repair.locationAddress || 'ไม่ระบุที่อยู่'}` : '🏠 อยู่ที่ร้าน'}
      photoUrl={repair.photoUrl}
      bikeColor={repair.color}
      href={`/staff/repair/${repair.id}`}
      btnLabel="ดู →"
    />
  )
}
