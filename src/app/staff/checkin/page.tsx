import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffOwnBranchId } from '@/lib/staffBranch'
import { getCheckinMode } from '@/lib/schedule'
import { bkkDateStr } from '@/lib/scheduleCalc'
import CheckinForm from './CheckinForm'

export const dynamic = 'force-dynamic'

export default async function StaffCheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const { redirect: redirectTo } = await searchParams

  const supabase = createAdminClient()

  const H7 = 7 * 60 * 60 * 1000
  const bkkNow = new Date(Date.now() + H7)
  const todayStartIso = new Date(Date.UTC(bkkNow.getUTCFullYear(), bkkNow.getUTCMonth(), bkkNow.getUTCDate()) - H7).toISOString()

  const [{ data: staffRow }, { data: already }] = await Promise.all([
    supabase.from('staff').select('name, branches(name)').eq('id', staffId).single(),
    supabase.from('staff_checkins').select('checked_in_at').eq('staff_id', staffId)
      .gte('checked_in_at', todayStartIso).order('checked_in_at', { ascending: true }).limit(1).maybeSingle(),
  ])
  const staffName = staffRow?.name ?? 'Staff'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const branchName = (staffRow as any)?.branches?.name ?? 'Kuma Bikes'

  // ตารางงาน: คนที่เจ้าของตั้งแบบแผนให้ในสาขาที่เปิดสวิตช์ และวันนี้ไม่มีงาน → ถามว่าจะ "เข้าทำงาน" หรือ "ดูตารางอย่างเดียว"
  // คนที่ไม่มีแบบแผน/สาขาที่ปิดสวิตช์/หาสาขาไม่เจอ = เช็คอินปกติเหมือนเดิมทุกอย่าง (ถามเฉพาะตอนยังไม่เคยเช็คอินวันนี้)
  let offShift = false
  if (!already) {
    try {
      offShift = (await getCheckinMode(supabase, staffId, await getStaffOwnBranchId(staffId), bkkDateStr())) === 'off_shift'
    } catch {
      offShift = false
    }
  }

  return (
    <CheckinForm
      staffName={staffName}
      branchName={branchName}
      redirectTo={redirectTo || '/staff/home'}
      alreadyCheckedInAt={already?.checked_in_at ?? null}
      offShift={offShift}
    />
  )
}
