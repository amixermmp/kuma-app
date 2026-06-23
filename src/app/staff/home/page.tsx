import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Rental = {
  id: string
  expected_end_datetime: string
  status: string
  bikes: { license_plate: string; brand: string; model: string }
  customers: { name: string }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function overdueHours(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
}

export default async function StaffHomePage() {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()
  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const [{ data: staffRow }, { data: overdue }, { data: dueSoon }] = await Promise.all([
    supabase
      .from('staff')
      .select('name, branches(name)')
      .eq('id', staffId)
      .single(),
    supabase
      .from('rentals')
      .select('id, expected_end_datetime, status, bikes(license_plate, brand, model), customers(name)')
      .lt('expected_end_datetime', now.toISOString())
      .in('status', ['active', 'extended'])
      .order('expected_end_datetime', { ascending: true })
      .limit(10),
    supabase
      .from('rentals')
      .select('id, expected_end_datetime, status, bikes(license_plate, brand, model), customers(name)')
      .gte('expected_end_datetime', now.toISOString())
      .lte('expected_end_datetime', in24h.toISOString())
      .in('status', ['active', 'extended'])
      .order('expected_end_datetime', { ascending: true })
      .limit(10),
  ])

  const staffName = staffRow?.name ?? 'Staff'
  const branchName = (staffRow?.branches as { name: string } | null)?.name ?? 'Kuma Bikes'
  const allJobs: Rental[] = [
    ...((overdue ?? []) as Rental[]),
    ...((dueSoon ?? []) as Rental[]),
  ]

  return (
    <div className="app-wrap">

      {/* Header */}
      <div style={{
        background: '#1e40af',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <span style={{ fontSize: '22px' }}>🛵</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '17px' }}>
            สวัสดี, {staffName}! 👋
          </div>
          <div style={{ color: 'rgba(255,255,255,.65)', fontSize: '13px' }}>{branchName}</div>
        </div>
        <Link href="/staff/settings" style={{ fontSize: '22px', textDecoration: 'none' }}>⚙️</Link>
      </div>

      <div style={{ padding: '16px' }}>

        {/* QR Scan */}
        <Link href="/staff/scan" style={{
          display: 'block',
          background: 'linear-gradient(135deg,#1e40af,#1d4ed8)',
          borderRadius: '16px',
          padding: '24px',
          textAlign: 'center',
          color: '#fff',
          marginBottom: '16px',
          textDecoration: 'none',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>📷</div>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>สแกน QR รถ</div>
          <div style={{ fontSize: '13px', opacity: 0.8, marginTop: '4px' }}>แตะเพื่อเปิดกล้องสแกน</div>
        </Link>

        {/* Jobs header */}
        <div style={{ color: '#6b7280', fontSize: '13px', padding: '8px 0', fontWeight: 600 }}>
          งานวันนี้ ({allJobs.length})
        </div>

        {allJobs.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '32px 16px',
            background: '#f9fafb',
            borderRadius: '12px',
            color: '#9ca3af',
            fontSize: '14px',
            marginBottom: '12px',
          }}>
            ✅ ไม่มีงานค้างอยู่
          </div>
        ) : allJobs.map((job) => {
          const isOverdue = new Date(job.expected_end_datetime) < now
          const bike = job.bikes
          const bikeName = `${bike.license_plate} ${bike.brand} ${bike.model}`
          return (
            <Link
              key={job.id}
              href={`/staff/return/${job.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: '#fff',
                borderRadius: '12px',
                padding: '14px',
                marginBottom: '10px',
                borderLeft: `4px solid ${isOverdue ? '#dc2626' : '#d97706'}`,
                textDecoration: 'none',
                color: 'inherit',
                boxShadow: '0 1px 3px rgba(0,0,0,.06)',
              }}
            >
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                flexShrink: 0,
                background: isOverdue ? '#fef2f2' : '#fffbeb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
              }}>
                ⬅️🛵
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>
                  รับคืน — {bikeName}
                </div>
                <div style={{ fontSize: '12px', marginTop: '3px', color: isOverdue ? '#dc2626' : '#d97706' }}>
                  {isOverdue
                    ? `🔴 เกินกำหนด ${overdueHours(job.expected_end_datetime)} ชม. • ${job.customers.name}`
                    : `⚠️ ${formatTime(job.expected_end_datetime)} น. • ${job.customers.name}`}
                </div>
              </div>
              <span style={{ color: '#9ca3af', fontSize: '22px', lineHeight: 1 }}>›</span>
            </Link>
          )
        })}

        <Link href="/staff/jobs" style={{
          display: 'block',
          padding: '13px',
          background: '#4f46e5',
          color: '#fff',
          borderRadius: '10px',
          textAlign: 'center',
          fontWeight: 600,
          fontSize: '14px',
          textDecoration: 'none',
          marginTop: '4px',
          marginBottom: '20px',
        }}>
          📌 ดูงานทั้งหมด →
        </Link>

        {/* Quick actions */}
        <div style={{ color: '#6b7280', fontSize: '13px', fontWeight: 600, paddingBottom: '8px' }}>
          เมนูด่วน
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {([
            { icon: '🔍', label: 'ค้นหารถ', href: '/staff/search' },
            { icon: '📋', label: 'รายการรถ', href: '/staff/bikes' },
            { icon: '🔧', label: 'แจ้งรถเสีย', href: '/staff/broken' },
            { icon: '📄', label: 'งานเอกสาร', href: '/staff/docs' },
          ] as const).map(({ icon, label, href }) => (
            <Link key={href} href={href} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: '#fff',
              borderRadius: '12px',
              padding: '14px',
              textDecoration: 'none',
              color: '#111827',
              fontWeight: 600,
              fontSize: '14px',
              boxShadow: '0 1px 3px rgba(0,0,0,.06)',
              border: '1px solid #f3f4f6',
            }}>
              <span style={{ fontSize: '22px' }}>{icon}</span>
              {label}
            </Link>
          ))}
        </div>

      </div>
    </div>
  )
}
