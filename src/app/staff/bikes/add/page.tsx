import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AddBikeForm from './AddBikeForm'

export const dynamic = 'force-dynamic'

export default async function AddBikePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  return <AddBikeForm staffId={user.id} />
}
