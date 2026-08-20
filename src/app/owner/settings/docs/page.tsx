import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import DocsClient from './DocsClient'

export const dynamic = 'force-dynamic'

export default async function DocsSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()

  const { data: primaryBranch } = await admin.from('branches').select('id').order('name').limit(1).single()
  const branchId = primaryBranch?.id ?? ''

  const { data: branchDoc } = branchId
    ? await admin.from('branch_settings').select('terms_photo_url, manual_photo_url, contract_photo_url').eq('branch_id', branchId).maybeSingle()
    : { data: null }

  return (
    <div className="app-wrap">
      <DocsClient
        branchId={branchId}
        branchDocs={{
          terms_photo_url: branchDoc?.terms_photo_url ?? null,
          manual_photo_url: branchDoc?.manual_photo_url ?? null,
          contract_photo_url: branchDoc?.contract_photo_url ?? null,
        }}
      />
    </div>
  )
}
