import { createAdminClient } from '@/lib/supabase/admin'
import LandingClient from './LandingClient'

export const dynamic = 'force-dynamic'

export default async function LandingPage() {
  const admin = createAdminClient()
  const { data: shop } = await admin
    .from('shop_settings')
    .select('shop_name, logo_url')
    .limit(1)
    .maybeSingle()

  return (
    <LandingClient
      shopName={shop?.shop_name ?? 'Kuma Bikes'}
      logoUrl={shop?.logo_url ?? null}
    />
  )
}
