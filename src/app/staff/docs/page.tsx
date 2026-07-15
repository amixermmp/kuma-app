import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import DocsClient from './DocsClient'
import BikeSelectClient from '@/components/staff/BikeSelectClient'

export const dynamic = 'force-dynamic'

export type DocItem = {
  id: string
  bike_id: string
  doc_type: string
  expiry_date: string | null
  doc_photo_url: string | null
  notes: string | null
  bikes: { license_plate: string; brand: string; model: string }
  urgency: 'overdue' | 'critical' | 'warning' | 'ok'
  days: number
}

function calcUrgency(expiry: string | null): { urgency: DocItem['urgency']; days: number } {
  if (!expiry) return { urgency: 'overdue', days: -999 }
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return { urgency: 'overdue', days }
  if (days <= 8) return { urgency: 'critical', days }
  if (days <= 30) return { urgency: 'warning', days }
  return { urgency: 'ok', days }
}

export default async function DocsPage({
  searchParams,
}: {
  searchParams: Promise<{ bikeId?: string }>
}) {
  const { bikeId } = await searchParams
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()

  // ถ้าไม่มี bikeId → แสดงหน้าเลือกรถ
  if (!bikeId) {
    const { data: bikes } = await supabase
      .from('bikes')
      .select('id, license_plate, brand, model, status')
      .order('license_plate')

    return (
      <div className="app-wrap">
        <div className="app-header" style={{ background: '#0f766e' }}>
          <Link href="/staff/home" className="app-header-back">←</Link>
          <div>
            <h1>งานเอกสาร</h1>
            <div className="sub">เลือกรถที่ต้องการจัดการ</div>
          </div>
        </div>
        <BikeSelectClient
          bikes={bikes ?? []}
          hrefTemplate="/staff/docs?bikeId={id}"
        />
      </div>
    )
  }

  let query = supabase
    .from('bike_documents')
    .select('id, bike_id, doc_type, expiry_date, doc_photo_url, notes, bikes(license_plate, brand, model)')
    .in('doc_type', ['tax', 'pob', 'registration'])
    .order('expiry_date', { ascending: true, nullsFirst: true })
    .eq('bike_id', bikeId)

  const { data: rawDocs } = await query

  // หน้าเล่ม (registration) = เอกสารถาวร ไม่มีวันหมดอายุ — แยกออกจากลิสต์เตือน
  const regRaw = (rawDocs ?? []).find(d => d.doc_type === 'registration')
  const regDoc = regRaw ? { id: regRaw.id, doc_photo_url: regRaw.doc_photo_url } : null

  const docs: DocItem[] = (rawDocs ?? []).filter(d => d.doc_type !== 'registration').map(d => ({
    ...d,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bikes: (d as any).bikes,
    ...calcUrgency(d.expiry_date),
  }))

  return <DocsClient docs={docs} bikeId={bikeId} backHref="/staff/docs" regDoc={regDoc} />
}
