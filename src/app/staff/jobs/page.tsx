import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Repair = {
  id: string
  description: string
  severity: string
  status: string
  created_at: string
  bikes: { license_plate: string; brand: string; model: string }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default async function JobsPage() {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()
  const { data: repairs } = await supabase
    .from('repairs')
    .select('id, description, severity, status, created_at, bikes(license_plate, brand, model)')
    .in('status', ['pending', 'in_repair'])
    .order('created_at', { ascending: false })

  const jobs = (repairs ?? []) as unknown as Repair[]

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: '#7c3aed' }}>
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div>
          <h1>Job Tasks</h1>
          <div className="sub">งานที่ต้องดำเนินการ ({jobs.length})</div>
        </div>
      </div>

      <div style={{ padding: '12px 12px 80px' }}>
        {jobs.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '40px', background: '#f9fafb',
            borderRadius: '12px', color: '#9ca3af', fontSize: '14px',
          }}>
            ✅ ไม่มีงานค้างอยู่
          </div>
        ) : jobs.map(job => {
          const isCritical = job.severity === 'critical'
          const bike = job.bikes
          return (
            <Link key={job.id} href={`/staff/repair/${job.id}`} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              background: isCritical ? '#fef2f2' : '#fff',
              borderRadius: '12px', padding: '14px', marginBottom: '10px',
              borderLeft: `4px solid ${isCritical ? '#dc2626' : '#d97706'}`,
              textDecoration: 'none', color: 'inherit',
              boxShadow: '0 1px 3px rgba(0,0,0,.06)',
            }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
                background: isCritical ? '#fef2f2' : '#fffbeb',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
              }}>🔧</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>
                  {isCritical ? '🔴 ' : '⚠️ '}รถเสีย — {job.description.slice(0, 30)}{job.description.length > 30 ? '…' : ''}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>
                  {bike.license_plate} • แจ้งเมื่อ {fmtDate(job.created_at)}
                </div>
              </div>
              <span style={{ color: '#9ca3af', fontSize: '20px' }}>›</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
