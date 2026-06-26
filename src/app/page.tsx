import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function LandingPage() {
  const admin = createAdminClient()
  const { data: shop } = await admin
    .from('shop_settings')
    .select('shop_name, logo_url')
    .limit(1)
    .maybeSingle()

  const logoUrl = shop?.logo_url ?? null
  const shopName = shop?.shop_name ?? 'Kuma Bikes'

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
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={shopName}
            style={{
              width: '140px',
              height: '140px',
              objectFit: 'contain',
              borderRadius: '24px',
              marginBottom: '20px',
            }}
          />
        ) : (
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🛵</div>
        )}
        <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px' }}>{shopName}</h1>
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
