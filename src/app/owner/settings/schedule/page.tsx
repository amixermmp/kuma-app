import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { approvedMarks, loadExtraShifts, loadLeaves, loadOverrides, loadPatterns, loadScheduleConfig } from '@/lib/schedule'
import { SCHEDULE_DAYS, addDays, bkkDateStr, buildScheduleDays } from '@/lib/scheduleCalc'
import ScheduleClient from './ScheduleClient'

export const dynamic = 'force-dynamic'

const PILOT_BRANCH = 'b8d8a354-31a7-4c87-8f49-01bc4b1b8c73'   // KUMA บางแสน (นำร่อง)

export default async function ScheduleSettingsPage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()
  const { data: branches } = await admin.from('branches').select('id, name').order('name')
  const { branch } = await searchParams
  const list = branches ?? []
  const branchId = list.find(b => b.id === branch)?.id ?? list.find(b => b.id === PILOT_BRANCH)?.id ?? list[0]?.id
  if (!branchId) redirect('/owner/settings')

  const today = bkkDateStr()
  const to = addDays(today, SCHEDULE_DAYS - 1)
  const [config, patterns, overrides, extras, leaves, { data: staff }] = await Promise.all([
    loadScheduleConfig(admin, branchId),
    loadPatterns(admin, branchId),
    loadOverrides(admin, branchId, today, to),
    loadExtraShifts(admin, branchId, today, to),
    loadLeaves(admin, branchId, today, to),
    admin.from('staff').select('id, name, is_active, role').eq('branch_id', branchId).order('name'),
  ])
  const days = buildScheduleDays(today, SCHEDULE_DAYS, patterns, overrides, config.counts, extras, approvedMarks(leaves))

  return (
    <div className="app-wrap">
      <ScheduleClient
        branches={list}
        branchId={branchId}
        enabled={config.enabled}
        counts={config.counts}
        // เลือกได้เฉพาะพนักงานที่ยังใช้งานอยู่ (คนลาออก/ปิดใช้งานไม่ขึ้นให้ตั้งแบบแผนใหม่) — แต่ถ้ามีแบบแผนค้างอยู่ ยังต้องเห็นชื่อ
        staff={(staff ?? []).filter(s => s.is_active || patterns.some(p => p.staffId === s.id) || extras.some(e => e.staffId === s.id) || leaves.some(l => l.staffId === s.id || l.coverStaffId === s.id)).map(s => ({ id: s.id, name: s.name, active: !!s.is_active, role: s.role }))}
        patterns={patterns}
        leaves={leaves}
        days={days}
        today={today}
      />
    </div>
  )
}
