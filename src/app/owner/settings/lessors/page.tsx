import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import LessorsClient from './LessorsClient'

export const dynamic = 'force-dynamic'

export default async function LessorsSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()
  const { data: lessors } = await admin
    .from('lessor_profiles')
    .select('id, name, id_card_number, signature_data')
    .order('created_at')

  return (
    <div className="app-wrap">
      <LessorsClient lessors={lessors ?? []} />
    </div>
  )
}
