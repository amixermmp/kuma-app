import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import BikeListClient from './BikeListClient'

export const dynamic = 'force-dynamic'

export type OwnerBike = {
  id: string
  license_plate: string
  brand: string
  model: string
  year: number | null
  color: string | null
  status: string
  daily_rate: number
  odometer: number
  notes: string | null
  branch_id: string
  branch_name: string
  return_date: string | null
  customer_name: string | null
  days_until_tax: number | null
  days_until_pob: number | null
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default async function OwnerBikesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()

  const [bikesRes, activeBookingsRes, branchesRes] = await Promise.all([
    admin.from('bikes')
      .select('id, license_plate, brand, model, year, color, status, daily_rate, odometer, notes, docs, branch_id, branches(name)')
      .order('license_plate'),
    admin.from('bookings')
      .select('bike_id, end_datetime, customer_name')
      .eq('status', 'active'),
    admin.from('branches').select('id, name').order('name'),
  ])

  const activeMap: Record<string, { end_datetime: string; customer_name: string }> = {}
  for (const b of activeBookingsRes.data ?? []) {
    if (b.bike_id) activeMap[b.bike_id] = { end_datetime: b.end_datetime, customer_name: b.customer_name }
  }

  const bikes: OwnerBike[] = (bikesRes.data ?? []).map(b => {
    const branch = Array.isArray(b.branches) ? b.branches[0] : b.branches as { name: string } | null
    const active = activeMap[b.id]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docs = b.docs as any
    return {
      id: b.id,
      license_plate: b.license_plate,
      brand: b.brand,
      model: b.model,
      year: b.year,
      color: b.color,
      status: b.status,
      daily_rate: b.daily_rate,
      odometer: b.odometer,
      notes: b.notes,
      branch_id: b.branch_id,
      branch_name: branch?.name ?? '—',
      return_date: active?.end_datetime ?? null,
      customer_name: active?.customer_name ?? null,
      days_until_tax: daysUntil(docs?.tax?.expiry_date),
      days_until_pob: daysUntil(docs?.pob?.expiry_date),
    }
  })

  const branches = branchesRes.data ?? []

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a8a)' }}>
        <Link href="/owner/dashboard" className="app-header-back">←</Link>
        <div style={{ flex: 1 }}>
          <h1>สต็อครถทั้งหมด</h1>
          <div className="sub">{bikes.length} คัน • {branches.length} สาขา</div>
        </div>
        <Link href="/owner/bikes/add" style={{
          background: 'rgba(255,255,255,.15)', borderRadius: '8px',
          color: '#fff', fontSize: '13px', fontWeight: 700,
          padding: '6px 12px', textDecoration: 'none',
        }}>+ เพิ่มรถ</Link>
      </div>

      <BikeListClient bikes={bikes} branches={branches} />
    </div>
  )
}
