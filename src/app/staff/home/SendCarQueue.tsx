'use client'

import { useMemo, useState } from 'react'
import { JobCard, fmtDate, fmtTime, hoursUntil, isTodayBkk } from '@/components/staff/JobCard'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function SendCarQueue({ jobs }: { jobs: any[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = !q ? jobs : jobs.filter((b: any) =>
      (b.customer_name ?? '').toLowerCase().includes(q) ||
      (b.customer_phone ?? '').toLowerCase().includes(q)
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return [...list].sort((a: any, b: any) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime())
  }, [jobs, query])

  if (jobs.length === 0) return null

  return (
    <div style={{ marginTop: '20px' }}>
      <div style={{ color: '#6b7280', fontSize: '13px', fontWeight: 600, paddingBottom: '10px' }}>
        ส่งรถคิวจอง
      </div>

      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="🔍 ค้นหาชื่อ หรือเบอร์โทรลูกค้า"
        style={{
          width: '100%', boxSizing: 'border-box', padding: '12px 14px', marginBottom: '12px',
          borderRadius: '12px', border: '1.5px solid #e5e7eb', fontSize: '14px',
          fontFamily: 'inherit', background: '#fff',
        }}
      />

      {filtered.length === 0 && (
        <div style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>
          ไม่พบคิวจองที่ตรงกับ &quot;{query}&quot;
        </div>
      )}

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {filtered.map((b: any) => {
        const bike = b.bikes
        const hrs = hoursUntil(b.start_datetime)
        const overdue = hrs < 0
        const today = isTodayBkk(b.start_datetime)
        const bikeLabel = bike
          ? `${bike.license_plate} ${bike.brand} ${bike.model}`
          : `${b.requested_brand ?? ''} ${b.requested_model ?? ''} (ยังไม่ได้กำหนดรถ)`
        const badge = overdue
          ? `⚠️ เลยเวลา ${Math.abs(hrs)} ชม.`
          : today ? (hrs === 0 ? '🔔 ถึงเวลาแล้ว!' : `⏰ อีก ${hrs} ชม.`)
          : `📅 ${fmtDate(b.start_datetime)}`
        const reassignNote = b.original_requested_brand && b.original_requested_model &&
          (b.original_requested_brand !== b.requested_brand || b.original_requested_model !== b.requested_model)
          ? `⚠️ รุ่นเดิม: ${b.original_requested_brand} ${b.original_requested_model} → เปลี่ยนเป็น: ${b.requested_brand} ${b.requested_model}${b.reassign_reason ? ` (${b.reassign_reason})` : ''}`
          : undefined
        return (
          <JobCard
            key={b.id}
            dotColor={overdue ? '#dc2626' : today ? '#111827' : '#9ca3af'}
            photoUrl={bike?.photo_url} bikeColor={bike?.color}
            title={`ส่งรถ — ${bikeLabel}`}
            badge={badge}
            badgeBg={overdue ? '#fef2f2' : today ? '#f1f5f9' : '#f1f5f9'}
            badgeColor={overdue ? '#dc2626' : today ? '#111827' : '#374151'}
            meta1={`👤 ${b.customer_name}${b.customer_phone ? ` • ${b.customer_phone}` : ''}`}
            meta2={`📅 รับรถ ${fmtDate(b.start_datetime)} ${fmtTime(b.start_datetime)} น. • ${b.total_days} วัน`}
            meta3={b.delivery_type === 'offsite' ? `🛵 ส่งนอกสถานที่ — ${b.delivery_address || 'ไม่ระบุที่อยู่'}` : undefined}
            meta4={reassignNote}
            href={`/staff/assign/${b.id}`} btnColor="#111827"
            cardHref={bike?.id ? `/staff/bikes/${bike.id}/menu` : undefined}
          />
        )
      })}
    </div>
  )
}
