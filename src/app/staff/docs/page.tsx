import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import DocsClient from './DocsClient'

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

export default async function DocsPage() {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()
  const { data: rawDocs } = await supabase
    .from('bike_documents')
    .select('id, bike_id, doc_type, expiry_date, doc_photo_url, notes, bikes(license_plate, brand, model)')
    .in('doc_type', ['tax', 'pob'])
    .order('expiry_date', { ascending: true, nullsFirst: true })

  const docs: DocItem[] = (rawDocs ?? []).map(d => ({
    ...d,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bikes: (d as any).bikes,
    ...calcUrgency(d.expiry_date),
  }))

  return <DocsClient docs={docs} />
}
