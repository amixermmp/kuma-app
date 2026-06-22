import BottomNav from './BottomNav'
import Link from 'next/link'

interface AppLayoutProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  action?: React.ReactNode
  backHref?: string
  headerStyle?: 'blue' | 'purple' | 'dark' | 'plain'
  noPadding?: boolean
}

const headerGradients = {
  blue:   'linear-gradient(135deg, #1d4ed8, #2563eb)',
  purple: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
  dark:   'linear-gradient(160deg, #0f172a, #1e3a8a)',
  plain:  '#fff',
}

export default function AppLayout({
  children,
  title,
  subtitle,
  action,
  backHref,
  headerStyle = 'blue',
  noPadding = false,
}: AppLayoutProps) {
  const isPlain = headerStyle === 'plain'
  const bg = headerGradients[headerStyle]
  const textColor = isPlain ? '#111827' : '#fff'

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', paddingBottom: '72px' }}>
      {title && (
        <header style={{
          background: bg,
          borderBottom: isPlain ? '1px solid #e5e7eb' : 'none',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}>
          {backHref && (
            <Link href={backHref} style={{
              width: '32px', height: '32px',
              borderRadius: '50%',
              background: isPlain ? '#f3f4f6' : 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: textColor,
              textDecoration: 'none',
              fontSize: '18px',
              flexShrink: 0,
            }}>{`←`}</Link>
          )}
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '17px', fontWeight: 700, color: textColor, margin: 0 }}>{title}</h1>
            {subtitle && <p style={{ fontSize: '12px', color: isPlain ? '#6b7280' : 'rgba(255,255,255,0.8)', margin: 0, marginTop: '2px' }}>{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </header>
      )}
      <main style={{ padding: noPadding ? 0 : '0' }}>
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
