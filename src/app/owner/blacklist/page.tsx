import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import BlacklistClient from './BlacklistClient'

export const dynamic = 'force-dynamic'

export default async function OwnerBlacklistPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()
  const { data: entries } = await admin
    .from('blacklist')
    .select('id, name, phone, reason, created_at')
    .order('created_at', { ascending: false })

  return <BlacklistClient entries={entries ?? []} />
}
