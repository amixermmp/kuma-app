import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBikeCatalog } from '@/lib/bikeCatalog'
import AddBikeForm from './AddBikeForm'

export const dynamic = 'force-dynamic'

export default async function AddBikePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const { brands, models } = await getBikeCatalog()
  return <AddBikeForm staffId={user.id} brands={brands} models={models} />
}
