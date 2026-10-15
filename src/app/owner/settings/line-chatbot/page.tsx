import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { WeekSchedule, TodayOverride } from '@/lib/botSchedule'
import LineChatbotClient from './LineChatbotClient'

export const dynamic = 'force-dynamic'

export default async function LineChatbotSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()
  const [{ data: branches }, { data: settings }, { data: scheduleRows }] = await Promise.all([
    admin.from('branches').select('id, name').order('name'),
    admin.from('branch_settings').select('branch_id, line_bot_enabled'),
    // คอลัมน์ตั้งเวลา แยก query — ถ้ายังไม่ได้รัน migration จะอ่านพลาดแล้วเป็นค่าว่าง (หน้าไม่พัง)
    admin.from('branch_settings').select('branch_id, line_bot_schedule, line_bot_today_override'),
  ])

  const settingsMap = Object.fromEntries(
    (settings ?? []).map(s => [s.branch_id, s.line_bot_enabled])
  )
  const scheduleMap = Object.fromEntries(
    (scheduleRows ?? []).map(s => [s.branch_id, s])
  )

  const rows = (branches ?? []).map(b => ({
    id: b.id,
    name: b.name,
    enabled: settingsMap[b.id] !== false, // default true ถ้ายังไม่มี row
    schedule: (scheduleMap[b.id]?.line_bot_schedule ?? null) as WeekSchedule | null,
    today: (scheduleMap[b.id]?.line_bot_today_override ?? null) as TodayOverride | null,
  }))

  return <LineChatbotClient branches={rows} />
}
