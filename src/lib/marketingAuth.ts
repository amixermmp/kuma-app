import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getStaffOwnBranchId } from '@/lib/staffBranch'

export type MarketingAccess = { ok: true; branchId: string | null } | { ok: false }

// หน้ารูปโปรโมทใช้ได้ทั้งโอนเนอร์ (เห็นทุกสาขา → branchId = null) และพนักงาน (เห็น/จัดการได้เฉพาะสาขาตัวเอง)
// สาขาของพนักงานอ่านจาก cookie ฝั่งเซิร์ฟเวอร์เสมอ ไม่เชื่อค่าที่หน้าเว็บส่งมา
export async function getMarketingAccess(): Promise<MarketingAccess> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) return { ok: true, branchId: null }

  const staffId = (await cookies()).get('kuma_staff_id')?.value
  if (!staffId) return { ok: false }
  try {
    return { ok: true, branchId: await getStaffOwnBranchId(staffId) }
  } catch {
    return { ok: false }
  }
}

// branchId ของผู้ใช้เป็น null (โอนเนอร์) = ทำได้ทุกสาขา, ไม่งั้นต้องตรงกับสาขาของรูป
export function canTouchPhoto(access: { branchId: string | null }, photoBranchId: string) {
  return access.branchId === null || access.branchId === photoBranchId
}
