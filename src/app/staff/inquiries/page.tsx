import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds, getStaffOwnBranchId } from '@/lib/staffBranch'
import InquiriesClient, { type Inquiry } from './InquiriesClient'

export const dynamic = 'force-dynamic'

// คำขอจองจากเว็บหน้าร้าน — ลูกค้ากดปุ่ม "จองผ่านไลน์" แล้วข้อความมีรหัส Z-XXXX พนักงานค้นด้วยรหัสแล้วเห็นข้อมูลครบ
export default async function StaffInquiriesPage() {
  const staffId = (await cookies()).get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  let branchIds: string[]
  try {
    branchIds = (await getStaffBranchIds(staffId)) ?? [await getStaffOwnBranchId(staffId)]
  } catch {
    redirect('/staff/login')
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('web_inquiries')
    .select('id, code, brand, model, start_date, end_date, total_days, pickup_time, send_type, send_zone_name, return_type, return_zone_name, est_rent, est_delivery_fee, delivery_fee_unknown, est_total, deposit, status, staff_note, created_at')
    .in('branch_id', branchIds)
    .order('created_at', { ascending: false })
    .limit(150)

  const rows: Inquiry[] = (data ?? []).map(r => ({
    ...r,
    est_rent: r.est_rent == null ? null : Number(r.est_rent),
    est_delivery_fee: r.est_delivery_fee == null ? null : Number(r.est_delivery_fee),
    est_total: r.est_total == null ? null : Number(r.est_total),
    deposit: r.deposit == null ? null : Number(r.deposit),
  }))

  return <InquiriesClient rows={rows} />
}
