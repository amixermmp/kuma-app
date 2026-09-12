'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'

type Reminder = {
  type: 'send' | 'return'
  id: string
  ref: string
  customerName: string
  address: string | null
  time: string
  bikeLabel: string
}

const POLL_MS = 30_000

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function OffsiteReminderWatcher() {
  const pathname = usePathname()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [acking, setAcking] = useState(false)

  const suppressed = pathname?.startsWith('/staff/send/') ?? false

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/staff/offsite-reminders')
      if (!res.ok) { setReminders([]); return }
      const data = await res.json()
      setReminders(data.reminders ?? [])
    } catch {
      // เงียบไว้ — เน็ตมีปัญหาชั่วคราวไม่ควรทำหน้าเว็บพัง
    }
  }, [])

  useEffect(() => {
    poll()
    const interval = setInterval(poll, POLL_MS)
    return () => clearInterval(interval)
  }, [poll])

  if (suppressed || reminders.length === 0) return null

  const current = reminders[0]
  const isSend = current.type === 'send'

  const acknowledge = async () => {
    setAcking(true)
    try {
      await fetch('/api/staff/offsite-reminders/ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: current.type, id: current.id }),
      })
    } catch {
      // ถ้ายิงไม่สำเร็จ รอบ poll ถัดไปจะขึ้นซ้ำเอง ไม่ต้องพัง
    }
    setReminders(prev => prev.slice(1))
    setAcking(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 5000,
      background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', maxWidth: '380px', width: '100%',
        padding: '24px 20px', textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,.3)',
      }}>
        {reminders.length > 1 && (
          <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 700, marginBottom: '4px' }}>
            {reminders.length} รายการรอรับทราบ
          </div>
        )}
        <div style={{ fontSize: '40px', marginBottom: '8px' }}>{isSend ? '🛵' : '📦'}</div>
        <div style={{ fontSize: '17px', fontWeight: 800, color: '#111827', marginBottom: '4px' }}>
          {isSend ? 'ใกล้ถึงคิวส่งนอกสถานที่' : 'ใกล้ถึงเวลารับคืนนอกสถานที่'}
        </div>
        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
          เวลา {fmtTime(current.time)} น. — {isSend ? 'ต้องนำรถไปส่งลูกค้า' : 'ต้องไปรับรถคืนจากลูกค้า'}
        </div>

        <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '12px 14px', textAlign: 'left', marginBottom: '18px', fontSize: '13px' }}>
          <div style={{ marginBottom: '6px' }}><strong>{current.customerName}</strong></div>
          {current.bikeLabel && <div style={{ color: '#374151', marginBottom: '6px' }}>🏍️ {current.bikeLabel}</div>}
          {current.address && <div style={{ color: '#374151' }}>📍 {current.address}</div>}
        </div>

        <button
          onClick={acknowledge}
          disabled={acking}
          style={{
            width: '100%', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '10px',
            padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', opacity: acking ? .7 : 1,
          }}
        >
          {acking ? '⏳...' : '✅ รับทราบแล้ว'}
        </button>
      </div>
    </div>
  )
}
