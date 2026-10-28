import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import QuestSettingsClient from './QuestSettingsClient'

export const dynamic = 'force-dynamic'

export default async function QuestSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()
  const [{ data: branches }, { data: templates }, { data: settings }] = await Promise.all([
    admin.from('branches').select('id, name').order('name'),
    admin.from('daily_quest_templates').select('*').order('sort_order', { ascending: true }),
    admin.from('quest_settings').select('*').eq('id', 1).maybeSingle(),
  ])

  return (
    <div className="app-wrap">
      <QuestSettingsClient
        branches={branches ?? []}
        templates={templates ?? []}
        waitDays={settings?.wait_days ?? 7}
        disabledBranchIds={settings?.disabled_branch_ids ?? []}
        docSettings={{ pobLeadDays: settings?.pob_lead_days ?? 7, taxLeadDays: settings?.tax_lead_days ?? 30, taxExpiredWaitDays: settings?.tax_expired_wait_days ?? 7, inspectYears: settings?.inspect_years ?? 5, maxAppointmentDays: settings?.max_appointment_days ?? 7, maxSnoozeFollowups: settings?.max_snooze_followups ?? 2 }}
      />
    </div>
  )
}
