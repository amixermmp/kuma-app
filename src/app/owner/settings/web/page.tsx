import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import WebSettingsClient, { type ZoneRow, type ModelRow } from './WebSettingsClient'

export const dynamic = 'force-dynamic'

export default async function WebSettingsPage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()
  const { data: branchRows } = await admin.from('branches').select('id, name').order('name')
  const branches = branchRows ?? []

  const { branch: wanted } = await searchParams
  const branch =
    branches.find(b => b.id === wanted) ??
    branches.find(b => /zame/i.test(b.name) && /ศรีราชา|sriracha/i.test(b.name)) ??
    branches[0]
  if (!branch) redirect('/owner/settings')

  const [zonesRes, bikesRes, pricingRes, webRes, settingsRes] = await Promise.all([
    admin.from('delivery_zones')
      .select('id, name_th, name_en, name_ja, name_zh, short_fee, long_fee, sort_order, active')
      .eq('branch_id', branch.id).order('sort_order').order('created_at'),
    admin.from('bikes').select('brand, model, photo_url, status').eq('branch_id', branch.id),
    admin.from('branch_model_pricing').select('brand, model, daily_rate, monthly_rate').eq('branch_id', branch.id),
    admin.from('web_model_settings').select('brand, model, visible, photo_url, sort_order').eq('branch_id', branch.id),
    admin.from('branch_settings').select('line_id').eq('branch_id', branch.id).maybeSingle(),
  ])

  const zones: ZoneRow[] = (zonesRes.data ?? []).map(z => ({
    id: z.id, name_th: z.name_th, name_en: z.name_en, name_ja: z.name_ja ?? '', name_zh: z.name_zh ?? '',
    short_fee: z.short_fee == null ? '' : String(Number(z.short_fee)),
    long_fee: z.long_fee == null ? '' : String(Number(z.long_fee)),
    sort_order: z.sort_order, active: z.active,
  }))

  const key = (b: string, m: string) => `${b}__${m}`
  const pricing = new Map((pricingRes.data ?? []).map(p => [key(p.brand, p.model), p]))
  const web = new Map((webRes.data ?? []).map(w => [key(w.brand, w.model), w]))
  const grouped = new Map<string, ModelRow>()
  for (const b of bikesRes.data ?? []) {
    if (b.status === 'retired' || b.status === 'inactive') continue
    const k = key(b.brand, b.model)
    const cur = grouped.get(k)
    if (cur) { cur.bikeCount++; if (!cur.fallbackPhoto && b.photo_url) cur.fallbackPhoto = b.photo_url; continue }
    const p = pricing.get(k)
    const w = web.get(k)
    grouped.set(k, {
      brand: b.brand, model: b.model, bikeCount: 1,
      dailyRate: p?.daily_rate == null ? null : Number(p.daily_rate),
      monthlyRate: p?.monthly_rate == null ? null : Number(p.monthly_rate),
      visible: w ? w.visible : true,
      photoUrl: w?.photo_url ?? null,
      fallbackPhoto: b.photo_url ?? null,
      sortOrder: w?.sort_order ?? 0,
    })
  }
  const models = Array.from(grouped.values()).sort((a, b) => a.sortOrder - b.sortOrder || `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`))

  return (
    <div className="app-wrap">
      <WebSettingsClient
        branches={branches}
        branchId={branch.id}
        lineId={settingsRes.data?.line_id ?? null}
        zones={zones}
        models={models}
      />
    </div>
  )
}
