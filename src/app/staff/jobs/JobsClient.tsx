'use client'

import { useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/staff/TabBar'
import { JobCard, fmtDate, fmtTime, hoursUntil, isTodayBkk, bikeColorHex } from '@/components/staff/JobCard'

// ── helpers ──────────────────────────────────────────────────
function overdueHours(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
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

// กลุ่มที่พับ/กางได้ — ใช้แยก เกินกำหนด / วันนี้ / ยังไม่ถึง ให้ไม่ต้องเลื่อนผ่านของที่ยังไม่เร่งด่วน
function CollapsibleGroup({
  title, count, dotColor, defaultOpen = true, children,
}: {
  title: string; count: number; dotColor: string; defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (count === 0) return null
  return (
    <div style={{ marginBottom: '4px' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
          padding: '10px 2px 8px', userSelect: 'none',
        }}
      >
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827', flex: 1 }}>{title}</span>
        <span style={{
          fontSize: '11px', fontWeight: 700, color: '#6b7280',
          background: '#f1f5f9', borderRadius: '999px', padding: '2px 8px',
        }}>{count}</span>
        <span style={{ fontSize: '11px', color: '#9ca3af', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▼</span>
      </div>
      {open && children}
    </div>
  )
}

// ── types ────────────────────────────────────────────────────
type Tab = 'all' | 'sendcar' | 'returncar' | 'active' | 'broken' | 'routine' | 'docs' | 'monthly' | 'contact' | 'conflict'

// ── main component ───────────────────────────────────────────
export default function JobsClient({
  sendJobs, overdueRentals, dueSoonRentals, activeRentals, repairs,
  overdueRoutines, upcomingRoutines, docsDue, monthlyContactAlerts, allMonthlyRentals, brokenBookings,
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
  upcomingRoutines: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  docsDue: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  monthlyContactAlerts: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allMonthlyRentals: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  brokenBookings: any[]
}) {
  const [tab, setTab] = useState<Tab>('all')
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set())
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [lockOverrides, setLockOverrides] = useState<Record<string, boolean>>({}) // bikeId -> isLocked
  const [lockLoadingId, setLockLoadingId] = useState<string | null>(null)

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

  const handleToggleLock = async (bikeId: string, currentlyLocked: boolean) => {
    setLockLoadingId(bikeId)
    try {
      const res = await fetch('/api/staff/bikes/toggle-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bikeId }),
      })
      if (res.ok) setLockOverrides(prev => ({ ...prev, [bikeId]: !currentlyLocked }))
    } finally {
      setLockLoadingId(null)
    }
  }

  const visibleSendJobs = sendJobs.filter((b: any) => !cancelledIds.has(b.id)) // eslint-disable-line @typescript-eslint/no-explicit-any

  // แยกงานส่งรถ: เลยเวลานัด / ส่งวันนี้ / ยังไม่ถึงวันนัด
  const sendOverdue = visibleSendJobs.filter((b: any) => hoursUntil(b.start_datetime) < 0) // eslint-disable-line @typescript-eslint/no-explicit-any
  const sendToday    = visibleSendJobs.filter((b: any) => hoursUntil(b.start_datetime) >= 0 && isTodayBkk(b.start_datetime)) // eslint-disable-line @typescript-eslint/no-explicit-any
  const sendFuture    = visibleSendJobs.filter((b: any) => hoursUntil(b.start_datetime) >= 0 && !isTodayBkk(b.start_datetime)) // eslint-disable-line @typescript-eslint/no-explicit-any

  // แยกงานรับคืน: เกินกำหนด (มาจาก overdueRentals อยู่แล้ว) / รับคืนวันนี้ / ยังไม่ถึงกำหนด
  const returnToday  = dueSoonRentals.filter((j: any) => isTodayBkk(j.expected_end_datetime)) // eslint-disable-line @typescript-eslint/no-explicit-any
  const returnFuture = dueSoonRentals.filter((j: any) => !isTodayBkk(j.expected_end_datetime)) // eslint-disable-line @typescript-eslint/no-explicit-any

  const returnJobs = [...overdueRentals, ...dueSoonRentals]
  const nowMs = Date.now()
  const counts = {
    // ตัวเลขบนแท็บ/badge นับเฉพาะงานวันนี้ — ของค้างเก่า (เกินกำหนด) กับของยังไม่ถึงยังโชว์อยู่ในลิสต์ แต่ไม่นับรวมตัวเลข
    sendcar:  sendToday.length,
    returncar: returnToday.length,
    active:   activeRentals.length,
    broken:   repairs.length,
    routine:  overdueRoutines.length,
    docs:     docsDue.length,
    monthly:  allMonthlyRentals.length,
    contact:  monthlyContactAlerts.length,
    conflict: brokenBookings.length,
  }
  // monthly = overview only, not a task → exclude from total badge
  const total = counts.sendcar + counts.returncar + counts.active + counts.broken + counts.routine + counts.docs + counts.contact + counts.conflict

  const tabs: { key: Tab; label: string; count: number; bg: string; color: string }[] = [
    { key: 'all',      label: 'ทั้งหมด',       count: total,              bg: '#f1f5f9', color: '#111827' },
    { key: 'conflict', label: 'คิวมีปัญหา',    count: counts.conflict,    bg: '#fef2f2', color: '#b91c1c' },
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
                  <div style={{ width: '58px', flexShrink: 0, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {bike?.photo_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={bike.photo_url} alt="" loading="lazy" width={44} height={44} style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '8px' }} />
                      : <span style={{ fontSize: '26px' }}>🛵</span>}
                  </div>
                  <div style={{ flex: 1, padding: '12px 12px 10px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#111827', flex: 1 }}>
                        📞 ติดต่อ — {bike?.license_plate ?? ''} {bike?.brand ?? ''} {bike?.model ?? ''}
                      </span>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px',
                        background: badgeBg, color: badgeColor, whiteSpace: 'nowrap', flexShrink: 0,
                      }}>{badgeText}</span>
                    </div>
                    {bike?.color && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: bikeColorHex(bike.color), border: '1px solid rgba(0,0,0,.15)', flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', color: '#374151', fontWeight: 600 }}>{bike.color}</span>
                      </div>
                    )}
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

        {/* คิวมีปัญหา — คิวจองที่รถผูกไว้ไม่พร้อมใช้แล้ว (ซ่อม/ถูกแย่งไปใช้/รุ่นไม่พอ) */}
        {show('conflict') && brokenBookings.length > 0 && (
          <>
            <SectionTitle>⚠️ คิวมีปัญหา — ต้องจัดการรถให้ลูกค้า</SectionTitle>
            {brokenBookings.map((bb: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
              <div key={bb.id} style={{
                background: '#fff', borderRadius: '12px', marginBottom: '10px',
                boxShadow: '0 1px 3px rgba(0,0,0,.07)', overflow: 'hidden', display: 'flex',
              }}>
                <div style={{ width: '5px', background: '#dc2626', flexShrink: 0 }} />
                <div style={{ flex: 1, padding: '12px 14px 10px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#dc2626' }}>
                      {bb.reason}
                    </div>
                    {bb.fastLane && (
                      <span style={{
                        fontSize: '10px', fontWeight: 700, color: '#1e40af', background: '#dbeafe',
                        padding: '2px 7px', borderRadius: '999px', flexShrink: 0,
                      }}>⚡ Fast lane</span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                    {bb.customer_name}{bb.customer_phone ? ` • ${bb.customer_phone}` : ''}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                    📅 {fmtDate(bb.start_datetime)} {fmtTime(bb.start_datetime)} → {fmtDate(bb.end_datetime)} • #{bb.booking_ref}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    {bb.customer_phone && (
                      <a href={`tel:${bb.customer_phone}`} style={{
                        fontSize: '12px', fontWeight: 700, padding: '6px 12px', borderRadius: '8px',
                        background: '#f0fdf4', color: '#16a34a', textDecoration: 'none', border: '1px solid #bbf7d0',
                      }}>📱 โทร</a>
                    )}
                    <Link href={`/staff/assign/${bb.id}?mode=model&reason=${encodeURIComponent(bb.reason)}`} style={{
                      fontSize: '12px', fontWeight: 700, padding: '6px 12px', borderRadius: '8px',
                      background: '#dc2626', color: '#fff', textDecoration: 'none',
                    }}>🔄 จัดรถใหม่</Link>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ส่งรถ */}
        {show('sendcar') && visibleSendJobs.length > 0 && (
          <>
            <SectionTitle>งานส่งรถ 🛵➡️</SectionTitle>
            <CollapsibleGroup title="เลยเวลานัด" count={sendOverdue.length} dotColor="#dc2626" defaultOpen>
              {sendOverdue.map((b: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                const bike = b.bikes
                const absHrs = Math.abs(hoursUntil(b.start_datetime))
                const bikeLabel = bike
                  ? `${bike.license_plate} ${bike.brand} ${bike.model}`
                  : `${b.requested_brand ?? ''} ${b.requested_model ?? ''} (ยังไม่ได้กำหนดรถ)`
                const badge = absHrs >= 24 ? `⚠️ ลูกค้าไม่มา ${Math.floor(absHrs / 24)} วัน` : `⚠️ เลยเวลา ${absHrs} ชม.`
                const reassignNote = b.original_requested_brand && b.original_requested_model &&
                  (b.original_requested_brand !== b.requested_brand || b.original_requested_model !== b.requested_model)
                  ? `⚠️ รุ่นเดิม: ${b.original_requested_brand} ${b.original_requested_model} → เปลี่ยนเป็น: ${b.requested_brand} ${b.requested_model}${b.reassign_reason ? ` (${b.reassign_reason})` : ''} — ลูกค้าอาจถือใบจองรุ่นเดิมมา`
                  : undefined
                const blacklistNote = b.blacklist_watch ? `🔍 เฝ้าระวัง — ${b.blacklist_watch_reason ?? 'ตรงกับแบล็คลิสต์'}` : undefined
                return (
                  <JobCard
                    key={b.id}
                    dotColor={absHrs >= 3 ? '#dc2626' : '#d97706'}
                    photoUrl={bike?.photo_url} bikeColor={bike?.color}
                    title={`ส่งรถ — ${bikeLabel}`}
                    badge={badge} badgeBg="#fef2f2" badgeColor="#dc2626"
                    meta1={`👤 ${b.customer_name}${b.customer_phone ? ` • ${b.customer_phone}` : ''}`}
                    meta2={`📅 รับรถ ${fmtDate(b.start_datetime)} ${fmtTime(b.start_datetime)} น. • ${b.total_days} วัน`}
                    meta3={b.delivery_type === 'offsite' ? `🛵 ส่งนอกสถานที่ — ${b.delivery_address || 'ไม่ระบุที่อยู่'}` : undefined}
                    meta4={reassignNote}
                    meta5={blacklistNote}
                    href={`/staff/assign/${b.id}`} btnColor="#111827"
                    cardHref={bike?.id ? `/staff/bikes/${bike.id}/menu` : undefined}
                    onCancel={() => handleCancel(b.id)}
                    cancelDisabled={cancelling === b.id}
                  />
                )
              })}
            </CollapsibleGroup>
            <CollapsibleGroup title="ส่งรถวันนี้" count={sendToday.length} dotColor="#111827" defaultOpen>
              {sendToday.map((b: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                const bike = b.bikes
                const hrs = hoursUntil(b.start_datetime)
                const bikeLabel = bike
                  ? `${bike.license_plate} ${bike.brand} ${bike.model}`
                  : `${b.requested_brand ?? ''} ${b.requested_model ?? ''} (ยังไม่ได้กำหนดรถ)`
                const badge = hrs === 0 ? '🔔 ถึงเวลาแล้ว!' : `⏰ อีก ${hrs} ชม.`
                const reassignNote = b.original_requested_brand && b.original_requested_model &&
                  (b.original_requested_brand !== b.requested_brand || b.original_requested_model !== b.requested_model)
                  ? `⚠️ รุ่นเดิม: ${b.original_requested_brand} ${b.original_requested_model} → เปลี่ยนเป็น: ${b.requested_brand} ${b.requested_model}${b.reassign_reason ? ` (${b.reassign_reason})` : ''} — ลูกค้าอาจถือใบจองรุ่นเดิมมา`
                  : undefined
                const blacklistNote = b.blacklist_watch ? `🔍 เฝ้าระวัง — ${b.blacklist_watch_reason ?? 'ตรงกับแบล็คลิสต์'}` : undefined
                return (
                  <JobCard
                    key={b.id}
                    dotColor="#111827"
                    photoUrl={bike?.photo_url} bikeColor={bike?.color}
                    title={`ส่งรถ — ${bikeLabel}`}
                    badge={badge} badgeBg="#f1f5f9" badgeColor="#111827"
                    meta1={`👤 ${b.customer_name}${b.customer_phone ? ` • ${b.customer_phone}` : ''}`}
                    meta2={`📅 รับรถ ${fmtDate(b.start_datetime)} ${fmtTime(b.start_datetime)} น. • ${b.total_days} วัน`}
                    meta3={b.delivery_type === 'offsite' ? `🛵 ส่งนอกสถานที่ — ${b.delivery_address || 'ไม่ระบุที่อยู่'}` : undefined}
                    meta4={reassignNote}
                    meta5={blacklistNote}
                    statusLabel={bike ? '⬛ รอส่งรถ' : '🟡 ยังไม่ได้เลือกรถ'}
                    statusBg={bike ? '#f1f5f9' : '#fffbeb'} statusColor={bike ? '#111827' : '#d97706'}
                    href={`/staff/assign/${b.id}`} btnColor="#111827"
                    cardHref={bike?.id ? `/staff/bikes/${bike.id}/menu` : undefined}
                    onCancel={() => handleCancel(b.id)}
                    cancelDisabled={cancelling === b.id}
                  />
                )
              })}
            </CollapsibleGroup>
            <CollapsibleGroup title="ยังไม่ถึงวันนัด" count={sendFuture.length} dotColor="#9ca3af" defaultOpen={false}>
              {sendFuture.map((b: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                const bike = b.bikes
                const bikeLabel = bike
                  ? `${bike.license_plate} ${bike.brand} ${bike.model}`
                  : `${b.requested_brand ?? ''} ${b.requested_model ?? ''} (ยังไม่ได้กำหนดรถ)`
                const reassignNote = b.original_requested_brand && b.original_requested_model &&
                  (b.original_requested_brand !== b.requested_brand || b.original_requested_model !== b.requested_model)
                  ? `⚠️ รุ่นเดิม: ${b.original_requested_brand} ${b.original_requested_model} → เปลี่ยนเป็น: ${b.requested_brand} ${b.requested_model}${b.reassign_reason ? ` (${b.reassign_reason})` : ''} — ลูกค้าอาจถือใบจองรุ่นเดิมมา`
                  : undefined
                const blacklistNote = b.blacklist_watch ? `🔍 เฝ้าระวัง — ${b.blacklist_watch_reason ?? 'ตรงกับแบล็คลิสต์'}` : undefined
                return (
                  <JobCard
                    key={b.id}
                    dotColor="#9ca3af"
                    photoUrl={bike?.photo_url} bikeColor={bike?.color}
                    title={`ส่งรถ — ${bikeLabel}`}
                    badge={`📅 ${fmtDate(b.start_datetime)}`} badgeBg="#f1f5f9" badgeColor="#374151"
                    meta1={`👤 ${b.customer_name}${b.customer_phone ? ` • ${b.customer_phone}` : ''}`}
                    meta2={`📅 รับรถ ${fmtDate(b.start_datetime)} ${fmtTime(b.start_datetime)} น. • ${b.total_days} วัน`}
                    meta3={b.delivery_type === 'offsite' ? `🛵 ส่งนอกสถานที่ — ${b.delivery_address || 'ไม่ระบุที่อยู่'}` : undefined}
                    meta4={reassignNote}
                    meta5={blacklistNote}
                    href={`/staff/assign/${b.id}`} btnColor="#111827"
                    cardHref={bike?.id ? `/staff/bikes/${bike.id}/menu` : undefined}
                    onCancel={() => handleCancel(b.id)}
                    cancelDisabled={cancelling === b.id}
                  />
                )
              })}
            </CollapsibleGroup>
          </>
        )}

        {/* รับคืน */}
        {show('returncar') && returnJobs.length > 0 && (
          <>
            <SectionTitle>งานรับรถคืน ⬅️🛵</SectionTitle>
            <CollapsibleGroup title="เกินกำหนด" count={overdueRentals.length} dotColor="#dc2626" defaultOpen>
              {overdueRentals.map((job: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                const hrs = overdueHours(job.expected_end_datetime)
                const bike = job.bikes
                return (
                  <JobCard
                    key={job.id} dotColor="#dc2626"
                    photoUrl={bike?.photo_url} bikeColor={bike?.color}
                    title={`รับคืน — ${bike.license_plate} ${bike.brand} ${bike.model}`}
                    badge="🔴 เกินกำหนด!" badgeBg="#fef2f2" badgeColor="#dc2626"
                    meta1={`👤 ${job.customers.name}${job.customers.phone ? ` • ${job.customers.phone}` : ''}`}
                    meta2={`⏱ เกินมา ${hrs} ชม. • กำหนด ${fmtDate(job.expected_end_datetime)} ${fmtTime(job.expected_end_datetime)}`}
                    href={`/staff/return/${job.id}`} btnColor="#dc2626"
                    cardHref={`/staff/bikes/${bike.id}/menu`}
                    contractHref={`/staff/contract/${job.id}`}
                    extendHref={`/staff/extend/${job.id}`}
                  />
                )
              })}
            </CollapsibleGroup>
            <CollapsibleGroup title="รับคืนวันนี้" count={returnToday.length} dotColor="#d97706" defaultOpen>
              {returnToday.map((job: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                const hrs = hoursUntil(job.expected_end_datetime)
                const bike = job.bikes
                const urgent = hrs <= 2
                return (
                  <JobCard
                    key={job.id} dotColor={urgent ? '#d97706' : '#6b7280'}
                    photoUrl={bike?.photo_url} bikeColor={bike?.color}
                    title={`รับคืน — ${bike.license_plate} ${bike.brand} ${bike.model}`}
                    badge={`⚠️ ${fmtTime(job.expected_end_datetime)} น.`} badgeBg="#fffbeb" badgeColor="#d97706"
                    meta1={`👤 ${job.customers.name}${job.customers.phone ? ` • ${job.customers.phone}` : ''}`}
                    meta2={`⏱ อีก ${hrs} ชม. • กำหนด ${fmtDate(job.expected_end_datetime)}`}
                    href={`/staff/return/${job.id}`} btnColor={urgent ? '#d97706' : '#4b5563'}
                    cardHref={`/staff/bikes/${bike.id}/menu`}
                    contractHref={`/staff/contract/${job.id}`}
                    extendHref={`/staff/extend/${job.id}`}
                  />
                )
              })}
            </CollapsibleGroup>
            <CollapsibleGroup title="ยังไม่ถึงกำหนด" count={returnFuture.length} dotColor="#9ca3af" defaultOpen={false}>
              {returnFuture.map((job: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                const bike = job.bikes
                return (
                  <JobCard
                    key={job.id} dotColor="#9ca3af"
                    photoUrl={bike?.photo_url} bikeColor={bike?.color}
                    title={`รับคืน — ${bike.license_plate} ${bike.brand} ${bike.model}`}
                    badge={`📅 ${fmtDate(job.expected_end_datetime)}`} badgeBg="#f1f5f9" badgeColor="#374151"
                    meta1={`👤 ${job.customers.name}${job.customers.phone ? ` • ${job.customers.phone}` : ''}`}
                    meta2={`📅 กำหนด ${fmtDate(job.expected_end_datetime)} ${fmtTime(job.expected_end_datetime)}`}
                    href={`/staff/return/${job.id}`} btnColor="#4b5563"
                    cardHref={`/staff/bikes/${bike.id}/menu`}
                    contractHref={`/staff/contract/${job.id}`}
                    extendHref={`/staff/extend/${job.id}`}
                  />
                )
              })}
            </CollapsibleGroup>
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
                const bkk = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
                const endDay = bkk(new Date(job.expected_end_datetime))
                const todayDay = bkk(new Date())
                const tomorrowDay = bkk(new Date(Date.now() + 86_400_000))
                const dayLabel = endDay === todayDay ? 'คืนวันนี้' : endDay === tomorrowDay ? 'คืนพรุ่งนี้' : `คืน ${fmtDate(job.expected_end_datetime)}`
                badge = `⚠️ ${dayLabel} ${fmtTime(job.expected_end_datetime)}`
                badgeBg = '#fffbeb'; badgeColor = '#d97706'; dotColor = '#d97706'
                statusLabel = '⚠️ ใกล้ครบกำหนด'; statusBg = '#fffbeb'; statusColor = '#d97706'
              } else {
                badge = `📅 คืน ${fmtDate(job.expected_end_datetime)}`
              }

              const isLocked = bike?.id ? (lockOverrides[bike.id] ?? bike?.status === 'locked') : false
              return (
                <JobCard
                  key={job.id} dotColor={dotColor}
                  photoUrl={bike?.photo_url} bikeColor={bike?.color}
                  title={`${bike?.license_plate ?? ''} ${bike?.brand ?? ''} ${bike?.model ?? ''}`}
                  badge={badge} badgeBg={badgeBg} badgeColor={badgeColor}
                  meta1={`👤 ${job.customers?.name ?? '—'}${job.customers?.phone ? ` • ${job.customers.phone}` : ''}`}
                  meta2={`📅 เช่า ${fmtDate(job.start_datetime)} · ${job.total_days} วัน · ฿${Number(job.total_amount).toLocaleString()}`}
                  {...(isOverdue || diffMs < 24 * 3_600_000 ? {} : { statusLabel, statusBg, statusColor })}
                  href={`/staff/return/${job.id}`} btnColor={isOverdue ? '#dc2626' : '#16a34a'}
                  cardHref={bike?.id ? `/staff/bikes/${bike.id}/menu` : undefined}
                  contractHref={`/staff/contract/${job.id}`}
                  extendHref={`/staff/extend/${job.id}`}
                  swapHref={`/staff/swap/daily/${job.id}`}
                  isLocked={isLocked}
                  lockLoading={lockLoadingId === bike?.id}
                  onToggleLock={bike?.id ? () => handleToggleLock(bike.id, isLocked) : undefined}
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
                  photoUrl={bike?.photo_url} bikeColor={bike?.color}
                  title={`รถเสีย — ${bike.license_plate} ${bike.brand} ${bike.model}`}
                  badge={isPending ? '🔴 รอส่งซ่อม' : '🔧 กำลังซ่อม'}
                  badgeBg={isPending ? '#fef2f2' : '#fffbeb'} badgeColor={isPending ? '#dc2626' : '#d97706'}
                  meta1={`⚠️ ${r.title ?? r.description ?? 'ไม่ระบุอาการ'}`}
                  meta2={`📅 แจ้งเมื่อ ${fmtDate(r.created_at)}`}
                  href={`/staff/repair/${r.id}`} btnColor={isPending ? '#dc2626' : '#d97706'}
                  cardHref={bike?.id ? `/staff/bikes/${bike.id}/menu` : undefined}
                />
              )
            })}
          </>
        )}

        {/* รูทีน */}
        {show('routine') && (overdueRoutines.length > 0 || upcomingRoutines.length > 0) && (
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
                : days < 0 ? '🚨 เกินกำหนด' : days === 0 ? '🔴 ครบกำหนดวันนี้!' : `📅 อีก ${days} วัน`
              return (
                <JobCard
                  key={r.id} dotColor={p.dot}
                  photoUrl={bike?.photo_url} bikeColor={bike?.color}
                  title={`${r.task_name ?? 'บำรุงรักษา'} — ${bike?.license_plate ?? ''} ${bike?.brand ?? ''} ${bike?.model ?? ''}`}
                  badge={badgeText} badgeBg={p.bg} badgeColor={p.color}
                  meta1={kmOver != null ? (kmOver === 0 ? '📍 ถึงกำหนดพอดี!' : `📍 เกินกำหนด ${kmOver.toLocaleString()} กม.`) : `📅 กำหนด ${fmtDate(r.next_due_date)}`}
                  href={`/staff/routine?id=${r.id}`} btnColor={p.dot}
                  cardHref={bike?.id ? `/staff/bikes/${bike.id}/menu` : undefined}
                />
              )
            })}
            <CollapsibleGroup title="กำลังมาถึง" count={upcomingRoutines.length} dotColor="#9ca3af" defaultOpen={false}>
              {upcomingRoutines.map((r: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                const bike = r.bikes
                const days = r.next_due_date ? daysUntil(r.next_due_date) : 0
                return (
                  <JobCard
                    key={r.id} dotColor="#9ca3af"
                    photoUrl={bike?.photo_url} bikeColor={bike?.color}
                    title={`${r.task_name ?? 'บำรุงรักษา'} — ${bike?.license_plate ?? ''} ${bike?.brand ?? ''} ${bike?.model ?? ''}`}
                    badge={`📅 อีก ${days} วัน`} badgeBg="#f1f5f9" badgeColor="#374151"
                    meta1={`📅 กำหนด ${fmtDate(r.next_due_date)}`}
                    href={`/staff/routine?id=${r.id}`} btnColor="#374151"
                    cardHref={bike?.id ? `/staff/bikes/${bike.id}/menu` : undefined}
                  />
                )
              })}
            </CollapsibleGroup>
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
              return (
                <JobCard
                  key={d.id} dotColor={p.dot}
                  photoUrl={bike?.photo_url} bikeColor={bike?.color}
                  title={`ต่อ${DOC_LABEL[d.doc_type] ?? d.doc_type} — ${bike?.license_plate ?? ''}`}
                  badge={days < 0 ? `🚨 เกินมา ${Math.abs(days)} วัน` : `📅 อีก ${days} วัน`}
                  badgeBg={p.bg} badgeColor={p.color}
                  meta1={`${bike?.brand ?? ''} ${bike?.model ?? ''}`}
                  meta2={`หมดอายุ: ${fmtDate(d.expiry_date)}`}
                  href={`/staff/docs?bikeId=${d.bike_id}`} btnColor={p.dot}
                  cardHref={d.bike_id ? `/staff/bikes/${d.bike_id}/menu` : undefined}
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
                  photoUrl={bike?.photo_url} bikeColor={bike?.color}
                  title={`${bike?.license_plate ?? ''} ${bike?.brand ?? ''} ${bike?.model ?? ''}`}
                  badge={`📅 ครบวันที่ ${mr.payment_day} ทุกเดือน`}
                  badgeBg="#faf5ff" badgeColor="#7c3aed"
                  meta1={`👤 ${customer?.name ?? '—'}${customer?.phone ? ` • ${customer.phone}` : ''}`}
                  meta2={`💰 ฿${Number(mr.monthly_rate).toLocaleString()}/เดือน`}
                  statusLabel="🟣 รายเดือน"
                  statusBg="#faf5ff" statusColor="#7c3aed"
                  href={`/staff/collect/${mr.id}`} btnColor="#7c3aed" btnLabel="📄 สัญญา"
                  cardHref={bike?.id ? `/staff/bikes/${bike.id}/menu` : undefined}
                  swapHref={`/staff/swap/monthly/${mr.id}`}
                />
              )
            })}
          </>
        )}

        {/* ถ้ากด tab แต่ไม่มีงานในหมวดนั้น — ใช้ลิสต์เต็ม ไม่ใช่ตัวเลข badge (badge นับแค่วันนี้ แต่ลิสต์โชว์ครบ) */}
        {tab !== 'all' && (tab === 'sendcar' ? visibleSendJobs.length : tab === 'returncar' ? returnJobs.length : counts[tab as keyof typeof counts]) === 0 && (
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
