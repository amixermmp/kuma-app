import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ScanLine, Pin, Search, Bike, Send, Wrench, FileText, Droplet, Undo2, Phone, Store, Lock, Fuel } from 'lucide-react'
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

  // นับ routine ที่เกินกำหนดหรือถึงวันนี้เท่านั้น (ไม่เอา 7 วันข้างหน้ามารวม กันจำนวนดูเยอะเกินจริง — เหมือน jobs page)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routineCount = (routineData ?? []).filter((r: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const odometer = (r.bikes as any)?.odometer ?? 0
    if (r.next_due_km != null && odometer >= r.next_due_km) return true
    if (r.next_due_date && r.next_due_date <= today) return true
    return false
  }).length

  const staffName = staffRow?.name ?? 'Staff'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const branchName = (staffRow as any)?.branches?.name ?? 'Kuma Bikes'
  const totalJobs = (overdueCount ?? 0) + (dueSoonCount ?? 0) + (repairCount ?? 0) + (contactCount ?? 0) + (docsCount ?? 0) + (sendCount ?? 0) + routineCount

  const QUICK_ACTIONS = [
    { Icon: Search, label: 'ค้นหารถ',    href: '/staff/search' },
    { Icon: Bike,   label: 'รวมรถ',       href: '/staff/fleet' },
    { Icon: Store,  label: 'ภาพรวมร้าน', href: '/staff/overview' },
    { Icon: Send,   label: 'ส่งรถคิวจอง', href: '/staff/send-queue' },
    { Icon: Wrench, label: 'แจ้งรถเสีย',  href: '/staff/broken' },
    { Icon: FileText, label: 'งานเอกสาร', href: '/staff/docs' },
    { Icon: Droplet, label: 'งานรูทีน',   href: '/staff/routine' },
    { Icon: Fuel,    label: 'ภาพรวมน้ำมัน', href: '/staff/fuel' },
    { Icon: Lock,    label: 'ปิดร้าน',    href: '/staff/closeshop' },
  ] as const

  const BADGES = [
    { Icon: Send, label: `ส่งรถ ${sendCount}`, show: (sendCount ?? 0) > 0, color: '#fff', bg: 'rgba(255,255,255,.08)' },
    { Icon: Undo2, label: `รับคืน ${(overdueCount ?? 0) + (dueSoonCount ?? 0)}`, show: ((overdueCount ?? 0) + (dueSoonCount ?? 0)) > 0, color: '#f87171', bg: 'rgba(229,35,27,.15)' },
    { Icon: Wrench, label: `ซ่อม ${repairCount}`, show: (repairCount ?? 0) > 0, color: '#fbbf24', bg: 'rgba(255,255,255,.08)' },
    { Icon: Phone, label: `ติดต่อลูกค้า ${contactCount}`, show: (contactCount ?? 0) > 0, color: '#c4b5fd', bg: 'rgba(255,255,255,.08)' },
    { Icon: FileText, label: `เอกสาร ${docsCount}`, show: (docsCount ?? 0) > 0, color: '#fff', bg: 'rgba(255,255,255,.08)' },
    { Icon: Droplet, label: `รูทีน ${routineCount}`, show: routineCount > 0, color: '#fbbf24', bg: 'rgba(255,255,255,.08)' },
  ]

  return (
    <div className="app-wrap" style={{ background: '#111111', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{
        padding: '18px 16px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
          background: '#e5231b', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '16px',
        }}>🐻</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: '15px', letterSpacing: '0.5px' }}>KUMA</div>
          <div style={{ color: 'rgba(255,255,255,.55)', fontSize: '11px' }}>{staffName} · {branchName}</div>
        </div>
        <form action="/api/staff/logout" method="post">
          <button type="submit" style={{
            background: 'rgba(255,255,255,.1)', color: '#fff',
            border: 'none', borderRadius: '10px',
            padding: '8px 12px', fontSize: '13px', fontWeight: 600,
            fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>ออก</button>
        </form>
      </div>
      <TabBar />

      {/* Bento row: QR scan (big) + job count */}
      <div style={{ padding: '4px 16px 12px', display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '10px' }}>
        <Link href="/staff/scan" style={{
          background: '#e5231b', borderRadius: '20px', padding: '16px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          minHeight: '128px', textDecoration: 'none',
        }}>
          <ScanLine size={28} color="#fff" strokeWidth={1.5} />
          <div style={{ color: '#fff', fontSize: '15px', fontWeight: 700, lineHeight: 1.3 }}>
            สแกน QR<br />เพื่อเริ่มงาน
          </div>
        </Link>

        <Link href="/staff/jobs" style={{
          background: totalJobs > 0 ? '#2a1414' : '#1e1e1e', borderRadius: '20px', padding: '16px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          minHeight: '128px', textDecoration: 'none',
        }}>
          <Pin size={26} color={totalJobs > 0 ? '#f87171' : '#fff'} strokeWidth={1.75} />
          <div>
            <div style={{ color: totalJobs > 0 ? '#f87171' : '#fff', fontSize: '24px', fontWeight: 800 }}>{totalJobs}</div>
            <div style={{ color: 'rgba(255,255,255,.55)', fontSize: '11px', marginTop: '2px' }}>งานค้าง</div>
          </div>
        </Link>
      </div>

      {/* Job breakdown tags (only if there are jobs) */}
      {totalJobs > 0 && (
        <Link href="/staff/jobs" style={{ textDecoration: 'none', display: 'block' }}>
          <div style={{
            margin: '0 16px 12px', padding: '12px 14px', borderRadius: '16px',
            background: '#1e1e1e', display: 'flex', gap: '8px', flexWrap: 'wrap',
          }}>
            {BADGES.filter(b => b.show).map(({ Icon, label, color, bg }) => (
              <span key={label} style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                fontSize: '11px', color, fontWeight: 600, background: bg,
                padding: '4px 10px', borderRadius: '999px',
              }}>
                <Icon size={12} strokeWidth={2} />
                {label}
              </span>
            ))}
          </div>
        </Link>
      )}

      {/* Quick actions — white sheet floating up, fills remaining height */}
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '18px 16px 24px', flex: 1 }}>
        <div style={{ color: '#6b7280', fontSize: '13px', fontWeight: 600, paddingBottom: '10px' }}>
          เมนูด่วน
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          {QUICK_ACTIONS.map(({ Icon, label, href }) => (
            <Link key={href} href={href} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              background: '#f9fafb',
              borderRadius: '16px',
              padding: '14px 6px',
              textDecoration: 'none',
              color: '#111827',
              fontWeight: 600,
              fontSize: '11px',
              textAlign: 'center',
            }}>
              <span style={{
                width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                background: 'rgba(229,35,27,.1)', display: 'flex', alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon size={18} color="#e5231b" strokeWidth={1.75} />
              </span>
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
