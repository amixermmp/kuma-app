import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TabBar from '@/components/staff/TabBar'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds, getAllowedBikeIds } from '@/lib/staffBranch'

export const dynamic = 'force-dynamic'


export default async function StaffHomePage() {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()
  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const nowIso = now.toISOString()
  const in24hIso = in24h.toISOString()
  const today = nowIso.split('T')[0]
  const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const in2hAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
  const in2days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const allowedBranchIds = await getStaffBranchIds(staffId)
  const allowedBikeIds = await getAllowedBikeIds(allowedBranchIds)

  const applyBranch = <T extends object>(q: T) => {
    let query = q as any
    if (allowedBranchIds) query = query.in('branch_id', allowedBranchIds)
    return query
  }
  const applyBike = <T extends object>(q: T) => {
    let query = q as any
    if (allowedBikeIds) query = query.in('bike_id', allowedBikeIds)
    return query
  }

  const [
    { data: staffRow },
    { count: overdueCount },
    { count: dueSoonCount },
    { count: repairCount },
    { count: contactCount },
    { count: docsCount },
    { count: sendCount },
    { data: routineData },
  ] = await Promise.all([
    supabase.from('staff').select('name, branches(name)').eq('id', staffId).single(),

    applyBranch(supabase.from('rentals').select('id', { count: 'exact', head: true })
      .lt('expected_end_datetime', nowIso).in('status', ['active', 'extended'])),

    applyBranch(supabase.from('rentals').select('id', { count: 'exact', head: true })
      .gte('expected_end_datetime', nowIso).lte('expected_end_datetime', in24hIso)
      .in('status', ['active', 'extended'])),

    applyBike(supabase.from('repairs').select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'in_progress'])),

    // ติดต่อลูกค้า: รายเดือนที่ค้างหรือครบกำหนดใน 2 วัน (เหมือน jobs page)
    applyBike(supabase.from('monthly_payments').select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'overdue']).lte('due_date', in2days)),

    applyBike(supabase.from('bike_documents').select('id', { count: 'exact', head: true })
      .lte('expiry_date', in30days).gte('expiry_date', today)),

    applyBranch(supabase.from('bookings').select('id', { count: 'exact', head: true })
      .eq('status', 'confirmed').gte('start_datetime', in2hAgo).lte('start_datetime', in24hIso)),

    applyBike(supabase.from('bike_routines')
      .select('next_due_km, next_due_date, bikes(odometer)')),
  ])

  // นับ routine ที่เลยกำหนดหรือใกล้ถึงกำหนด 7 วัน (เหมือน jobs page)
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routineCount = (routineData ?? []).filter((r: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const odometer = (r.bikes as any)?.odometer ?? 0
    if (r.next_due_km != null && odometer >= r.next_due_km) return true
    if (r.next_due_date && r.next_due_date <= in7days) return true
    return false
  }).length

  const staffName = staffRow?.name ?? 'Staff'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const branchName = (staffRow as any)?.branches?.name ?? 'Kuma Bikes'
  const totalJobs = (overdueCount ?? 0) + (dueSoonCount ?? 0) + (repairCount ?? 0) + (contactCount ?? 0) + (docsCount ?? 0) + (sendCount ?? 0) + routineCount

  return (
    <div className="app-wrap">

      {/* Header */}
      <div style={{
        background: '#111827',
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
      </div>
      <TabBar />

      <div style={{ padding: '16px' }}>

        {/* QR Scan */}
        <Link href="/staff/scan" style={{
          display: 'block',
          background: '#e11d48',
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

        {/* Job Tasks Summary */}
        <Link href="/staff/jobs" style={{ textDecoration: 'none', display: 'block', marginBottom: '16px' }}>
          <div style={{
            borderRadius: '16px', overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,.08)',
            border: totalJobs > 0 ? '1.5px solid #e5e7eb' : '1.5px solid #e5e7eb',
          }}>
            <div style={{
              background: totalJobs > 0 ? '#111827' : '#f9fafb',
              padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: '14px',
            }}>
              <div style={{
                width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0,
                background: totalJobs > 0 ? 'rgba(255,255,255,.2)' : '#e5e7eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px',
              }}>
                📌
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '16px', color: totalJobs > 0 ? '#fff' : '#6b7280' }}>
                  {totalJobs > 0 ? `มีงานค้าง ${totalJobs} รายการ` : 'ไม่มีงานค้าง ✅'}
                </div>
                <div style={{ fontSize: '12px', color: totalJobs > 0 ? 'rgba(255,255,255,.75)' : '#9ca3af', marginTop: '3px' }}>
                  {totalJobs > 0 ? 'แตะเพื่อดูรายละเอียดทั้งหมด →' : 'ทุกอย่างเรียบร้อยดี'}
                </div>
              </div>
              {totalJobs > 0 && (
                <div style={{
                  background: '#dc2626', color: '#fff', borderRadius: '999px',
                  minWidth: '32px', height: '32px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '15px', fontWeight: 800, padding: '0 8px',
                }}>
                  {totalJobs}
                </div>
              )}
            </div>
            {totalJobs > 0 && (
              <div style={{
                background: '#fff', padding: '10px 18px',
                display: 'flex', gap: '8px', flexWrap: 'wrap',
              }}>
                {(sendCount ?? 0) > 0 && <span style={{ fontSize: '12px', color: '#111827', fontWeight: 600 }}>🛵➡️ ส่งรถ {sendCount}</span>}
                {((overdueCount ?? 0) + (dueSoonCount ?? 0)) > 0 && <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>⬅️ รับคืน {(overdueCount ?? 0) + (dueSoonCount ?? 0)}</span>}
                {(repairCount ?? 0) > 0 && <span style={{ fontSize: '12px', color: '#d97706', fontWeight: 600 }}>🔧 ซ่อม {repairCount}</span>}
                {(contactCount ?? 0) > 0 && <span style={{ fontSize: '12px', color: '#7c3aed', fontWeight: 600 }}>💰 ติดต่อลูกค้า {contactCount}</span>}
                {(docsCount ?? 0) > 0 && <span style={{ fontSize: '12px', color: '#374151', fontWeight: 600 }}>📋 เอกสาร {docsCount}</span>}
                {routineCount > 0 && <span style={{ fontSize: '12px', color: '#b45309', fontWeight: 600 }}>🛢️ รูทีน {routineCount}</span>}
              </div>
            )}
          </div>
        </Link>

        {/* Quick actions */}
        <div style={{ color: '#6b7280', fontSize: '13px', fontWeight: 600, paddingBottom: '8px' }}>
          เมนูด่วน
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {([
            { icon: '🔍', label: 'ค้นหารถ',    href: '/staff/search' },
            { icon: '🛵', label: 'รวมรถ',       href: '/staff/fleet' },
            { icon: '🔧', label: 'แจ้งรถเสีย',  href: '/staff/broken' },
            { icon: '📄', label: 'งานเอกสาร',  href: '/staff/docs' },
            { icon: '🛢️', label: 'งานรูทีน',   href: '/staff/routine' },
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
