'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  current: string
  currentFrom?: string
  currentTo?: string
  basePath?: string
}

export function PeriodSelector({ current, currentFrom, currentTo, basePath = '/owner/dashboard' }: Props) {
  const router = useRouter()
  const [showCustom, setShowCustom] = useState(current === 'custom')
  const [from, setFrom] = useState(currentFrom ?? '')
  const [to, setTo] = useState(currentTo ?? '')

  const handleSelect = (val: string) => {
    if (val === 'custom') {
      setShowCustom(true)
      return
    }
    setShowCustom(false)
    router.push(`${basePath}?period=${val}`)
  }

  const applyCustom = () => {
    if (!from || !to) return
    router.push(`${basePath}?period=custom&from=${from}&to=${to}`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
      <select
        value={showCustom ? 'custom' : current}
        onChange={e => handleSelect(e.target.value)}
        style={{
          background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff',
          borderRadius: '8px', padding: '6px 10px', fontSize: '13px', fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <option value="month"  style={{ color: '#111' }}>เดือนนี้</option>
        <option value="week"   style={{ color: '#111' }}>สัปดาห์นี้</option>
        <option value="today"  style={{ color: '#111' }}>วันนี้</option>
        <option value="custom" style={{ color: '#111' }}>กำหนดเอง...</option>
      </select>

      {showCustom && (
        <div style={{
          background: 'rgba(255,255,255,.15)', borderRadius: '10px',
          padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px',
          minWidth: '200px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#fff', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>จาก</span>
            <input
              type="date" value={from} onChange={e => setFrom(e.target.value)}
              style={{
                flex: 1, background: 'rgba(255,255,255,.9)', border: 'none',
                borderRadius: '6px', padding: '4px 8px', fontSize: '12px', color: '#111',
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#fff', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>ถึง</span>
            <input
              type="date" value={to} onChange={e => setTo(e.target.value)}
              style={{
                flex: 1, background: 'rgba(255,255,255,.9)', border: 'none',
                borderRadius: '6px', padding: '4px 8px', fontSize: '12px', color: '#111',
              }}
            />
          </div>
          <button
            onClick={applyCustom}
            disabled={!from || !to}
            style={{
              background: from && to ? '#fff' : 'rgba(255,255,255,.3)',
              color: from && to ? '#111827' : 'rgba(255,255,255,.5)',
              border: 'none', borderRadius: '6px', padding: '6px',
              fontSize: '12px', fontWeight: 700, cursor: from && to ? 'pointer' : 'default',
            }}
          >
            ดูข้อมูล →
          </button>
        </div>
      )}
    </div>
  )
}
