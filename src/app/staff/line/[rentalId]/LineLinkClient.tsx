'use client'

import { useEffect, useState } from 'react'

// statusQuery: 'rentalId=<id>' (รายวัน) หรือ 'monthlyId=<id>' (รายเดือน)
export default function LineLinkClient({
  statusQuery,
  initialLinked,
}: {
  statusQuery: string
  initialLinked: boolean
}) {
  const [linked, setLinked] = useState(initialLinked)

  useEffect(() => {
    if (linked) return
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/staff/line/status?${statusQuery}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.linked) setLinked(true)
      } catch { /* เน็ตสะดุด — รอบหน้าลองใหม่ */ }
    }, 3000)
    return () => clearInterval(timer)
  }, [linked, statusQuery])

  if (!linked) {
    return (
      <div style={{
        background: '#fffbeb', border: '1px solid #fde68a',
        borderRadius: '12px', padding: '12px 16px',
        fontSize: '13px', color: '#92400e', fontWeight: 600,
      }}>
        ⏳ รอลูกค้าสแกน... (สถานะจะอัพเดทอัตโนมัติ)
      </div>
    )
  }

  return (
    <div style={{
      background: '#f0fdf4', border: '1px solid #bbf7d0',
      borderRadius: '12px', padding: '12px 16px',
      fontSize: '14px', color: '#15803d', fontWeight: 700,
    }}>
      ✅ ผูกไลน์เรียบร้อยแล้ว!
    </div>
  )
}
