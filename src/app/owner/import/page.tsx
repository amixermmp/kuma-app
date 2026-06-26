import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import ImportClient from './ImportClient'

export const dynamic = 'force-dynamic'

export default async function ImportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()
  const { data: branches } = await admin
    .from('branches')
    .select('id, name')
    .order('name')

  return <ImportClient branches={branches ?? []} />
}
