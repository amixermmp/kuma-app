import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import CloseShopReportClient, { CloseShopRow } from './CloseShopReportClient'

export const dynamic = 'force-dynamic'

const MONTHS_TH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']

export default async function CloseShopReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; branch?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const { period = 'week', from, to, branch = '' } = await searchParams

  const H7 = 7 * 60 * 60 * 1000
  const now = new Date()
  const bkk = new Date(now.getTime() + H7)

  let periodStart: Date
  let periodEnd: Date = new Date(now)
  let periodLabel: string

  if (period === 'custom' && from && to) {
    periodStart = new Date(`${from}T00:00:00+07:00`)
    periodEnd   = new Date(`${to}T23:59:59+07:00`)
    const fmtD  = (s: string) => { const [y, m, d] = s.split('-').map(Number); return `${d} ${MONTHS_TH[m - 1].slice(0, 3)}. ${y + 543}` }
    periodLabel = `${fmtD(from)} — ${fmtD(to)}`
  } else if (period === 'today') {
    periodStart = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate()) - H7)
    periodEnd   = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000 - 1)
    periodLabel = 'วันนี้'
  } else if (period === 'month') {
    periodStart = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), 1) - H7)
    periodEnd   = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth() + 1, 1) - H7 - 1)
    periodLabel = MONTHS_TH[bkk.getUTCMonth()] + ' ' + (bkk.getUTCFullYear() + 543)
  } else {
    periodStart = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate() - 6) - H7)
    periodEnd   = new Date(now)
    periodLabel = '7 วันล่าสุด'
  }

  const admin = createAdminClient()

  const [branchesRes, sessionsRes] = await Promise.all([
    admin.from('branches').select('id, name').order('name'),
    (() => {
      let q = admin.from('staff_closeshops')
        .select('id, closed_at, selfie_photo_url, plate_photos, expected_plates, found_plates, missing_plates, explanation, branch_id, staff(name), branches(name)')
        .gte('closed_at', periodStart.toISOString())
        .lte('closed_at', periodEnd.toISOString())
        .order('closed_at', { ascending: false })
      if (branch) q = q.eq('branch_id', branch)
      return q
    })(),
  ])

  const branches = branchesRes.data ?? []
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const one = (v: any) => Array.isArray(v) ? v[0] : v
  const rows: CloseShopRow[] = (sessionsRes.data ?? []).map((s: any) => ({
    id: s.id,
    closedAt: s.closed_at,
    selfiePhotoUrl: s.selfie_photo_url,
    platePhotos: (s.plate_photos ?? []).map((p: any) => ({ url: p.url, detectedPlates: p.detectedPlates ?? [] })),
    expectedPlates: s.expected_plates ?? [],
    foundPlates: s.found_plates ?? [],
    missingPlates: s.missing_plates ?? [],
    explanation: s.explanation,
    staffName: one(s.staff)?.name ?? '—',
    branchName: one(s.branches)?.name ?? '—',
  }))
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <CloseShopReportClient
      rows={rows}
      branches={branches}
      period={period}
      from={from}
      to={to}
      branch={branch}
      periodLabel={periodLabel}
    />
  )
}
