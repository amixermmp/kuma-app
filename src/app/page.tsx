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
        minHeight: '100vh',
        background: '#111827',
      }}
    >
      {/* Top section — logo + brand */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 32px 32px',
        textAlign: 'center',
      }}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={shopName}
            style={{
              width: '96px',
              height: '96px',
              objectFit: 'contain',
              borderRadius: '22px',
              marginBottom: '20px',
              border: '2px solid rgba(255,255,255,.1)',
            }}
          />
        ) : (
          <div style={{
            width: '88px',
            height: '88px',
            background: '#e11d48',
            borderRadius: '22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '42px',
            marginBottom: '20px',
          }}>
            🛵
          </div>
        )}

        <h1 style={{
          fontSize: '26px',
          fontWeight: 900,
          color: '#fff',
          margin: '0 0 4px',
          letterSpacing: '1px',
        }}>
          {shopName.toUpperCase()}
        </h1>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,.4)', margin: 0, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
          Rental Management System
        </p>

        {/* Divider */}
        <div style={{ width: '32px', height: '3px', background: '#e11d48', borderRadius: '2px', margin: '28px auto 0' }} />
      </div>

      {/* Bottom section — buttons */}
      <div style={{ padding: '0 24px 48px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Link
          href="/staff/login"
          style={{
            display: 'block',
            padding: '16px',
            background: '#e11d48',
            borderRadius: '12px',
            textAlign: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: '15px',
            textDecoration: 'none',
            letterSpacing: '.3px',
          }}
        >
          Staff Login
        </Link>
        <Link
          href="/owner/login"
          style={{
            display: 'block',
            padding: '16px',
            background: 'transparent',
            borderRadius: '12px',
            textAlign: 'center',
            color: 'rgba(255,255,255,.65)',
            fontWeight: 600,
            fontSize: '15px',
            textDecoration: 'none',
            border: '1.5px solid rgba(255,255,255,.15)',
            letterSpacing: '.3px',
          }}
        >
          Owner Login
        </Link>
        <p style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,.2)', margin: '8px 0 0' }}>
          © 2025 {shopName}
        </p>
      </div>
    </div>
  )
}
