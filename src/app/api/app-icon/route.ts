import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('shop_settings')
    .select('logo_url')
    .limit(1)
    .maybeSingle()

  if (!data?.logo_url) {
    return new Response(null, { status: 404 })
  }

  const imgRes = await fetch(data.logo_url)
  if (!imgRes.ok) return new Response(null, { status: 404 })

  const buffer = await imgRes.arrayBuffer()
  const contentType = imgRes.headers.get('content-type') ?? 'image/png'

  return new Response(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
