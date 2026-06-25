import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const BRANCH_ID = '00000000-0000-0000-0000-000000000001'

const DOC_LABEL: Record<string, string> = {
  tax: 'ภาษีรถ',
  pob: 'พ.ร.บ.',
  insurance: 'ประกันภัย',
}

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

// สีไล่ระดับตามความเร่งด่วน: น้ำเงิน → ส้ม → แดง → แดงแป๊ด
function urgencyPalette(days: number) {
  if (days < 0)  return { dot: '#b91c1c', bg: '#fee2e2', color: '#b91c1c' } // เกินกำหนด — แดงแป๊ด
  if (days <= 3)  return { dot: '#dc2626', bg: '#fef2f2', color: '#dc2626' } // ≤3 วัน — แดง
  if (days <= 7)  return { dot: '#ea580c', bg: '#fff7ed', color: '#ea580c' } // ≤7 วัน — ส้มแดง
  if (days <= 14) return { dot: '#d97706', bg: '#fffbeb', color: '#d97706' } // ≤14 วัน — ส้ม
  return           { dot: '#2563eb', bg: '#eff6ff', color: '#2563eb' }       // >14 วัน — น้ำเงิน
}

// ── Card components ──────────────────────────────────────────

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
  href, btnColor,
}: {
  dotColor: string, title: string
  badge: string, badgeBg: string, badgeColor: string
  meta1: string, meta2?: string
  statusLabel: string, statusBg: string, statusColor: string
  href: string, btnColor?: string
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: '12px', marginBottom: '10px',
      boxShadow: '0 1px 3px rgba(0,0,0,.07)', overflow: 'hidden',
      display: 'flex',
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
          <Link href={href} style={{
            fontSize: '12px', fontWeight: 700, padding: '6px 14px', borderRadius: '8px',
            background: btnColor ?? '#1d4ed8', color: '#fff', textDecoration: 'none',
          }}>
            เปิด →
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────

export default async function JobsPage() {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()
  const now = new Date()
  const nowIso = now.toISOString()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  const today = now.toISOString().split('T')[0]
  const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const in2hAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()

  const [
    { data: overdueRentals },
    { data: dueSoonRentals },
    { data: repairs },
    { data: routines },
    { data: docsDue },
    { data: monthlyDue },
    { data: sendJobs },
  ] = await Promise.all([
    // รับรถคืน — เกินกำหนด
    supabase.from('rentals')
      .select('id, expected_end_datetime, bikes(id, license_plate, brand, model), customers(name, phone)')
      .lt('expected_end_datetime', nowIso)
      .in('status', ['active', 'extended'])
      .eq('branch_id', BRANCH_ID)
      .order('expected_end_datetime', { ascending: true })
      .limit(20),

    // รับรถคืน — ถึงกำหนดใน 24ชม
    supabase.from('rentals')
      .select('id, expected_end_datetime, bikes(id, license_plate, brand, model), customers(name, phone)')
      .gte('expected_end_datetime', nowIso)
      .lte('expected_end_datetime', in24h)
      .in('status', ['active', 'extended'])
      .eq('branch_id', BRANCH_ID)
      .order('expected_end_datetime', { ascending: true })
      .limit(20),

    // รถเสีย / ซ่อม
    supabase.from('repairs')
      .select('id, title, description, status, created_at, bikes(id, license_plate, brand, model)')
      .in('status', ['pending', 'in_progress'])
      .eq('branch_id', BRANCH_ID)
      .order('created_at', { ascending: false })
      .limit(20),

    // รูทีน — ถึงกำหนด
    supabase.from('bike_routines')
      .select('id, type, next_due_km, next_due_date, bikes(id, license_plate, brand, model, odometer)')
      .or(`next_due_date.lte.${today},next_due_km.lte.0`)
      .limit(20),

    // เอกสาร — ใกล้หมดอายุ 30 วัน
    supabase.from('bike_documents')
      .select('id, doc_type, expiry_date, bikes(id, license_plate, brand, model)')
      .lte('expiry_date', in30days)
      .gte('expiry_date', today)
      .limit(20),

    // รายเดือน — ถึงกำหนดชำระ
    supabase.from('monthly_payments')
      .select('id, due_date, amount, monthly_rental_id, monthly_rentals(id, bike_id, bikes(id, license_plate, brand, model), customers(name), monthly_rate)')
      .in('status', ['pending', 'overdue'])
      .lte('due_date', in30days)
      .limit(20),

    // งานส่งรถ — bookings ที่วันรับรถอยู่ใน 24ชม (หรือเพิ่งผ่านมาไม่เกิน 2ชม)
    supabase.from('bookings')
      .select('id, booking_ref, start_datetime, customer_name, customer_phone, total_days, daily_rate, bikes(id, license_plate, brand, model)')
      .eq('status', 'confirmed')
      .eq('branch_id', BRANCH_ID)
      .gte('start_datetime', in2hAgo)
      .lte('start_datetime', in24h)
      .order('start_datetime', { ascending: true })
      .limit(20),
  ])

  // Filter routines that are actually overdue (km-based needs bike odometer)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overdueRoutines = (routines ?? []).filter((r: any) => {
    const bike = r.bikes
    const kmOverdue = r.next_due_km != null && bike?.odometer != null && r.next_due_km <= bike.odometer
    const dateOverdue = r.next_due_date != null && r.next_due_date <= today
    return kmOverdue || dateOverdue
  })

  const returnJobs = [...(overdueRentals ?? []), ...(dueSoonRentals ?? [])]

  const counts = {
    sendcar: (sendJobs ?? []).length,
    returncar: returnJobs.length,
    broken: (repairs ?? []).length,
    routine: overdueRoutines.length,
    docs: (docsDue ?? []).length,
    monthly: (monthlyDue ?? []).length,
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div className="app-wrap">

      {/* Header */}
      <div style={{
        background: '#4f46e5', padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
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

      {/* Summary chips */}
      <div style={{
        background: '#fff', padding: '10px 12px',
        display: 'flex', gap: '8px', overflowX: 'auto',
        borderBottom: '1px solid #e5e7eb',
      }}>
        {[
          { label: 'ทั้งหมด', count: total, bg: '#eef2ff', color: '#4f46e5' },
          { label: 'ส่งรถ', count: counts.sendcar, bg: '#f0fdfa', color: '#0891b2' },
          { label: 'รับคืน', count: counts.returncar, bg: '#fef2f2', color: '#dc2626' },
          { label: 'รถเสีย', count: counts.broken, bg: '#fef2f2', color: '#dc2626' },
          { label: 'รูทีน', count: counts.routine, bg: '#fffbeb', color: '#d97706' },
          { label: 'เอกสาร', count: counts.docs, bg: '#eff6ff', color: '#2563eb' },
          { label: 'รายเดือน', count: counts.monthly, bg: '#faf5ff', color: '#7c3aed' },
        ].map(({ label, count, bg, color }) => (
          <div key={label} style={{
            flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: bg, color, border: `1px solid ${color}33`,
            borderRadius: '10px', padding: '6px 12px', minWidth: '56px',
          }}>
            <span style={{ fontSize: '16px', fontWeight: 800 }}>{count}</span>
            <span style={{ fontSize: '10px', fontWeight: 600 }}>{label}</span>
          </div>
        ))}
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

        {/* งานส่งรถ */}
        {(sendJobs ?? []).length > 0 && (
          <>
            <SectionTitle>งานส่งรถ 🛵➡️ — วันนี้</SectionTitle>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(sendJobs ?? []).map((b: any) => {
              const bike = b.bikes
              const hrs = hoursUntil(b.start_datetime)
              const overdue = hrs < 0
              return (
                <JobCard
                  key={b.id}
                  dotColor="#0891b2"
                  title={`ส่งรถ — ${bike?.license_plate ?? ''} ${bike?.brand ?? ''} ${bike?.model ?? ''}`}
                  badge={overdue ? `🕐 เลยเวลา ${Math.abs(hrs)} ชม.` : hrs === 0 ? '🔔 ตอนนี้เลย!' : `⏰ อีก ${hrs} ชม.`}
                  badgeBg={overdue ? '#fef2f2' : '#f0fdfa'}
                  badgeColor={overdue ? '#dc2626' : '#0891b2'}
                  meta1={`👤 ${b.customer_name}${b.customer_phone ? ` • ${b.customer_phone}` : ''}`}
                  meta2={`📅 รับรถ ${fmtDate(b.start_datetime)} ${fmtTime(b.start_datetime)} น. • ${b.total_days} วัน`}
                  statusLabel={overdue ? '🔴 เลยเวลา' : '🔵 รอส่งรถ'}
                  statusBg={overdue ? '#fef2f2' : '#f0fdfa'}
                  statusColor={overdue ? '#dc2626' : '#0891b2'}
                  href={`/staff/send/${bike?.id}`}
                  btnColor="#0891b2"
                />
              )
            })}
          </>
        )}

        {/* รับรถคืน */}
        {returnJobs.length > 0 && (
          <>
            <SectionTitle>งานรับรถคืน ⬅️🛵 — ถึงกำหนดวันนี้</SectionTitle>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(overdueRentals ?? []).map((job: any) => {
              const hrs = overdueHours(job.expected_end_datetime)
              const bike = job.bikes
              return (
                <JobCard
                  key={job.id}
                  dotColor="#dc2626"
                  title={`รับคืน — ${bike.license_plate} ${bike.brand} ${bike.model}`}
                  badge={`🔴 เกินกำหนด!`}
                  badgeBg="#fef2f2" badgeColor="#dc2626"
                  meta1={`👤 ${job.customers.name}${job.customers.phone ? ` • ${job.customers.phone}` : ''}`}
                  meta2={`⏱ เกินมา ${hrs} ชม. • กำหนด ${fmtDate(job.expected_end_datetime)} ${fmtTime(job.expected_end_datetime)}`}
                  statusLabel="🔴 เกินกำหนด" statusBg="#fef2f2" statusColor="#dc2626"
                  href={`/staff/return/${job.id}`} btnColor="#dc2626"
                />
              )
            })}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(dueSoonRentals ?? []).map((job: any) => {
              const hrs = hoursUntil(job.expected_end_datetime)
              const bike = job.bikes
              const urgent = hrs <= 2
              return (
                <JobCard
                  key={job.id}
                  dotColor={urgent ? '#d97706' : '#6b7280'}
                  title={`รับคืน — ${bike.license_plate} ${bike.brand} ${bike.model}`}
                  badge={`⚠️ ${fmtTime(job.expected_end_datetime)} น.`}
                  badgeBg="#fffbeb" badgeColor="#d97706"
                  meta1={`👤 ${job.customers.name}${job.customers.phone ? ` • ${job.customers.phone}` : ''}`}
                  meta2={`⏱ อีก ${hrs} ชม. • กำหนด ${fmtDate(job.expected_end_datetime)}`}
                  statusLabel={urgent ? '⚠️ ใกล้ถึงกำหนด' : '📅 วันนี้'}
                  statusBg={urgent ? '#fffbeb' : '#f9fafb'}
                  statusColor={urgent ? '#d97706' : '#6b7280'}
                  href={`/staff/return/${job.id}`} btnColor={urgent ? '#d97706' : '#4b5563'}
                />
              )
            })}
          </>
        )}

        {/* รถเสีย */}
        {(repairs ?? []).length > 0 && (
          <>
            <SectionTitle>งานแจ้งรถเสีย 🛵💥</SectionTitle>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(repairs ?? []).map((r: any) => {
              const bike = r.bikes
              const isPending = r.status === 'pending'
              return (
                <JobCard
                  key={r.id}
                  dotColor={isPending ? '#dc2626' : '#d97706'}
                  title={`รถเสีย — ${bike.license_plate} ${bike.brand} ${bike.model}`}
                  badge={isPending ? '🔴 รอส่งซ่อม' : '🔧 กำลังซ่อม'}
                  badgeBg={isPending ? '#fef2f2' : '#fffbeb'}
                  badgeColor={isPending ? '#dc2626' : '#d97706'}
                  meta1={`⚠️ ${r.title ?? r.description ?? 'ไม่ระบุอาการ'}`}
                  meta2={`📅 แจ้งเมื่อ ${fmtDate(r.created_at)}`}
                  statusLabel={isPending ? '🔴 รอดำเนินการ' : '🔧 กำลังซ่อม'}
                  statusBg={isPending ? '#fef2f2' : '#fffbeb'}
                  statusColor={isPending ? '#dc2626' : '#d97706'}
                  href={`/staff/repair/${r.id}`} btnColor={isPending ? '#dc2626' : '#d97706'}
                />
              )
            })}
          </>
        )}

        {/* รูทีน */}
        {overdueRoutines.length > 0 && (
          <>
            <SectionTitle>งานซ่อมบำรุงรูทีน 🔧🛢️</SectionTitle>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {overdueRoutines.map((r: any) => {
              const bike = r.bikes
              const typeLabel = r.type ?? 'บำรุงรักษา'
              const kmOver = r.next_due_km != null && bike?.odometer != null
                ? bike.odometer - r.next_due_km : null
              // คำนวณ days สำหรับ date-based routine (km-based ถือว่าเกินแล้ว = -1)
              const days = kmOver != null ? -1 : (r.next_due_date ? daysUntil(r.next_due_date) : 0)
              const p = urgencyPalette(days)
              const badgeText = kmOver != null
                ? `🔴 เกิน ${kmOver.toLocaleString()} กม.`
                : days < 0 ? `🚨 เกินกำหนด` : `📅 อีก ${days} วัน`
              const statusText = days < 0 || kmOver != null ? '🔴 เกินกำหนด' : days <= 3 ? '🔴 เร่งด่วน' : '⚠️ ถึงกำหนด'
              return (
                <JobCard
                  key={r.id}
                  dotColor={p.dot}
                  title={`${typeLabel} — ${bike?.license_plate ?? ''} ${bike?.brand ?? ''} ${bike?.model ?? ''}`}
                  badge={badgeText}
                  badgeBg={p.bg} badgeColor={p.color}
                  meta1={kmOver != null ? `📍 เกินกำหนด ${kmOver.toLocaleString()} กม.` : `📅 กำหนด ${fmtDate(r.next_due_date)}`}
                  statusLabel={statusText}
                  statusBg={p.bg} statusColor={p.color}
                  href="/staff/routine" btnColor={p.dot}
                />
              )
            })}
          </>
        )}

        {/* เอกสาร */}
        {(docsDue ?? []).length > 0 && (
          <>
            <SectionTitle>งานเอกสาร 📋✅</SectionTitle>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(docsDue ?? []).map((d: any) => {
              const bike = d.bikes
              const days = daysUntil(d.expiry_date)
              const p = urgencyPalette(days)
              const badgeText = days < 0 ? `🚨 เกินมา ${Math.abs(days)} วัน` : `📅 อีก ${days} วัน`
              const statusText = days < 0 ? '🔴 เกินกำหนด' : days <= 3 ? '🔴 เร่งด่วนมาก' : days <= 7 ? '🟠 เร่งด่วน' : days <= 14 ? '⚠️ ใกล้หมด' : '📋 แจ้งเตือน'
              return (
                <JobCard
                  key={d.id}
                  dotColor={p.dot}
                  title={`ต่อ${DOC_LABEL[d.doc_type] ?? d.doc_type} — ${bike?.license_plate ?? ''}`}
                  badge={badgeText}
                  badgeBg={p.bg} badgeColor={p.color}
                  meta1={`${bike?.brand ?? ''} ${bike?.model ?? ''}`}
                  meta2={`หมดอายุ: ${fmtDate(d.expiry_date)}`}
                  statusLabel={statusText}
                  statusBg={p.bg} statusColor={p.color}
                  href="/staff/docs" btnColor={p.dot}
                />
              )
            })}
          </>
        )}

        {/* รายเดือน */}
        {(monthlyDue ?? []).length > 0 && (
          <>
            <SectionTitle>งานเก็บค่าเช่ารายเดือน 💰🗓️</SectionTitle>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(monthlyDue ?? []).map((p: any) => {
              const mr = p.monthly_rentals
              const bike = mr?.bikes
              const customer = mr?.customers
              const days = daysUntil(p.due_date)
              const overdue = days < 0
              return (
                <JobCard
                  key={p.id}
                  dotColor="#7c3aed"
                  title={`เก็บค่าเช่า — ${bike?.license_plate ?? ''} ${bike?.brand ?? ''} ${bike?.model ?? ''}`}
                  badge={overdue ? `🔴 เกิน ${Math.abs(days)} วัน` : `🗓️ ครบ ${fmtDate(p.due_date)}`}
                  badgeBg={overdue ? '#fef2f2' : '#faf5ff'}
                  badgeColor={overdue ? '#dc2626' : '#7c3aed'}
                  meta1={`👤 ${customer?.name ?? '—'}`}
                  meta2={`💰 ฿${Number(p.amount).toLocaleString()}`}
                  statusLabel={overdue ? '🔴 เกินกำหนด' : '🟣 รอเก็บเงิน'}
                  statusBg={overdue ? '#fef2f2' : '#faf5ff'}
                  statusColor={overdue ? '#dc2626' : '#7c3aed'}
                  href={`/staff/collect/${mr?.id}`} btnColor="#7c3aed"
                />
              )
            })}
          </>
        )}

      </div>
    </div>
  )
}
