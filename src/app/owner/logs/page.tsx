import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pruneOldLogs } from '@/lib/log'
import LogsClient from './LogsClient'

export const dynamic = 'force-dynamic'

export default async function OwnerLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  await pruneOldLogs()

  const { from, to } = await searchParams

  const admin = createAdminClient()
  let query = admin
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  if (from) query = query.gte('created_at', `${from}T00:00:00`)
  if (to)   query = query.lte('created_at', `${to}T23:59:59`)

  // ถ้าไม่ได้ filter ให้แสดงแค่ 90 วันย้อนหลัง
  if (!from && !to) {
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString()
    query = query.gte('created_at', since)
  }

  const { data: logs } = await query

  return (
    <LogsClient
      logs={logs ?? []}
      from={from ?? ''}
      to={to ?? ''}
      total={logs?.length ?? 0}
    />
  )
}
