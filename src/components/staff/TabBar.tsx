'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getTabs, removeTab, listenTabs, StaffTab } from '@/lib/tabStore'

const TYPE_STYLE: Record<string, { bg: string; color: string; activeBg: string }> = {
  sendcar:  { bg: '#eff6ff', color: '#1d4ed8', activeBg: '#1d4ed8' },
  returncar:{ bg: '#fef2f2', color: '#dc2626', activeBg: '#dc2626' },
  rental:   { bg: '#f0fdf4', color: '#16a34a', activeBg: '#16a34a' },
  booking:  { bg: '#faf5ff', color: '#7c3aed', activeBg: '#7c3aed' },
}

export default function TabBar() {
  const [tabs, setTabs] = useState<StaffTab[]>([])
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    setTabs(getTabs())
    return listenTabs(() => setTabs(getTabs()))
  }, [])

  const isHome = pathname === '/staff/home'

  if (tabs.length === 0 && isHome) return null

  return (
    <div style={{
      background: '#fff',
      borderBottom: '1px solid #e5e7eb',
      padding: '6px 10px',
      display: 'flex',
      gap: '6px',
      alignItems: 'center',
      overflowX: 'auto',
      flexShrink: 0,
    }}>
      {/* Home tab — always visible */}
      <button
        onClick={() => router.push('/staff/home')}
        style={{
          flexShrink: 0,
          background: isHome ? '#1e40af' : '#eff6ff',
          color: isHome ? '#fff' : '#1d4ed8',
          border: 'none',
          borderRadius: '20px',
          padding: '4px 12px',
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
        }}
        aria-label="กลับหน้าหลัก"
      >
        🏠
      </button>

      {tabs.map(tab => {
        const isActive = pathname === tab.href
        const s = TYPE_STYLE[tab.type] ?? TYPE_STYLE.sendcar
        return (
          <div
            key={tab.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: isActive ? s.activeBg : s.bg,
              color: isActive ? '#fff' : s.color,
              borderRadius: '20px',
              padding: '4px 6px 4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              cursor: 'pointer',
            }}
          >
            <span onClick={() => router.push(tab.href)}>{tab.title}</span>
            <button
              onClick={() => removeTab(tab.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
                opacity: 0.7,
                fontSize: '11px',
                padding: '0 4px',
                lineHeight: 1,
              }}
              aria-label="ปิด tab"
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
