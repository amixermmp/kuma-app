import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBikeCatalog } from '@/lib/bikeCatalog'
import PosterSetupClient from './PosterSetupClient'

export const dynamic = 'force-dynamic'

export default async function PosterSetupBranchPage({ params }: { params: Promise<{ branchId: string }> }) {
  const { branchId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()

  const [{ data: branch }, { data: branchSettings }, catalog, { data: hotspots }] = await Promise.all([
    admin.from('branches').select('id, name').eq('id', branchId).maybeSingle(),
    admin.from('branch_settings').select('poster_template_url, poster_x_mark_url').eq('branch_id', branchId).maybeSingle(),
    getBikeCatalog(),
    admin.from('poster_hotspots').select('id, x_pct, y_pct, width_pct, height_pct, poster_hotspot_models(brand, model)').eq('branch_id', branchId).order('created_at'),
  ])

  if (!branch) notFound()

  return (
    <div className="app-wrap">
      <PosterSetupClient
        branch={branch}
        templateUrl={branchSettings?.poster_template_url ?? null}
        xMarkUrl={branchSettings?.poster_x_mark_url ?? null}
        models={catalog.models}
        hotspots={(hotspots ?? []).map(h => ({
          id: h.id, x_pct: h.x_pct, y_pct: h.y_pct, width_pct: h.width_pct, height_pct: h.height_pct,
          models: h.poster_hotspot_models,
        }))}
      />
    </div>
  )
}
