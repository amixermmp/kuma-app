import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AddBikeForm from './AddBikeForm'

export const dynamic = 'force-dynamic'

export default async function OwnerAddBikePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()
  const { data: branches } = await admin
    .from('branches')
    .select('id, name')
    .order('name', { ascending: true })

  return <AddBikeForm ownerId={user.id} branches={branches ?? []} />
}
