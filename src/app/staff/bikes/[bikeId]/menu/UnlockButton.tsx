'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UnlockButton({ bikeId }: { bikeId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleUnlock = async () => {
    if (!confirm('ปลดล็อครถคันนี้กลับเป็นสถานะว่าง?')) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/staff/bikes/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bikeId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: '#fff7ed', border: '2px solid #f59e0b', borderRadius: '14px', padding: '14px 16px',
    }}>
      <div style={{ fontSize: '13px', color: '#92400e', marginBottom: '10px' }}>
        🔒 รถถูกล็อคไว้แต่<strong>ไม่มีสัญญาเช่าค้างอยู่</strong> (เช่น ล็อครอสลับแล้วไม่ได้ใช้) — ปลดล็อคเพื่อให้กลับมาปล่อยเช่าได้
      </div>
      {error && <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '8px' }}>⚠️ {error}</div>}
      <button onClick={handleUnlock} disabled={loading} style={{
        width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
        background: '#f59e0b', color: '#fff', fontWeight: 700, fontSize: '14px',
        cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1,
      }}>
        {loading ? '⏳ กำลังปลดล็อค...' : '🔓 ปลดล็อครถ — กลับเป็นสถานะว่าง'}
      </button>
    </div>
  )
}
