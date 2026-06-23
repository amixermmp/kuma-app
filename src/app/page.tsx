import Link from 'next/link'

export default function LandingPage() {
  return (
    <div
      className="app-wrap"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#1e1b4b,#312e81)',
      }}
    >
      <div style={{ textAlign: 'center', color: '#fff', padding: '40px 24px' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🛵</div>
        <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px' }}>Kuma Bikes</h1>
        <p style={{ fontSize: '15px', opacity: 0.7, margin: '0 0 48px' }}>
          ระบบบริหารจัดการมอเตอร์ไซค์ให้เช่า
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '260px', margin: '0 auto' }}>
          <Link
            href="/staff/login"
            className="btn"
            style={{
              background: '#fff',
              color: '#312e81',
              fontSize: '15px',
              textDecoration: 'none',
            }}
          >
            👤 Staff Login
          </Link>
          <Link
            href="/owner/login"
            className="btn"
            style={{
              background: 'rgba(255,255,255,.15)',
              color: '#fff',
              fontSize: '15px',
              textDecoration: 'none',
              border: '1px solid rgba(255,255,255,.3)',
            }}
          >
            👑 Owner Login
          </Link>
        </div>
      </div>
    </div>
  )
}
