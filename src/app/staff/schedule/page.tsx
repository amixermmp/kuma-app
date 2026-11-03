import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffOwnBranchId } from '@/lib/staffBranch'
import { approvedMarks, loadExtraShifts, loadLeaves, loadOverrides, loadPatterns, loadScheduleConfig } from '@/lib/schedule'
import {
  LEAVE_AUTO_DAYS, LEAVE_MIN_HOURS, SCHEDULE_DAYS, WEEKDAY_SHORT, addDays, bkkDateStr, buildScheduleDays, diffDaysStr, shiftStartMs, stillAtTargetAfterLeave,
} from '@/lib/scheduleCalc'
import ScheduleCalendar, { type CalendarDay } from './ScheduleCalendar'
import LeavePanels, { type CoverRequest, type MyRequest } from './LeavePanels'

export const dynamic = 'force-dynamic'

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00+07:00`).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })

// ปฏิทินงานของสาขาตัวเอง — เข้าได้แม้ยังไม่เช็คอิน (โหมด "ดูตารางอย่างเดียว" ที่หน้าเช็คอิน)
// ลงงานที่ว่าง / ลา / ให้คนแทน ทำได้จากหน้านี้
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
        <h1>ตารางงาน</h1>
        <div className="sub">ดู • ลงงานที่ว่าง • ลา</div>
      </div>
      {/* ยังไม่ได้เช็คอิน (โหมดดูตารางอย่างเดียว) เข้าหน้าแรกไม่ได้ → มีปุ่มออกจากระบบกลับหน้าใส่รหัส */}
      {!checkedIn && (
        <form action="/api/staff/logout" method="post">
          <button type="submit" style={{
            background: 'rgba(255,255,255,.18)', color: '#fff', border: 'none', borderRadius: '10px',
            padding: '8px 12px', fontSize: '12px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>ออกจากระบบ</button>
        </form>
      )}
    </div>
  )

  if (!config.enabled) {
    return (
      <div className="app-wrap">
        {header}
        <div style={{ margin: '24px 16px', padding: '18px', background: '#fff', borderRadius: '14px', fontSize: '14px', color: '#6b7280', textAlign: 'center' }}>
          สาขานี้ยังไม่เปิดใช้ตารางงาน
        </div>
      </div>
    )
  }

  const to = addDays(today, SCHEDULE_DAYS - 1)
  const [patterns, overrides, extras, leaves] = await Promise.all([
    loadPatterns(supabase, branchId), loadOverrides(supabase, branchId, today, to),
    loadExtraShifts(supabase, branchId, today, to), loadLeaves(supabase, branchId, today, to),
  ])
  const days = buildScheduleDays(today, SCHEDULE_DAYS, patterns, overrides, config.counts, extras, approvedMarks(leaves))

  // ชื่อ + สถานะใช้งานของทุกคนที่เกี่ยวข้อง (คนแทนต้องเป็นคนที่ยังใช้งานอยู่)
  const ids = Array.from(new Set([...patterns.map(p => p.staffId), ...extras.map(e => e.staffId), ...leaves.flatMap(l => l.coverStaffId ? [l.staffId, l.coverStaffId] : [l.staffId])]))
  const { data: staff } = ids.length ? await supabase.from('staff').select('id, name, is_active').in('id', ids) : { data: [] }
  const nameOf = (id: string) => staff?.find(s => s.id === id)?.name ?? '—'
  const eligible = patterns.some(p => p.staffId === staffId)   // ลงงานที่ว่าง/ลา ได้เฉพาะคนที่เจ้าของตั้งแบบแผนไว้
  const eligibleIds = new Set(patterns.map(p => p.staffId))
  const activeIds = new Set((staff ?? []).filter(s => s.is_active).map(s => s.id))
  const nowMs = Date.now()
  const myLeaveByDay = new Map(leaves.filter(l => l.staffId === staffId).map(l => [l.day, l]))

  const mine = days.filter(d => d.staffIds.includes(staffId))
  const calendarDays: CalendarDay[] = days.map(d => {
    const isMine = d.staffIds.includes(staffId)
    const myLeave = myLeaveByDay.get(d.date)
    const notice = diffDaysStr(today, d.date)
    const tooLate = isMine && d.date > today && shiftStartMs(d.date) - nowMs < LEAVE_MIN_HOURS * 3_600_000
    const canLeave = eligible && isMine && d.date > today && !tooLate && !myLeave
    // คนแทนที่เลือกได้ (เฉพาะกรณีน้อยกว่า 10 วัน): คนอื่นในตารางที่ยังใช้งานและวันนั้นยังไม่มีงาน
    // วันที่คนเกินเป้า: ลาแล้วยังเหลือถึงเป้า → อนุมัติทันที ไม่ต้องคนแทน (ระบบตรวจซ้ำตอนส่งจริง)
    const surplusOk = canLeave && notice < LEAVE_AUTO_DAYS && stillAtTargetAfterLeave(d.count, d.type, config.counts)
    const coverOptions = canLeave && notice < LEAVE_AUTO_DAYS && !surplusOk
      ? Array.from(eligibleIds).filter(id => id !== staffId && activeIds.has(id) && !d.staffIds.includes(id)).map(id => ({ id, name: nameOf(id) }))
      : []
    return {
      date: d.date, weekday: d.weekday, label: fmtDate(d.date), isToday: d.date === today, mine: isMine,
      people: d.staffIds.map(id => ({ id, name: nameOf(id), mine: id === staffId, extra: d.extraStaffIds.includes(id) })),
      open: d.open,
      // ลาอนุมัติแล้วแต่เปลี่ยนใจ: กลับมาลงงานวันเดิมได้ถ้ายังว่าง (ลาที่ยังรออนุมัติให้กดยกเลิกคำขอแทน)
      canClaim: eligible && d.date > today && d.open > 0 && !isMine && (!myLeave || myLeave.status === 'approved'),
      returning: myLeave?.status === 'approved',
      canLeave, tooLate, noticeAuto: notice >= LEAVE_AUTO_DAYS, surplusOk, coverOptions,
      myLeave: myLeave ? { id: myLeave.id, status: myLeave.status } : null,
    }
  })

  // คำขอของฉัน (ลาเป็นช่วงรวมเป็นรายการเดียว) + คำขอที่ขอให้ฉันทำแทน
  // ลาที่อนุมัติแล้วแต่กลับมาลงงานวันนั้นใหม่แล้ว ไม่ต้องโชว์ว่า "ลาแล้ว" ในกล่องคำขอ
  const myShiftDays = new Set(days.filter(d => d.staffIds.includes(staffId)).map(d => d.date))
  const mineLeaves = leaves.filter(l => l.staffId === staffId && !(l.status === 'approved' && myShiftDays.has(l.day)))
  const groups = new Map<string, typeof mineLeaves>()
  for (const l of mineLeaves) groups.set(l.groupId ?? l.id, [...(groups.get(l.groupId ?? l.id) ?? []), l])
  const myRequests: MyRequest[] = Array.from(groups.values()).map(g => {
    const first = g[0], last = g[g.length - 1]
    return {
      id: first.id, status: first.status, late: g.some(x => x.late),
      label: g.length > 1 ? `${fmtDate(first.day)} – ${fmtDate(last.day)} (${g.length} วัน)` : fmtDate(first.day),
      coverName: first.coverStaffId ? nameOf(first.coverStaffId) : null, reason: first.reason,
    }
  })
  const coverRequests: CoverRequest[] = leaves.filter(l => l.status === 'pending_cover' && l.coverStaffId === staffId && l.day > today)
    .map(l => ({ id: l.id, fromName: nameOf(l.staffId), label: `${WEEKDAY_SHORT[days.find(d => d.date === l.day)?.weekday ?? 0]} ${fmtDate(l.day)}`, reason: l.reason }))

  const next = mine.find(d => d.date >= today)

  return (
    <div className="app-wrap">
      {header}
      <div style={{ margin: '12px 16px 0', padding: '12px 14px', background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: '12px', fontSize: '13px', color: '#155e75' }}>
        {mine.length === 0
          ? 'คุณไม่มีงานในช่วง 60 วันข้างหน้า'
          : <>งานถัดไปของคุณ: <strong>{WEEKDAY_SHORT[next!.weekday]} {fmtDate(next!.date)}{next!.date === today ? ' (วันนี้)' : ''}</strong> • ทั้งหมด {mine.length} วันใน 60 วัน</>}
        <div style={{ fontSize: '11.5px', marginTop: '8px', lineHeight: 1.7, color: '#0f4c5c' }}>
          {eligible ? (
            <>
              <div style={{ fontWeight: 800, marginBottom: '2px' }}>📌 กติกาตารางงาน</div>
              <div>🟢 ปุ่ม <strong>"ลงงานนี้"</strong> = วันนั้นยังขาดคน ใครกดก่อนได้ก่อน <strong>ลงแล้วยกเลิกเองไม่ได้</strong></div>
              <div>🔁 ลาไปแล้วเปลี่ยนใจ → ถ้าวันนั้นยังว่าง กด "กลับมาลงงานนี้" ได้เลย</div>
              <div>📝 กดลาล่วงหน้า <strong>10 วันขึ้นไป</strong> → อนุมัติทันที</div>
              <div>✅ วันที่คนเกินเป้า ลาแล้วยังครบ → อนุมัติทันที</div>
              <div>🤝 ลาน้อยกว่า 10 วัน → เลือก<strong>คนที่จะมาแทน</strong> พอเขากดรับ <strong>อนุมัติทันที</strong> ถ้าไม่มีคนแทน ส่งคำขอให้ผู้จัดการพิจารณา (ผู้จัดการมีสิทธิ์ไม่อนุมัติ)</div>
              <div>⚠️ ลาน้อยกว่า 48 ชม. → <strong>ทักหาผู้จัดการ</strong></div>
            </>
          ) : <>ต้องการลา/สลับงาน → ทักหาผู้จัดการ</>}
        </div>
      </div>

      <LeavePanels eligible={eligible} today={today} myRequests={myRequests} coverRequests={coverRequests} />
      <ScheduleCalendar days={calendarDays} />
    </div>
  )
}
