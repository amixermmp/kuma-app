'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', icon: '🏠', label: 'หน้าหลัก' },
  { href: '/bikes', icon: '🏍️', label: 'รถ' },
  { href: '/rentals', icon: '📋', label: 'การเช่า' },
  { href: '/customers', icon: '👥', label: 'ลูกค้า' },
  { href: '/more', icon: '☰', label: 'เพิ่มเติม' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: '#fff',
      borderTop: '1px solid #e5e7eb',
      display: 'flex',
      paddingBottom: 'env(safe-area-inset-bottom)',
      zIndex: 50,
    }}>
      {navItems.map(item => {
        const active = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              padding: '8px 4px',
              textDecoration: 'none',
              color: active ? '#2563eb' : '#9ca3af',
            }}
          >
            <span style={{ fontSize: '22px', lineHeight: 1 }}>{item.icon}</span>
            <span style={{ fontSize: '10px', fontWeight: active ? 700 : 400 }}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
