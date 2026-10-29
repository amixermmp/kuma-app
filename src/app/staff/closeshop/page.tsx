import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffOwnBranchId, getStaffBranchIds, getAllowedBikeIds } from '@/lib/staffBranch'
import { getShopOverviewGroups } from '@/lib/shopOverview'
import { loadQuestBoard } from '@/lib/questItems'
import CloseShopClient from './CloseShopClient'

export const dynamic = 'force-dynamic'

export default async function CloseShopPage() {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const admin = createAdminClient()
  const branchId = await getStaffOwnBranchId(staffId)

  const [{ data: staffRow }, { data: branchSettings }] = await Promise.all([
    admin.from('staff').select('name, branches(name)').eq('id', staffId).single(),
    admin.from('branch_settings').select('close_time_earliest').eq('branch_id', branchId).maybeSingle(),
  ])
  const staffName = staffRow?.name ?? 'Staff'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const branchName = (staffRow as any)?.branches?.name ?? 'Kuma Bikes'

  const H7 = 7 * 60 * 60 * 1000
  const bkk = new Date(Date.now() + H7)
  const nowHM = `${String(bkk.getUTCHours()).padStart(2, '0')}:${String(bkk.getUTCMinutes()).padStart(2, '0')}`
  const closeTime = branchSettings?.close_time_earliest ?? null
  const notYetTime = closeTime !== null && nowHM < closeTime

  if (notYetTime) {
    return (
      <div className="app-wrap" style={{ background: '#111827', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '14px' }}>⏰</div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '17px', marginBottom: '8px' }}>ยังไม่ถึงเวลาปิดร้าน</div>
          <div style={{ color: 'rgba(255,255,255,.6)', fontSize: '13px', marginBottom: '4px' }}>{branchName} ปิดร้านได้ตั้งแต่ {closeTime} น.</div>
          <div style={{ color: 'rgba(255,255,255,.4)', fontSize: '12px', marginBottom: '28px' }}>ตอนนี้ {nowHM} น.</div>
          <Link href="/staff/home" style={{
            padding: '13px 28px', borderRadius: '14px', border: '1.5px solid rgba(255,255,255,.25)',
            color: '#fff', fontSize: '14px', fontWeight: 700, textDecoration: 'none',
          }}>กลับหน้าหลัก</Link>
        </div>
      </div>
    )
  }

  const groups = await getShopOverviewGroups(admin, [branchId])
  const shopPlates = groups.atShop.map(b => b.licensePlate)
  const repairPlates = groups.repairs.filter(r => r.locationType === 'shop').map(r => r.licensePlate)

  // เช็คว่าวันนี้ (ตามเวลาไทย) ปิดร้านสาขานี้ไปแล้วหรือยัง — เตือนไว้ก่อน แต่ไม่บล็อกการปิดซ้ำ
  const todayStart = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate()) - H7)
  const { data: existingCloseToday } = await admin
    .from('staff_closeshops')
    .select('closed_at, staff(name)')
    .eq('branch_id', branchId)
    .gte('closed_at', todayStart.toISOString())
    .order('closed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alreadyClosedToday = existingCloseToday ? {
    closedAt: existingCloseToday.closed_at,
    staffName: (existingCloseToday as any).staff?.name ?? '',
  } : null

  // เควสค้างก่อนปิดร้าน — เตือนอย่างเดียว ไม่บล็อกการปิดร้าน (โหลดพลาดก็ไม่ขึ้นแถบ ปิดร้านได้ตามปกติ)
  // ไม่นับ: เควสช่วงปิดร้าน/เควสปิดร้านเอง, เควส "ต้องทักครบ" (นับจากรายการต้องทักโดยตรงแล้ว), รายการที่ทักแล้วรอคำตอบ
  let questWarning: { fixed: string[]; chase: number; self: number } | null = null
  try {
    const allowedBranchIds = await getStaffBranchIds(staffId)
    const allowedBikeIds = await getAllowedBikeIds(allowedBranchIds)
    const board = await loadQuestBoard(admin, { allowedBranchIds, allowedBikeIds, ownBranchId: branchId })
    if (board.enabled) {
      const fixed = board.fixed.filter(f => !f.done && f.slot !== 'close' && f.autoSource !== 'closeshop' && f.autoSource !== 'followups').map(f => f.title)
      const chase = board.chase.filter(c => c.items.some(i => !i.info && !i.doneToday)).length
      const self = board.self.filter(c => !c.inRepair).length
      if (fixed.length + chase + self > 0) questWarning = { fixed, chase, self }
    }
  } catch (e) {
    console.error('[closeshop] quest warning failed:', e)
  }

  return (
    <CloseShopClient
      staffName={staffName}
      branchName={branchName}
      shopPlates={shopPlates}
      repairPlates={repairPlates}
      alreadyClosedToday={alreadyClosedToday}
      questWarning={questWarning}
    />
  )
}
