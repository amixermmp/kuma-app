import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div style={{ padding: '24px' }}>
      <h1>🏍️ Dashboard</h1>
      <p>ยินดีต้อนรับสู่ Kuma App</p>
      <p style={{ color: '#6b7280', marginTop: '8px' }}>ระบบกำลังพัฒนา...</p>
    </div>
  )
}
