import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CreatePromoForm from './CreatePromoForm'
import Link from 'next/link'

export default async function CreatePromoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: 'linear-gradient(135deg,#be185d,#e11d48)' }}>
        <Link href="/owner/settings" className="app-header-back">←</Link>
        <div>
          <h1>สร้างโปรโมชั่น</h1>
          <div className="sub">ตั้งค่าเงื่อนไขการลดราคา</div>
        </div>
      </div>
      <CreatePromoForm />
    </div>
  )
}
