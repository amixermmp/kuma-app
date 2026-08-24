import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBikeCatalog } from '@/lib/bikeCatalog'
import Link from 'next/link'
import PricingClient from './PricingClient'

export const dynamic = 'force-dynamic'

export default async function BranchPricingPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()
  const { branch } = await searchParams

  const [{ data: branches }, { brands, models }] = await Promise.all([
    admin.from('branches').select('id, name').order('name'),
    getBikeCatalog(),
  ])

  const branchList = branches ?? []
  const selectedBranchId = branch || branchList[0]?.id || ''

  const { data: pricingRows } = selectedBranchId
    ? await admin.from('branch_model_pricing').select('brand, model, daily_rate, monthly_rate, promo_pay_days').eq('branch_id', selectedBranchId)
    : { data: [] }

  const pricingByKey = Object.fromEntries(
    (pricingRows ?? []).map(p => [`${p.brand}__${p.model}`, { dailyRate: p.daily_rate, monthlyRate: p.monthly_rate, promoPayDays: p.promo_pay_days }])
  )

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: '#111827' }}>
        <Link href="/owner/bikes/catalog" className="app-header-back">←</Link>
        <div style={{ flex: 1 }}>
          <h1>ราคาต่อสาขา</h1>
          <div className="sub">ตั้งราคารายวัน/รายเดือน/โปร แยกตามสาขา — ใช้ auto-fill ตอนย้ายรถ</div>
        </div>
      </div>
      <PricingClient
        branches={branchList}
        selectedBranchId={selectedBranchId}
        brands={brands}
        models={models}
        pricingByKey={pricingByKey}
      />
    </div>
  )
}
