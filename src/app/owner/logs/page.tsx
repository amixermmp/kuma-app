import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pruneOldLogs } from '@/lib/log'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const ACTOR_ICON: Record<string, string> = {
  staff:  '👤',
  owner:  '👑',
  system: '🤖',
}

const ACTION_LABEL: Record<string, string> = {
  rental_created:  'ส่งรถ (รายวัน)',
  monthly_created: 'ส่งรถ (รายเดือน)',
  bike_returned:   'คืนรถ',
  photos_deleted:  'ลบรูป',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'เมื่อกี้'
  if (mins < 60) return `${mins} นาทีที่แล้ว`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} ชั่วโมงที่แล้ว`
  const days = Math.floor(hrs / 24)
  return `${days} วันที่แล้ว`
}

function formatFull(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default async function OwnerLogsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  // Prune logs older than 90 days (best-effort, runs on page load)
  await pruneOldLogs()

  const admin = createAdminClient()
  const { data: logs } = await admin
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const list = logs ?? []

  // Group by date
  const groups: Record<string, typeof list> = {}
  for (const log of list) {
    const date = new Date(log.created_at).toLocaleDateString('th-TH', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
    if (!groups[date]) groups[date] = []
    groups[date].push(log)
  }

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a8a)' }}>
        <Link href="/owner/dashboard" className="app-header-back">←</Link>
        <div style={{ flex: 1 }}>
          <h1>Activity Log</h1>
          <div className="sub">ย้อนหลัง 90 วัน • {list.length} รายการ</div>
        </div>
      </div>

      <div style={{ paddingBottom: '80px' }}>
        {list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', fontSize: '14px' }}>
            ยังไม่มี activity ในระบบ
          </div>
        ) : (
          Object.entries(groups).map(([date, entries]) => (
            <div key={date}>
              {/* Date header */}
              <div style={{
                padding: '10px 16px 6px',
                fontSize: '12px', fontWeight: 700,
                color: '#6b7280', letterSpacing: '0.5px',
                background: '#f1f5f9',
                borderBottom: '1px solid #e2e8f0',
              }}>
                {date}
              </div>

              {/* Entries */}
              {entries.map(log => (
                <div key={log.id} style={{
                  display: 'flex', gap: '12px', padding: '12px 16px',
                  borderBottom: '1px solid #f1f5f9',
                  background: '#fff',
                }}>
                  {/* Icon */}
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: log.actor_type === 'system' ? '#f1f5f9'
                      : log.actor_type === 'owner' ? '#fef3c7' : '#eff6ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', flexShrink: 0,
                  }}>
                    {ACTOR_ICON[log.actor_type] ?? '❓'}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ fontSize: '13px', color: '#111827', fontWeight: 500, lineHeight: '1.4' }}>
                        {log.description}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0, marginTop: '1px' }}>
                        {timeAgo(log.created_at)}
                      </div>
                    </div>
                    <div style={{ marginTop: '4px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, padding: '1px 7px',
                        borderRadius: '10px',
                        background: log.actor_type === 'system' ? '#f1f5f9'
                          : log.actor_type === 'owner' ? '#fef3c7' : '#eff6ff',
                        color: log.actor_type === 'system' ? '#6b7280'
                          : log.actor_type === 'owner' ? '#92400e' : '#1d4ed8',
                      }}>
                        {log.actor_name}
                      </span>
                      {ACTION_LABEL[log.action] && (
                        <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                          {ACTION_LABEL[log.action]}
                        </span>
                      )}
                      <span style={{ fontSize: '10px', color: '#cbd5e1' }}>
                        {formatFull(log.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
