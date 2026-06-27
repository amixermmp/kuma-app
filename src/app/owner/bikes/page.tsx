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
  last_oil_date: string | null
  last_gear_date: string | null
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

  const [bikesRes, docsRes, branchesRes, routinesRes] = await Promise.all([
    admin.from('bikes')
      .select('id, license_plate, brand, model, year, color, status, daily_rate, odometer, notes, branch_id, branches(name)')
      .order('license_plate'),
    admin.from('bike_documents')
      .select('bike_id, doc_type, expiry_date')
      .in('doc_type', ['tax', 'pob']),
    admin.from('branches').select('id, name').order('name'),
    admin.from('bike_routines')
      .select('bike_id, task_name, last_done_date')
      .in('task_name', ['เปลี่ยนน้ำมันเครื่อง', 'เปลี่ยนน้ำมันเฟืองท้าย'])
      .not('last_done_date', 'is', null),
  ])

  // Map expiry dates per bike
  const docExpiryMap: Record<string, { tax?: string | null; pob?: string | null }> = {}
  for (const d of docsRes.data ?? []) {
    if (!docExpiryMap[d.bike_id]) docExpiryMap[d.bike_id] = {}
    if (d.doc_type === 'tax') docExpiryMap[d.bike_id].tax = d.expiry_date
    if (d.doc_type === 'pob') docExpiryMap[d.bike_id].pob = d.expiry_date
  }

  // Map last routine dates per bike
  const routineMap: Record<string, { oil?: string | null; gear?: string | null }> = {}
  for (const r of routinesRes.data ?? []) {
    if (!routineMap[r.bike_id]) routineMap[r.bike_id] = {}
    if (r.task_name === 'เปลี่ยนน้ำมันเครื่อง') routineMap[r.bike_id].oil = r.last_done_date
    if (r.task_name === 'เปลี่ยนน้ำมันเฟืองท้าย') routineMap[r.bike_id].gear = r.last_done_date
  }

  const bikes: OwnerBike[] = (bikesRes.data ?? []).map(b => {
    const branch = Array.isArray(b.branches) ? b.branches[0] : b.branches as { name: string } | null
    const expiry = docExpiryMap[b.id] ?? {}
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
      return_date: null,
      customer_name: null,
      days_until_tax: daysUntil(expiry.tax),
      days_until_pob: daysUntil(expiry.pob),
      last_oil_date: routineMap[b.id]?.oil ?? null,
      last_gear_date: routineMap[b.id]?.gear ?? null,
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
