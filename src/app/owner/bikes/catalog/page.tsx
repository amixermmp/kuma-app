import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBikeCatalog } from '@/lib/bikeCatalog'
import Link from 'next/link'
import CatalogClient from './CatalogClient'

export const dynamic = 'force-dynamic'

export default async function BikeCatalogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const { brands, models } = await getBikeCatalog()

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: '#111827' }}>
        <Link href="/owner/bikes" className="app-header-back">←</Link>
        <div style={{ flex: 1 }}>
          <h1>ยี่ห้อ &amp; รุ่นรถ</h1>
          <div className="sub">จัดการตัวเลือกสำหรับหน้าเพิ่มรถ</div>
        </div>
      </div>
      <CatalogClient brands={brands} models={models} />
    </div>
  )
}
