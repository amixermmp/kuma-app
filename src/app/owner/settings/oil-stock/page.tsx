import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import OilStockClient from './OilStockClient'

export const dynamic = 'force-dynamic'

export default async function OilStockSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()

  const [{ data: branches }, { data: stock }] = await Promise.all([
    admin.from('branches').select('id, name').order('name'),
    admin.from('branch_oil_stock').select('branch_id, oil_type, quantity, low_stock_threshold'),
  ])

  const stockMap = new Map(
    (stock ?? []).map(s => [`${s.branch_id}__${s.oil_type}`, s])
  )

  const branchRows = (branches ?? []).map(b => ({
    id: b.id,
    name: b.name,
    engine: stockMap.get(`${b.id}__engine`) ?? { quantity: 0, low_stock_threshold: 10 },
    gear: stockMap.get(`${b.id}__gear`) ?? { quantity: 0, low_stock_threshold: 10 },
  }))

  return (
    <div className="app-wrap">
      <OilStockClient branches={branchRows} />
    </div>
  )
}
