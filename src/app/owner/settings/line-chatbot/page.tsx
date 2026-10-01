import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import LineChatbotClient from './LineChatbotClient'

export const dynamic = 'force-dynamic'

export default async function LineChatbotSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()
  const [{ data: branches }, { data: settings }] = await Promise.all([
    admin.from('branches').select('id, name').order('name'),
    admin.from('branch_settings').select('branch_id, line_bot_enabled'),
  ])

  const settingsMap = Object.fromEntries(
    (settings ?? []).map(s => [s.branch_id, s.line_bot_enabled])
  )

  const rows = (branches ?? []).map(b => ({
    id: b.id,
    name: b.name,
    enabled: settingsMap[b.id] !== false, // default true ถ้ายังไม่มี row
  }))

  return <LineChatbotClient branches={rows} />
}
