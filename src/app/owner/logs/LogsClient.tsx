'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

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
  bike_deleted:    'ลบรถ',
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

type Log = {
  id: string
  created_at: string
  actor_type: string
  actor_name: string
  action: string
  description: string
}

export default function LogsClient({ logs, from, to, total }: {
  logs: Log[]
  from: string
  to: string
  total: number
}) {
  const router = useRouter()
  const [dateFrom, setDateFrom] = useState(from)
  const [dateTo, setDateTo] = useState(to)

  const applyFilter = () => {
    const params = new URLSearchParams()
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)
    router.push(`/owner/logs?${params.toString()}`)
  }

  const clearFilter = () => {
    setDateFrom('')
    setDateTo('')
    router.push('/owner/logs')
  }

  const hasFilter = from || to

  // Group by date
  const groups: Record<string, Log[]> = {}
  for (const log of logs) {
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
          <div className="sub">
            {hasFilter ? `กรอง • ${total} รายการ` : `ย้อนหลัง 90 วัน • ${total} รายการ`}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ background: '#fff', padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '130px' }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>ตั้งแต่วันที่</div>
          <input
            type="date" value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: '130px' }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>ถึงวันที่</div>
          <input
            type="date" value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}
          />
        </div>
        <button onClick={applyFilter} style={{
          padding: '8px 16px', background: '#1d4ed8', color: '#fff',
          border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
        }}>ค้นหา</button>
        {hasFilter && (
          <button onClick={clearFilter} style={{
            padding: '8px 12px', background: '#f3f4f6', color: '#374151',
            border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
          }}>ล้าง</button>
        )}
      </div>

      <div style={{ paddingBottom: '80px' }}>
        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', fontSize: '14px' }}>
            ไม่มีรายการในช่วงวันที่นี้
          </div>
        ) : (
          Object.entries(groups).map(([date, entries]) => (
            <div key={date}>
              <div style={{
                padding: '10px 16px 6px', fontSize: '12px', fontWeight: 700,
                color: '#6b7280', letterSpacing: '0.5px',
                background: '#f1f5f9', borderBottom: '1px solid #e2e8f0',
              }}>
                {date}
              </div>
              {entries.map(log => (
                <div key={log.id} style={{
                  display: 'flex', gap: '12px', padding: '12px 16px',
                  borderBottom: '1px solid #f1f5f9', background: '#fff',
                }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: log.actor_type === 'system' ? '#f1f5f9'
                      : log.actor_type === 'owner' ? '#fef3c7' : '#eff6ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', flexShrink: 0,
                  }}>
                    {ACTOR_ICON[log.actor_type] ?? '❓'}
                  </div>
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
                        fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '10px',
                        background: log.actor_type === 'system' ? '#f1f5f9'
                          : log.actor_type === 'owner' ? '#fef3c7' : '#eff6ff',
                        color: log.actor_type === 'system' ? '#6b7280'
                          : log.actor_type === 'owner' ? '#92400e' : '#1d4ed8',
                      }}>
                        {log.actor_name}
                      </span>
                      {ACTION_LABEL[log.action] && (
                        <span style={{ fontSize: '10px', color: '#9ca3af' }}>{ACTION_LABEL[log.action]}</span>
                      )}
                      <span style={{ fontSize: '10px', color: '#cbd5e1' }}>{formatFull(log.created_at)}</span>
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
