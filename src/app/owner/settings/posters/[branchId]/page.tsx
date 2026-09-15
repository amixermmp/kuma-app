import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBikeCatalog } from '@/lib/bikeCatalog'
import BranchPostersClient from './BranchPostersClient'

export const dynamic = 'force-dynamic'

export default async function BranchPostersPage({ params }: { params: Promise<{ branchId: string }> }) {
  const { branchId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()

  const [{ data: branch }, catalog, { data: posters }] = await Promise.all([
    admin.from('branches').select('id, name').eq('id', branchId).maybeSingle(),
    // ใช้คลังรุ่นทั้งร้าน ไม่ใช่แค่รถที่มีอยู่ตอนนี้ที่สาขานี้ — กันกรณีย้ายรถจากสาขาอื่นมาในอนาคตแล้วรุ่นนั้นไม่มีให้เลือก
    getBikeCatalog(),
    admin.from('availability_posters').select('id, branch_id, image_url, out_of_stock_models').eq('branch_id', branchId).order('created_at'),
  ])

  if (!branch) notFound()

  const models = Array.from(new Set(catalog.models.map(m => `${m.brand}||${m.name}`))).sort()

  return (
    <div className="app-wrap">
      <BranchPostersClient branch={branch} models={models} posters={posters ?? []} />
    </div>
  )
}
