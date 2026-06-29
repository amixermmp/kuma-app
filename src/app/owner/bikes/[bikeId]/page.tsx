import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import BikeDetailClient from './BikeDetailClient'

export const dynamic = 'force-dynamic'

export default async function BikeDetailPage({ params }: { params: Promise<{ bikeId: string }> }) {
  const { bikeId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()

  const [bikeRes, docsRes, branchesRes, statsRes, monthlyStatsRes, routinesRes, repairsRes] = await Promise.all([
    admin.from('bikes')
      .select('id, license_plate, brand, model, year, color, photo_url, daily_rate, monthly_rate, deposit_amount, odometer, notes, status, branch_id, branches(id, name)')
      .eq('id', bikeId)
      .single(),
    admin.from('bike_documents')
      .select('doc_type, doc_photo_url, expiry_date')
      .eq('bike_id', bikeId),
    admin.from('branches').select('id, name').order('name'),
    admin.from('rentals')
      .select('id, total_amount, start_datetime')
      .eq('bike_id', bikeId)
      .order('start_datetime', { ascending: false }),
    admin.from('monthly_payments')
      .select('amount, monthly_rentals!inner(bike_id)')
      .eq('monthly_rentals.bike_id', bikeId),
    admin.from('bike_routines')
      .select('id, task_name, interval_km, interval_days, last_done_date, last_done_km, next_due_km, next_due_date')
      .eq('bike_id', bikeId)
      .order('task_name'),
    admin.from('repairs')
      .select('id, title, description, status, created_at, resolved_at, repair_shop, repair_cost')
      .eq('bike_id', bikeId)
      .order('created_at', { ascending: false }),
  ])

  if (!bikeRes.data) notFound()

  const bike = bikeRes.data
  const docs = docsRes.data ?? []
  const branches = branchesRes.data ?? []
  const rentals = statsRes.data ?? []
  const monthlyPayments = monthlyStatsRes.data ?? []
  const routines = routinesRes.data ?? []
  const repairs = repairsRes.data ?? []

  const totalRevenueDays = rentals.reduce((s, r) => s + (r.total_amount ?? 0), 0)
  const totalRevenueMonthly = monthlyPayments.reduce((s, p) => s + Number(p.amount ?? 0), 0)
  const totalRevenue = totalRevenueDays + totalRevenueMonthly
  const rentalCount = rentals.length
  const lastRental = rentals[0]?.start_datetime ?? null

  const docMap = Object.fromEntries(docs.map(d => [d.doc_type, d]))
  const branch = Array.isArray(bike.branches) ? bike.branches[0] : bike.branches as { id: string; name: string } | null

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a8a)' }}>
        <Link href="/owner/bikes" className="app-header-back">←</Link>
        <div style={{ flex: 1 }}>
          <h1>{bike.license_plate}</h1>
          <div className="sub">{bike.brand} {bike.model}</div>
        </div>
      </div>

      <BikeDetailClient
        bike={{ ...bike, branch_id: bike.branch_id, branch_name: branch?.name ?? '—' }}
        docMap={docMap}
        branches={branches}
        stats={{ totalRevenue, rentalCount, lastRental }}
        routines={routines}
        repairs={repairs}
      />
    </div>
  )
}
