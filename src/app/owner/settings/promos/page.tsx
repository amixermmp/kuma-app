import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PromosClient from './PromosClient'

export const dynamic = 'force-dynamic'

export default async function PromosSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()

  const { data: promotions } = await admin.from('promotions')
    .select('id, name, code, description, discount_type, discount_value, min_days, bonus_days, is_active, is_student_promo')
    .order('created_at')

  return (
    <div className="app-wrap">
      <PromosClient promotions={promotions ?? []} />
    </div>
  )
}
