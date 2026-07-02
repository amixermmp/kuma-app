'use client'

import { useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/staff/TabBar'

// ── helpers ──────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric',
  })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}
function overdueHours(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
}
function hoursUntil(iso: string) {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 3_600_000)
}
function daysUntil(dateStr: string) {
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}
function urgencyPalette(days: number) {
  if (days < 0)   return { dot: '#b91c1c', bg: '#fee2e2', color: '#b91c1c' }
  if (days <= 3)  return { dot: '#dc2626', bg: '#fef2f2', color: '#dc2626' }
  if (days <= 7)  return { dot: '#ea580c', bg: '#fff7ed', color: '#ea580c' }
  if (days <= 14) return { dot: '#d97706', bg: '#fffbeb', color: '#d97706' }
  return           { dot: '#374151', bg: '#f1f5f9', color: '#374151' }
}

const DOC_LABEL: Record<string, string> = { tax: 'ภาษีรถ', pob: 'พ.ร.บ.', insurance: 'ประกันภัย' }

// ── sub-components ───────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '12px', fontWeight: 700, color: '#6b7280',
      padding: '16px 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px',
    }}>
      {children}
    </div>
  )
}

function JobCard({
  dotColor, title, badge, badgeBg, badgeColor,
  meta1, meta2, statusLabel, statusBg, statusColor,
  href, btnColor, btnLabel, contractHref, extendHref, onCancel, cancelDisabled,
}: {
  dotColor: string; title: string
  badge: string; badgeBg: string; badgeColor: string
  meta1: string; meta2?: string
  statusLabel: string; statusBg: string; statusColor: string
  href: string; btnColor?: string; btnLabel?: string
  contractHref?: string
  extendHref?: string
  onCancel?: () => void
  cancelDisabled?: boolean
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: '12px', marginBottom: '10px',
      boxShadow: '0 1px 3px rgba(0,0,0,.07)', overflow: 'hidden', display: 'flex',
    }}>
      <div style={{ width: '5px', background: dotColor, flexShrink: 0 }} />
      <div style={{ flex: 1, padding: '12px 12px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
          <span style={{ fontWeight: 700, fontSize: '14px', color: '#111827', flex: 1 }}>{title}</span>
          <span style={{
            fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px',
            background: badgeBg, color: badgeColor, whiteSpace: 'nowrap', flexShrink: 0,
          }}>{badge}</span>
        </div>
        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '3px' }}>{meta1}</div>
        {meta2 && <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>{meta2}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
          <span style={{
            fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
            background: statusBg, color: statusColor,
          }}>{statusLabel}</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {onCancel && (
              <button onClick={onCancel} disabled={cancelDisabled} style={{
                fontSize: '12px', fontWeight: 700, padding: '6px 10px', borderRadius: '8px',
                background: cancelDisabled ? '#f9fafb' : '#fef2f2',
                color: cancelDisabled ? '#9ca3af' : '#dc2626',
                border: `1px solid ${cancelDisabled ? '#e5e7eb' : '#fecaca'}`,
                cursor: cancelDisabled ? 'not-allowed' : 'pointer',
              }}>
                {cancelDisabled ? '⏳' : '🚫 ยกเลิก'}
              </button>
            )}
            {contractHref && (
              <Link href={contractHref} style={{
                fontSize: '12px', fontWeight: 700, padding: '6px 10px', borderRadius: '8px',
                background: '#f3f4f6', color: '#374151', textDecoration: 'none',
              }}>
                📄 สัญญา
              </Link>
            )}
            {extendHref && (
              <Link href={extendHref} style={{
                fontSize: '12px', fontWeight: 700, padding: '6px 10px', borderRadius: '8px',
                background: '#fffbeb', color: '#d97706', textDecoration: 'none',
                border: '1px solid #fde68a',
              }}>
                ⏱ ต่อเวลา
              </Link>
            )}
            <Link href={href} style={{
              fontSize: '12px', fontWeight: 700, padding: '6px 14px', borderRadius: '8px',
              background: btnColor ?? '#111827', color: '#fff', textDecoration: 'none',
            }}>
              {btnLabel ?? 'เปิด →'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── types ────────────────────────────────────────────────────
type Tab = 'all' | 'sendcar' | 'returncar' | 'active' | 'broken' | 'routine' | 'docs' | 'monthly' | 'contact'

// ── main component ───────────────────────────────────────────
export default function JobsClient({
  sendJobs, overdueRentals, dueSoonRentals, activeRentals, repairs,
  overdueRoutines, docsDue, monthlyContactAlerts, allMonthlyRentals,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendJobs: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  overdueRentals: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dueSoonRentals: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeRentals: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  repairs: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  overdueRoutines: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  docsDue: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  monthlyContactAlerts: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allMonthlyRentals: any[]
}) {
  const [tab, setTab] = useState<Tab>('all')
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set())
  const [cancelling, setCancelling] = useState<string | null>(null)

  const handleCancel = async (bookingId: string) => {
    if (!window.confirm('ยืนยันยกเลิกการจองนี้?')) return
    setCancelling(bookingId)
    try {
      await fetch('/api/staff/booking/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      })
      setCancelledIds(prev => { const s = new Set(prev); s.add(bookingId); return s })
    } finally {
      setCancelling(null)
    }
  }

  const visibleSendJobs = sendJobs.filter((b: any) => !cancelledIds.has(b.id)) // eslint-disable-line @typescript-eslint/no-explicit-any

  const returnJobs = [...overdueRentals, ...dueSoonRentals]
  const nowMs = Date.now()
  const counts = {
    sendcar:  visibleSendJobs.length,
    returncar: returnJobs.length,
    active:   activeRentals.length,
    broken:   repairs.length,
    routine:  overdueRoutines.length,
    docs:     docsDue.length,
    monthly:  allMonthlyRentals.length,
    contact:  monthlyContactAlerts.length,
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  const tabs: { key: Tab; label: string; count: number; bg: string; color: string }[] = [
    { key: 'all',      label: 'ทั้งหมด',       count: total,              bg: '#f1f5f9', color: '#111827' },
    { key: 'contact',  label: 'ติดต่อลูกค้า',  count: counts.contact,     bg: '#fff7ed', color: '#ea580c' },
    { key: 'sendcar',  label: 'ส่งรถ',          count: counts.sendcar,     bg: '#f1f5f9', color: '#111827' },
    { key: 'returncar',label: 'รับคืน',         count: counts.returncar,   bg: '#fef2f2', color: '#dc2626' },
    { key: 'active',   label: 'เช่าอยู่',       count: counts.active,      bg: '#f0fdf4', color: '#16a34a' },
    { key: 'broken',   label: 'รถเสีย',         count: counts.broken,      bg: '#fef2f2', color: '#dc2626' },
    { key: 'routine',  label: 'รูทีน',          count: counts.routine,     bg: '#fffbeb', color: '#d97706' },
    { key: 'docs',     label: 'เอกสาร',         count: counts.docs,        bg: '#f1f5f9', color: '#374151' },
    { key: 'monthly',  label: 'รายเดือน',       count: counts.monthly,     bg: '#faf5ff', color: '#7c3aed' },
  ]

  const show = (key: Tab) => tab === 'all' || tab === key

  return (
    <div className="app-wrap">

      {/* Header */}
      <div style={{ background: '#111827', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '17px', fontWeight: 700, color: '#fff' }}>📌 Job Tasks</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,.7)' }}>งานทั้งหมดที่ต้องดำเนินการ</div>
        </div>
        {total > 0 && (
          <div style={{
            background: '#dc2626', color: '#fff', borderRadius: '999px',
            minWidth: '26px', height: '26px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '13px', fontWeight: 700, padding: '0 8px',
          }}>
            {total}
          </div>
        )}
      </div>
      <TabBar />

      {/* Tab chips */}
      <div style={{
        background: '#fff', padding: '10px 12px',
        display: 'flex', gap: '8px', overflowX: 'auto',
        borderBottom: '1px solid #e5e7eb',
      }}>
        {tabs.map(({ key, label, count, bg, color }) => {
          const active = tab === key
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                background: active ? color : bg,
                color: active ? '#fff' : color,
                border: `1.5px solid ${active ? color : color + '44'}`,
                borderRadius: '10px', padding: '6px 12px', minWidth: '56px',
                cursor: 'pointer', transition: 'all .15s',
              }}
            >
              <span style={{ fontSize: '16px', fontWeight: 800 }}>{count}</span>
              <span style={{ fontSize: '10px', fontWeight: 600 }}>{label}</span>
            </button>
          )
        })}
      </div>

      <div style={{ padding: '0 12px 80px' }}>

        {total === 0 && (
          <div style={{
            textAlign: 'center', padding: '48px 16px',
            background: '#f9fafb', borderRadius: '12px',
            color: '#9ca3af', fontSize: '14px', marginTop: '16px',
          }}>
            ✅ ไม่มีงานค้างอยู่
          </div>
        )}

        {/* ติดต่อลูกค้า — ครบกำหนดรายเดือน */}
        {show('contact') && monthlyContactAlerts.length > 0 && (
          <>
            <SectionTitle>📞 ติดต่อลูกค้า — ครบกำหนดรายเดือน</SectionTitle>
            {monthlyContactAlerts.map((mr: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
              const bike = mr.bikes
              const customer = mr.customers
              const isOverdue = mr.daysUntil < 0
              const isToday = mr.daysUntil === 0
              const isTomorrow = mr.daysUntil === 1
              const badgeText = isOverdue ? '🔴 เกินกำหนดแล้ว!' : isToday ? '🔴 ครบกำหนดวันนี้!' : isTomorrow ? '🟠 ครบกำหนดพรุ่งนี้' : `⚠️ อีก ${mr.daysUntil} วัน`
              const badgeBg = (isOverdue || isToday) ? '#fef2f2' : '#fff7ed'
              const badgeColor = (isOverdue || isToday) ? '#dc2626' : '#ea580c'
              const dotColor = (isOverdue || isToday) ? '#dc2626' : '#ea580c'
              return (
                <div key={mr.id} style={{
                  background: '#fff', borderRadius: '12px', marginBottom: '10px',
                  boxShadow: '0 1px 3px rgba(0,0,0,.07)', overflow: 'hidden', display: 'flex',
                }}>
                  <div style={{ width: '5px', background: dotColor, flexShrink: 0 }} />
                  <div style={{ flex: 1, padding: '12px 12px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#111827', flex: 1 }}>
                        📞 ติดต่อ — {bike?.license_plate ?? ''} {bike?.brand ?? ''} {bike?.model ?? ''}
                      </span>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px',
                        background: badgeBg, color: badgeColor, whiteSpace: 'nowrap', flexShrink: 0,
                      }}>{badgeText}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '3px' }}>
                      👤 {customer?.name ?? '—'}{customer?.phone ? ` • ${customer.phone}` : ''}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                      💰 ฿{Number(mr.monthly_rate).toLocaleString()}/เดือน • ครบวันที่ {mr.payment_day} ทุกเดือน
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                      <a href={`tel:${customer?.phone ?? ''}`} style={{
                        fontSize: '12px', fontWeight: 700, padding: '6px 12px', borderRadius: '8px',
                        background: '#f0fdf4', color: '#16a34a', textDecoration: 'none', border: '1px solid #bbf7d0',
                      }}>
                        📱 โทร
                      </a>
                      <Link href={`/staff/collect/${mr.id}`} style={{
                        fontSize: '12px', fontWeight: 700, padding: '6px 12px', borderRadius: '8px',
                        background: '#7c3aed', color: '#fff', textDecoration: 'none',
                      }}>
                        💰 ต่อสัญญา
                      </Link>
                      <Link href={`/staff/monthly/end/${mr.id}`} style={{
                        fontSize: '12px', fontWeight: 700, padding: '6px 12px', borderRadius: '8px',
                        background: '#fef2f2', color: '#dc2626', textDecoration: 'none', border: '1px solid #fecaca',
                      }}>
                        🚫 คืนรถ
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* ส่งรถ */}
        {show('sendcar') && visibleSendJobs.length > 0 && (
          <>
            <SectionTitle>งานส่งรถ 🛵➡️</SectionTitle>
            {visibleSendJobs.map((b: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
              const bike = b.bikes
              const hrs = hoursUntil(b.start_datetime)
              const isLate = hrs < 0
              const absHrs = Math.abs(hrs)
              const bikeLabel = bike
                ? `${bike.license_plate} ${bike.brand} ${bike.model}`
                : `${b.requested_brand ?? ''} ${b.requested_model ?? ''} (ยังไม่ได้กำหนดรถ)`
              const badge = isLate
                ? (absHrs >= 24 ? `⚠️ ลูกค้าไม่มา ${Math.floor(absHrs / 24)} วัน` : `⚠️ เลยเวลา ${absHrs} ชม.`)
                : hrs === 0 ? '🔔 ถึงเวลาแล้ว!' : `⏰ อีก ${hrs} ชม.`
              const dotColor = isLate ? (absHrs >= 3 ? '#dc2626' : '#d97706') : '#111827'
              const badgeBg = isLate ? '#fef2f2' : '#f1f5f9'
              const badgeColor = isLate ? '#dc2626' : '#111827'
              return (
                <JobCard
                  key={b.id}
                  dotColor={dotColor}
                  title={`ส่งรถ — ${bikeLabel}`}
                  badge={badge}
                  badgeBg={badgeBg} badgeColor={badgeColor}
                  meta1={`👤 ${b.customer_name}${b.customer_phone ? ` • ${b.customer_phone}` : ''}`}
                  meta2={`📅 รับรถ ${fmtDate(b.start_datetime)} ${fmtTime(b.start_datetime)} น. • ${b.total_days} วัน`}
                  statusLabel={isLate ? '⚠️ ลูกค้าไม่มา' : bike ? '⬛ รอส่งรถ' : '🟡 ยังไม่ได้เลือกรถ'}
                  statusBg={isLate ? '#fef2f2' : bike ? '#f1f5f9' : '#fffbeb'}
                  statusColor={isLate ? '#dc2626' : bike ? '#111827' : '#d97706'}
                  href={`/staff/assign/${b.id}`} btnColor="#111827"
                  onCancel={() => handleCancel(b.id)}
                  cancelDisabled={cancelling === b.id}
                />
              )
            })}
          </>
        )}

        {/* รับคืน */}
        {show('returncar') && returnJobs.length > 0 && (
          <>
            <SectionTitle>งานรับรถคืน ⬅️🛵 — ถึงกำหนดวันนี้</SectionTitle>
            {overdueRentals.map((job: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
              const hrs = overdueHours(job.expected_end_datetime)
              const bike = job.bikes
              return (
                <JobCard
                  key={job.id} dotColor="#dc2626"
                  title={`รับคืน — ${bike.license_plate} ${bike.brand} ${bike.model}`}
                  badge="🔴 เกินกำหนด!" badgeBg="#fef2f2" badgeColor="#dc2626"
                  meta1={`👤 ${job.customers.name}${job.customers.phone ? ` • ${job.customers.phone}` : ''}`}
                  meta2={`⏱ เกินมา ${hrs} ชม. • กำหนด ${fmtDate(job.expected_end_datetime)} ${fmtTime(job.expected_end_datetime)}`}
                  statusLabel="🔴 เกินกำหนด" statusBg="#fef2f2" statusColor="#dc2626"
                  href={`/staff/return/${job.id}`} btnColor="#dc2626"
                  contractHref={`/staff/contract/${job.id}`}
                  extendHref={`/staff/extend/${job.id}`}
                />
              )
            })}
            {dueSoonRentals.map((job: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
              const hrs = hoursUntil(job.expected_end_datetime)
              const bike = job.bikes
              const urgent = hrs <= 2
              return (
                <JobCard
                  key={job.id} dotColor={urgent ? '#d97706' : '#6b7280'}
                  title={`รับคืน — ${bike.license_plate} ${bike.brand} ${bike.model}`}
                  badge={`⚠️ ${fmtTime(job.expected_end_datetime)} น.`} badgeBg="#fffbeb" badgeColor="#d97706"
                  meta1={`👤 ${job.customers.name}${job.customers.phone ? ` • ${job.customers.phone}` : ''}`}
                  meta2={`⏱ อีก ${hrs} ชม. • กำหนด ${fmtDate(job.expected_end_datetime)}`}
                  statusLabel={urgent ? '⚠️ ใกล้ถึงกำหนด' : '📅 วันนี้'}
                  statusBg={urgent ? '#fffbeb' : '#f9fafb'} statusColor={urgent ? '#d97706' : '#6b7280'}
                  href={`/staff/return/${job.id}`} btnColor={urgent ? '#d97706' : '#4b5563'}
                  contractHref={`/staff/contract/${job.id}`}
                />
              )
            })}
          </>
        )}

        {/* เช่าอยู่ */}
        {show('active') && activeRentals.length > 0 && (
          <>
            <SectionTitle>รถที่เช่าอยู่ทั้งหมด 🛵✅</SectionTitle>
            {activeRentals.map((job: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
              const bike = job.bikes
              const endMs = new Date(job.expected_end_datetime).getTime()
              const diffMs = endMs - nowMs
              const isOverdue = diffMs < 0
              const hrs = Math.abs(Math.floor(diffMs / 3_600_000))
              const days = Math.floor(Math.abs(diffMs) / 86_400_000)

              let badge = ''
              let badgeBg = '#f0fdf4'
              let badgeColor = '#16a34a'
              let dotColor = '#16a34a'
              let statusLabel = '🟢 เช่าอยู่'
              let statusBg = '#f0fdf4'
              let statusColor = '#16a34a'

              if (isOverdue) {
                badge = '🔴 เกิน ' + (hrs < 24 ? hrs + ' ชม.' : days + ' วัน')
                badgeBg = '#fef2f2'; badgeColor = '#dc2626'; dotColor = '#dc2626'
                statusLabel = '🔴 เกินกำหนด'; statusBg = '#fef2f2'; statusColor = '#dc2626'
              } else if (diffMs < 24 * 3_600_000) {
                badge = `⚠️ คืนวันนี้ ${fmtTime(job.expected_end_datetime)}`
                badgeBg = '#fffbeb'; badgeColor = '#d97706'; dotColor = '#d97706'
                statusLabel = '⚠️ ใกล้ครบกำหนด'; statusBg = '#fffbeb'; statusColor = '#d97706'
              } else {
                badge = `📅 คืน ${fmtDate(job.expected_end_datetime)}`
              }

              return (
                <JobCard
                  key={job.id} dotColor={dotColor}
                  title={`${bike?.license_plate ?? ''} ${bike?.brand ?? ''} ${bike?.model ?? ''}`}
                  badge={badge} badgeBg={badgeBg} badgeColor={badgeColor}
                  meta1={`👤 ${job.customers?.name ?? '—'}${job.customers?.phone ? ` • ${job.customers.phone}` : ''}`}
                  meta2={`📅 เช่า ${fmtDate(job.start_datetime)} · ${job.total_days} วัน · ฿${Number(job.total_amount).toLocaleString()}`}
                  statusLabel={statusLabel} statusBg={statusBg} statusColor={statusColor}
                  href={`/staff/return/${job.id}`} btnColor={isOverdue ? '#dc2626' : '#16a34a'}
                  contractHref={`/staff/contract/${job.id}`}
                />
              )
            })}
          </>
        )}

        {/* รถเสีย */}
        {show('broken') && repairs.length > 0 && (
          <>
            <SectionTitle>งานแจ้งรถเสีย 🛵💥</SectionTitle>
            {repairs.map((r: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
              const bike = r.bikes
              const isPending = r.status === 'pending'
              return (
                <JobCard
                  key={r.id} dotColor={isPending ? '#dc2626' : '#d97706'}
                  title={`รถเสีย — ${bike.license_plate} ${bike.brand} ${bike.model}`}
                  badge={isPending ? '🔴 รอส่งซ่อม' : '🔧 กำลังซ่อม'}
                  badgeBg={isPending ? '#fef2f2' : '#fffbeb'} badgeColor={isPending ? '#dc2626' : '#d97706'}
                  meta1={`⚠️ ${r.title ?? r.description ?? 'ไม่ระบุอาการ'}`}
                  meta2={`📅 แจ้งเมื่อ ${fmtDate(r.created_at)}`}
                  statusLabel={isPending ? '🔴 รอดำเนินการ' : '🔧 กำลังซ่อม'}
                  statusBg={isPending ? '#fef2f2' : '#fffbeb'} statusColor={isPending ? '#dc2626' : '#d97706'}
                  href={`/staff/repair/${r.id}`} btnColor={isPending ? '#dc2626' : '#d97706'}
                />
              )
            })}
          </>
        )}

        {/* รูทีน */}
        {show('routine') && overdueRoutines.length > 0 && (
          <>
            <SectionTitle>งานซ่อมบำรุงรูทีน 🔧🛢️</SectionTitle>
            {overdueRoutines.map((r: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
              const bike = r.bikes
              const kmOver = r.next_due_km != null && bike?.odometer != null && bike.odometer >= r.next_due_km
                ? bike.odometer - r.next_due_km
                : null
              const days = kmOver != null ? -1 : (r.next_due_date ? daysUntil(r.next_due_date) : 0)
              const p = urgencyPalette(days)
              const badgeText = kmOver != null
                ? (kmOver === 0 ? '🔴 ถึงกำหนดแล้ว!' : `🔴 เกิน ${kmOver.toLocaleString()} กม.`)
                : days < 0 ? '🚨 เกินกำหนด' : `📅 อีก ${days} วัน`
              const statusText = days < 0 || kmOver != null ? '🔴 เกินกำหนด' : days <= 3 ? '🔴 เร่งด่วน' : '⚠️ ถึงกำหนด'
              return (
                <JobCard
                  key={r.id} dotColor={p.dot}
                  title={`${r.task_name ?? 'บำรุงรักษา'} — ${bike?.license_plate ?? ''} ${bike?.brand ?? ''} ${bike?.model ?? ''}`}
                  badge={badgeText} badgeBg={p.bg} badgeColor={p.color}
                  meta1={kmOver != null ? (kmOver === 0 ? '📍 ถึงกำหนดพอดี!' : `📍 เกินกำหนด ${kmOver.toLocaleString()} กม.`) : `📅 กำหนด ${fmtDate(r.next_due_date)}`}
                  statusLabel={statusText} statusBg={p.bg} statusColor={p.color}
                  href={`/staff/routine?id=${r.id}`} btnColor={p.dot}
                />
              )
            })}
          </>
        )}

        {/* เอกสาร */}
        {show('docs') && docsDue.length > 0 && (
          <>
            <SectionTitle>งานเอกสาร 📋✅</SectionTitle>
            {docsDue.map((d: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
              const bike = d.bikes
              const days = daysUntil(d.expiry_date)
              const p = urgencyPalette(days)
              const statusText = days < 0 ? '🔴 เกินกำหนด' : days <= 3 ? '🔴 เร่งด่วนมาก' : days <= 7 ? '🟠 เร่งด่วน' : days <= 14 ? '⚠️ ใกล้หมด' : '📋 แจ้งเตือน'
              return (
                <JobCard
                  key={d.id} dotColor={p.dot}
                  title={`ต่อ${DOC_LABEL[d.doc_type] ?? d.doc_type} — ${bike?.license_plate ?? ''}`}
                  badge={days < 0 ? `🚨 เกินมา ${Math.abs(days)} วัน` : `📅 อีก ${days} วัน`}
                  badgeBg={p.bg} badgeColor={p.color}
                  meta1={`${bike?.brand ?? ''} ${bike?.model ?? ''}`}
                  meta2={`หมดอายุ: ${fmtDate(d.expiry_date)}`}
                  statusLabel={statusText} statusBg={p.bg} statusColor={p.color}
                  href={`/staff/docs?bikeId=${d.bike_id}`} btnColor={p.dot}
                />
              )
            })}
          </>
        )}

        {/* รายเดือน — overview ทุกคัน */}
        {show('monthly') && allMonthlyRentals.length > 0 && (
          <>
            <SectionTitle>รถรายเดือนทั้งหมด 🟣🗓️</SectionTitle>
            {allMonthlyRentals.map((mr: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
              const bike = mr.bikes
              const customer = mr.customers
              return (
                <JobCard
                  key={mr.id} dotColor="#7c3aed"
                  title={`${bike?.license_plate ?? ''} ${bike?.brand ?? ''} ${bike?.model ?? ''}`}
                  badge={`📅 ครบวันที่ ${mr.payment_day} ทุกเดือน`}
                  badgeBg="#faf5ff" badgeColor="#7c3aed"
                  meta1={`👤 ${customer?.name ?? '—'}${customer?.phone ? ` • ${customer.phone}` : ''}`}
                  meta2={`💰 ฿${Number(mr.monthly_rate).toLocaleString()}/เดือน`}
                  statusLabel="🟣 รายเดือน"
                  statusBg="#faf5ff" statusColor="#7c3aed"
                  href={`/staff/collect/${mr.id}`} btnColor="#7c3aed" btnLabel="📄 สัญญา"
                />
              )
            })}
          </>
        )}

        {/* ถ้ากด tab แต่ไม่มีงานในหมวดนั้น */}
        {tab !== 'all' && counts[tab as keyof typeof counts] === 0 && (
          <div style={{
            textAlign: 'center', padding: '48px 16px',
            background: '#f9fafb', borderRadius: '12px',
            color: '#9ca3af', fontSize: '14px', marginTop: '16px',
          }}>
            ✅ ไม่มีงานในหมวดนี้
          </div>
        )}

      </div>
    </div>
  )
}
