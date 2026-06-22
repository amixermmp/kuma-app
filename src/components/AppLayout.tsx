import BottomNav from './BottomNav'

interface AppLayoutProps {
  children: React.ReactNode
  title?: string
  action?: React.ReactNode
}

export default function AppLayout({ children, title, action }: AppLayoutProps) {
  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', paddingBottom: '64px' }}>
      {title && (
        <header style={{
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700 }}>{title}</h1>
          {action && <div>{action}</div>}
        </header>
      )}
      <main style={{ padding: '16px' }}>
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
