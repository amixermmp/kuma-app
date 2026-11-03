import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffOwnBranchId } from '@/lib/staffBranch'
import { loadExtraShifts, loadOverrides, loadPatterns, loadScheduleConfig } from '@/lib/schedule'
import { SCHEDULE_DAYS, WEEKDAY_SHORT, addDays, bkkDateStr, buildScheduleDays } from '@/lib/scheduleCalc'
import ScheduleCalendar, { type CalendarDay } from './ScheduleCalendar'

export const dynamic = 'force-dynamic'

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00+07:00`).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })

// ปฏิทินเวรแบบอ่านอย่างเดียวของสาขาตัวเอง — เข้าได้แม้ยังไม่เช็คอิน (โหมด "ดูตารางอย่างเดียว" ที่หน้าเช็คอิน)
export default async function StaffSchedulePage() {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  let branchId: string
  try {
    branchId = await getStaffOwnBranchId(staffId)
  } catch {
    redirect('/staff/login')
  }

  const supabase = createAdminClient()
  const today = bkkDateStr()
  const config = await loadScheduleConfig(supabase, branchId)
  // ลิงก์ย้อนกลับ: ถ้ายังไม่ได้เช็คอินวันนี้ หน้าอื่นจะเด้งกลับไปหน้าเช็คอิน จึงส่งไปหน้าเช็คอินตรงๆ
  const checkedIn = cookieStore.get('kuma_checkin_date')?.value === `${staffId}:${today}` || cookieStore.get('kuma_owner_pass')?.value === staffId
  const backHref = checkedIn ? '/staff/home' : '/staff/checkin'

  const header = (
    <div className="app-header" style={{ background: '#0e7490' }}>
      <Link href={backHref} className="app-header-back">←</Link>
      <div style={{ flex: 1 }}>
        <h1>ตารางเวร</h1>
        <div className="sub">ดูอย่างเดียว</div>
      </div>
    </div>
  )

  if (!config.enabled) {
    return (
      <div className="app-wrap">
        {header}
        <div style={{ margin: '24px 16px', padding: '18px', background: '#fff', borderRadius: '14px', fontSize: '14px', color: '#6b7280', textAlign: 'center' }}>
          สาขานี้ยังไม่เปิดใช้ตารางเวร
        </div>
      </div>
    )
  }

  const to = addDays(today, SCHEDULE_DAYS - 1)
  const [patterns, overrides, extras] = await Promise.all([loadPatterns(supabase, branchId), loadOverrides(supabase, branchId, today, to), loadExtraShifts(supabase, branchId, today, to)])
  const days = buildScheduleDays(today, SCHEDULE_DAYS, patterns, overrides, config.counts, extras)
  const ids = Array.from(new Set([...patterns.map(p => p.staffId), ...extras.map(e => e.staffId)]))
  const { data: staff } = ids.length ? await supabase.from('staff').select('id, name').in('id', ids) : { data: [] }
  const nameOf = (id: string) => staff?.find(s => s.id === id)?.name ?? '—'
  const mine = days.filter(d => d.staffIds.includes(staffId))
  // ลงเวรว่างได้เฉพาะคนที่เจ้าของตั้งแบบแผนไว้ (พาร์ทไทม์ในตาราง)
  const eligible = patterns.some(p => p.staffId === staffId)
  const calendarDays: CalendarDay[] = days.map(d => ({
    date: d.date, weekday: d.weekday, label: fmtDate(d.date), isToday: d.date === today, mine: d.staffIds.includes(staffId),
    people: d.staffIds.map(id => ({ id, name: nameOf(id), mine: id === staffId, extra: d.extraStaffIds.includes(id) })),
    open: d.open,
    canClaim: eligible && d.date > today && d.open > 0 && !d.staffIds.includes(staffId),
  }))
  const next = mine.find(d => d.date >= today)

  return (
    <div className="app-wrap">
      {header}
      <div style={{ margin: '12px 16px 0', padding: '12px 14px', background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: '12px', fontSize: '13px', color: '#155e75' }}>
        {mine.length === 0
          ? 'คุณไม่มีเวรในช่วง 60 วันข้างหน้า'
          : <>เวรถัดไปของคุณ: <strong>{WEEKDAY_SHORT[next!.weekday]} {fmtDate(next!.date)}{next!.date === today ? ' (วันนี้)' : ''}</strong> • ทั้งหมด {mine.length} วันใน 60 วัน</>}
        <div style={{ fontSize: '11px', marginTop: '4px', opacity: .8 }}>
          {eligible ? 'วันที่มีปุ่ม "ลงเวรนี้" = ยังขาดคน ใครกดก่อนได้ก่อน ลงแล้วยกเลิกเองไม่ได้ • ' : ''}ต้องการลา/สลับเวร → ทักหาพี่เจ้าของร้าน
        </div>
      </div>

      <ScheduleCalendar days={calendarDays} />
    </div>
  )
}
