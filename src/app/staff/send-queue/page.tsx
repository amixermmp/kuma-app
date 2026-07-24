import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds } from '@/lib/staffBranch'
import SendCarQueueClient from './SendCarQueueClient'

export const dynamic = 'force-dynamic'

export default async function SendQueuePage() {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()
  const allowedBranchIds = await getStaffBranchIds(staffId)

  let query = supabase
    .from('bookings')
    .select('id, booking_ref, start_datetime, customer_name, customer_phone, total_days, daily_rate, requested_brand, requested_model, original_requested_brand, original_requested_model, reassign_reason, blacklist_watch, blacklist_watch_reason, delivery_type, delivery_address, bikes(id, license_plate, brand, model, color, photo_url)')
    .eq('status', 'confirmed')
    .order('start_datetime', { ascending: true })
    .limit(100)
  if (allowedBranchIds) query = query.in('branch_id', allowedBranchIds)

  const { data: sendJobs } = await query

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: 'var(--red)' }}>
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div>
          <h1>ส่งรถคิวจอง</h1>
          <div className="sub">ค้นหาลูกค้าด้วยชื่อหรือเบอร์โทร</div>
        </div>
      </div>
      <SendCarQueueClient jobs={sendJobs ?? []} />
    </div>
  )
}
