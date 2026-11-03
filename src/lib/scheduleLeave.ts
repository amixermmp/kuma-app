import { createAdminClient } from '@/lib/supabase/admin'
import {
  loadExtraShifts, loadLeaves, loadOverrides, loadPatterns, loadScheduleConfig, approvedMarks, type LeaveStatus,
} from '@/lib/schedule'
import {
  LEAVE_MAX_AUTO_RANGE, SCHEDULE_DAYS, addDays, bkkDateStr, dateRange, dayTypeFor, diffDaysStr, leaveRoute, shiftStartMs, staffOnDate, stillAtTargetAfterLeave,
  type ExtraShift, type LeaveRoute, type SchedulePattern,
} from '@/lib/scheduleCalc'
import type { LeaveRow } from '@/lib/schedule'

// ลา / แลกงาน (คนแทน) ของตารางงานพาร์ทไทม์ — กติกาอยู่ที่ leaveRoute ใน scheduleCalc.ts
//  <48 ชม. ลาในแอปไม่ได้ (เจ้าของบันทึกลาให้) / ≥10 วัน อนุมัติทันที / <10 วัน ระบุคนแทน→รอคนแทนรับ ไม่ระบุ→ส่งเจ้าของ
type Admin = ReturnType<typeof createAdminClient>

// อนุมัติการลา = ตัดงานที่ลงเพิ่มของคนนั้นในวันนั้นออกด้วย (ไม่ให้นับคนที่ลาเป็นงานเพิ่มค้าง กระทบการนับที่ว่างตอนลงงาน)
async function dropExtraShifts(supabase: Admin, rows: { staffId: string; day: string }[]) {
  for (const r of rows) await supabase.from('schedule_extra_shifts').delete().eq('staff_id', r.staffId).eq('day', r.day)
}

type Ctx = { patterns: SchedulePattern[]; extras: ExtraShift[]; leaves: LeaveRow[] }
async function loadCtx(supabase: Admin, branchId: string, from: string, to: string): Promise<Ctx> {
  const [patterns, extras, leaves] = await Promise.all([
    loadPatterns(supabase, branchId), loadExtraShifts(supabase, branchId, from, to), loadLeaves(supabase, branchId, from, to),
  ])
  return { patterns, extras, leaves }
}
// วันที่คนนี้ "มีงานอยู่จริง" (ตามแบบแผน/งานเพิ่ม และไม่ได้ลาอนุมัติไปแล้ว)
const hasShift = (c: Ctx, staffId: string, day: string) =>
  staffOnDate(c.patterns, day, c.extras, approvedMarks(c.leaves)).includes(staffId)

const LEAVE_ERR: Record<string, string> = {
  invalid: 'วันที่ไม่ถูกต้อง',
  too_late: 'ลาล่วงหน้าน้อยกว่า 48 ชม. ลาในแอปไม่ได้ — ทักหาผู้จัดการให้บันทึกลาให้',
  too_far: 'ลาได้ภายใน 60 วันข้างหน้าเท่านั้น',
  cover_range: 'ลาเป็นช่วงระบุคนแทนไม่ได้',
}

export async function requestLeave(
  supabase: Admin, staffId: string, branchId: string,
  input: { from: unknown; to: unknown; coverStaffId?: unknown; reason?: unknown },
): Promise<{ ok: true; route: LeaveRoute; count: number; surplus: boolean } | { error: string }> {
  const days = dateRange(input.from, input.to)
  if (!days) return { error: 'วันที่ไม่ถูกต้อง' }
  const cfg = await loadScheduleConfig(supabase, branchId)
  if (!cfg.enabled) return { error: 'สาขานี้ยังไม่เปิดใช้ตารางงาน' }
  const { data: staff } = await supabase.from('staff').select('id, branch_id, is_active').eq('id', staffId).maybeSingle()
  if (!staff || staff.branch_id !== branchId || !staff.is_active) return { error: 'บัญชีนี้ลางานสาขานี้ไม่ได้' }

  const ctx = await loadCtx(supabase, branchId, days[0], days[days.length - 1])
  if (!ctx.patterns.some(p => p.staffId === staffId)) return { error: 'คุณยังไม่ได้อยู่ในตารางงาน' }
  const shiftDays = days.filter(d => hasShift(ctx, staffId, d))
  if (shiftDays.length === 0) {
    // ไม่เหลือวันที่มีงาน: ถ้าเพราะลาไปแล้ว/มีคำขอค้างอยู่ ให้บอกตรงๆ ไม่ใช่ "ไม่มีงาน"
    return { error: ctx.leaves.some(l => l.staffId === staffId && days.includes(l.day)) ? 'คุณมีคำขอลาในวันนี้อยู่แล้ว (หรือลาไปแล้ว)' : 'ช่วงวันนี้คุณไม่มีงาน ไม่ต้องลา' }
  }
  if (ctx.leaves.some(l => l.staffId === staffId && shiftDays.includes(l.day))) return { error: 'คุณมีคำขอลาในวันเหล่านี้อยู่แล้ว' }

  const coverId = typeof input.coverStaffId === 'string' && input.coverStaffId ? input.coverStaffId : null
  const rt = leaveRoute({ today: bkkDateStr(), nowMs: Date.now(), days: shiftDays, hasCover: !!coverId })
  if ('error' in rt) return { error: LEAVE_ERR[rt.error] }

  // วันที่คนเกินเป้า (รับเกินไว้เผื่อมีคนลา): ลาแล้วทุกวันยังเหลือถึงเป้า (และช่วงไม่เกิน 14 วัน) → อนุมัติทันที ไม่ต้องคนแทน/ไม่ต้องรอเจ้าของ
  // ยืนยันซ้ำหลังบันทึก (ด้านล่าง) กันหลายคนกดลาพร้อมกันแล้วเหลือต่ำกว่าเป้า — ไม่ต้องมีฟังก์ชันล็อกในฐานข้อมูล
  let surplusPath = false
  if (rt.route !== 'auto' && shiftDays.length <= LEAVE_MAX_AUTO_RANGE
    && diffDaysStr(shiftDays[0], shiftDays[shiftDays.length - 1]) + 1 <= LEAVE_MAX_AUTO_RANGE) {
    const overrides = await loadOverrides(supabase, branchId, shiftDays[0], shiftDays[shiftDays.length - 1])
    surplusPath = shiftDays.every(d => {
      const count = staffOnDate(ctx.patterns, d, ctx.extras, approvedMarks(ctx.leaves)).length
      return stillAtTargetAfterLeave(count, dayTypeFor(d, overrides), cfg.counts)
    })
  }

  // ระบุคนแทนได้เฉพาะลาวันเดียวที่เข้ากรณี "น้อยกว่า 10 วัน" (≥10 วันอนุมัติทันที ไม่ต้องมีคนแทน; วันที่คนเกินเป้าก็ไม่ต้อง)
  let cover: string | null = null
  if (coverId && rt.route === 'cover' && !surplusPath) {
    const day = shiftDays[0]
    if (coverId === staffId) return { error: 'เลือกตัวเองเป็นคนแทนไม่ได้' }
    const { data: cs } = await supabase.from('staff').select('id, branch_id, is_active').eq('id', coverId).maybeSingle()
    if (!cs || cs.branch_id !== branchId || !cs.is_active) return { error: 'คนแทนต้องเป็นพนักงานสาขานี้' }
    if (!ctx.patterns.some(p => p.staffId === coverId)) return { error: 'คนแทนต้องเป็นคนที่อยู่ในตารางงาน' }
    if (hasShift(ctx, coverId, day)) return { error: 'คนแทนมีงานวันนั้นอยู่แล้ว' }
    cover = coverId
  }

  const normalStatus: LeaveStatus = rt.route === 'auto' ? 'approved' : rt.route === 'cover' && !surplusPath ? 'pending_cover' : 'pending'
  const status: LeaveStatus = surplusPath ? 'approved' : normalStatus
  const groupId = shiftDays.length > 1 ? crypto.randomUUID() : null
  const reason = typeof input.reason === 'string' && input.reason.trim() ? input.reason.trim().slice(0, 300) : null
  const now = new Date().toISOString()
  const rows = shiftDays.map(day => ({
    branch_id: branchId, staff_id: staffId, day, status, source: 'staff', cover_staff_id: surplusPath ? null : cover, group_id: groupId, reason, late: false,
    ...(status === 'approved' ? { decided_by: surplusPath ? 'auto-surplus' : 'auto', decided_at: now } : {}),
  }))
  const { error } = await supabase.from('schedule_leaves').insert(rows)
  if (error) return { error: error.code === '23505' ? 'คุณมีคำขอลาในวันเหล่านี้อยู่แล้ว' : 'บันทึกไม่สำเร็จ ลองอีกครั้ง' }

  // ยืนยันหลังบันทึก: ถ้ามีคนลาพร้อมกันจนวันไหนเหลือต่ำกว่าเป้า คำขอของเรากลับไปรอเจ้าของ
  // (ปลอดภัยไว้ก่อน — ถ้ากดพร้อมกันเป๊ะๆ ทุกคนเห็นกันและกัน จึงส่งให้เจ้าของพิจารณาทั้งหมด ไม่มีทางเหลือต่ำกว่าเป้าโดยไม่มีใครรู้)
  if (surplusPath) {
    const first = shiftDays[0], last = shiftDays[shiftDays.length - 1]
    const after = await loadCtx(supabase, branchId, first, last)
    const overrides = await loadOverrides(supabase, branchId, first, last)
    const stillOk = shiftDays.every(d => {
      const target = dayTypeFor(d, overrides) === 'weekend' ? cfg.counts.weekendTarget : cfg.counts.weekdayTarget
      return staffOnDate(after.patterns, d, after.extras, approvedMarks(after.leaves)).length >= target
    })
    if (!stillOk) {
      await supabase.from('schedule_leaves').update({ status: 'pending', decided_by: null, decided_at: null })
        .eq('staff_id', staffId).in('day', shiftDays).eq('decided_by', 'auto-surplus').eq('status', 'approved')
      return { ok: true, route: 'owner', count: shiftDays.length, surplus: false }
    }
  }
  if (status === 'approved') await dropExtraShifts(supabase, shiftDays.map(day => ({ staffId, day })))
  return { ok: true, route: surplusPath ? 'auto' : rt.route, count: shiftDays.length, surplus: surplusPath }
}

// คนแทนกดรับ/ไม่รับ (ไม่จำกัดเวลา ตราบที่ยังไม่ถึงวันนั้น) — รับ = อนุมัติการลา + คนแทนได้งานเพิ่มของวันนั้น; ไม่รับ = คำขอกลับไปรอเจ้าของ
export async function respondCover(supabase: Admin, coverStaffId: string, branchId: string, leaveId: unknown, accept: boolean): Promise<string | null> {
  if (typeof leaveId !== 'string' || !leaveId) return 'ไม่พบคำขอ'
  const { data: lv } = await supabase.from('schedule_leaves').select('id, staff_id, branch_id, day, status, cover_staff_id').eq('id', leaveId).maybeSingle()
  if (!lv || lv.branch_id !== branchId || lv.cover_staff_id !== coverStaffId || lv.status !== 'pending_cover') return 'คำขอนี้ไม่ได้รอคุณตอบแล้ว'
  if (lv.day <= bkkDateStr()) return 'เลยกำหนดวันนั้นแล้ว — ทักหาผู้จัดการ'

  if (!accept) {
    const { error } = await supabase.from('schedule_leaves').update({ status: 'pending' }).eq('id', leaveId).eq('status', 'pending_cover')
    return error ? 'บันทึกไม่สำเร็จ' : null
  }
  const ctx = await loadCtx(supabase, branchId, lv.day, lv.day)
  if (hasShift(ctx, coverStaffId, lv.day)) return 'คุณมีงานวันนั้นอยู่แล้ว'

  // จองสิทธิ์ก่อน (เงื่อนไขว่ายังรออยู่ กดซ้ำ/พร้อมกันผ่านได้ครั้งเดียว) แล้วค่อยให้งาน — ล้มกลางทางคืนสถานะ
  const { data: claimed, error } = await supabase.from('schedule_leaves')
    .update({ status: 'approved', decided_by: 'cover', decided_at: new Date().toISOString() })
    .eq('id', leaveId).eq('status', 'pending_cover').select('id')
  if (error) return 'บันทึกไม่สำเร็จ'
  if (!claimed || claimed.length === 0) return 'คำขอนี้ถูกจัดการไปแล้ว'
  const { error: shiftErr } = await supabase.from('schedule_extra_shifts')
    .upsert({ branch_id: branchId, staff_id: coverStaffId, day: lv.day, source: 'cover' }, { onConflict: 'staff_id,day', ignoreDuplicates: true })
  if (shiftErr) {
    await supabase.from('schedule_leaves').update({ status: 'pending_cover', decided_by: null, decided_at: null }).eq('id', leaveId)
    return 'บันทึกงานไม่สำเร็จ ลองอีกครั้ง'
  }
  await dropExtraShifts(supabase, [{ staffId: lv.staff_id, day: lv.day }])
  return null
}

// พนักงานยกเลิกคำขอของตัวเอง — เฉพาะที่ยังรออนุมัติ (ลาที่อนุมัติแล้วเป็นที่สิ้นสุด); ลาเป็นช่วงยกเลิกทั้งช่วงพร้อมกัน
export async function cancelOwnLeave(supabase: Admin, staffId: string, leaveId: unknown): Promise<string | null> {
  if (typeof leaveId !== 'string' || !leaveId) return 'ไม่พบคำขอ'
  const { data: lv } = await supabase.from('schedule_leaves').select('id, staff_id, status, group_id').eq('id', leaveId).maybeSingle()
  if (!lv || lv.staff_id !== staffId) return 'ไม่พบคำขอ'
  if (lv.status !== 'pending' && lv.status !== 'pending_cover') return 'ลาที่อนุมัติแล้วยกเลิกเองไม่ได้ — ทักหาผู้จัดการ'
  let q = supabase.from('schedule_leaves').update({ status: 'cancelled' }).eq('staff_id', staffId).in('status', ['pending', 'pending_cover'])
  q = lv.group_id ? q.eq('group_id', lv.group_id) : q.eq('id', leaveId)
  const { error } = await q
  return error ? 'ยกเลิกไม่สำเร็จ' : null
}

// ── เจ้าของ ──────────────────────────────────────────────────────────────────────────────────
// อนุมัติ/ปฏิเสธคำขอที่รออยู่ (ทั้งช่วงถ้าเป็นลาเป็นช่วง)
export async function ownerDecideLeave(supabase: Admin, branchId: string, input: { id?: unknown; groupId?: unknown }, approve: boolean): Promise<string | null> {
  const id = typeof input.id === 'string' ? input.id : null
  const groupId = typeof input.groupId === 'string' ? input.groupId : null
  if (!id && !groupId) return 'ไม่พบคำขอ'
  let q = supabase.from('schedule_leaves')
    .update({ status: approve ? 'approved' : 'rejected', decided_by: 'owner', decided_at: new Date().toISOString() })
    .eq('branch_id', branchId).in('status', ['pending', 'pending_cover'])
  q = groupId ? q.eq('group_id', groupId) : q.eq('id', id as string)
  const { data, error } = await q.select('staff_id, day')
  if (error) return 'บันทึกไม่สำเร็จ'
  if (!data || data.length === 0) return 'คำขอนี้ถูกจัดการไปแล้ว'
  if (approve) await dropExtraShifts(supabase, data.map(r => ({ staffId: r.staff_id as string, day: r.day as string })))
  return null
}

// เจ้าของบันทึกลาแทนพนักงาน (กรณีด่วน <48 ชม. หรือพนักงานทักมาบอก) — ไม่ติดกติกาล่วงหน้า; ตั้งแต่วันนี้ถึง 60 วัน; ติดป้ายลาด่วนถ้าใกล้กว่า 48 ชม.
export async function ownerRecordLeave(
  supabase: Admin, branchId: string, staffId: unknown, from: unknown, to: unknown, reason: unknown,
): Promise<{ error: string } | { count: number }> {
  if (typeof staffId !== 'string' || !staffId) return { error: 'ไม่พบพนักงาน' }
  const days = dateRange(from, to)
  if (!days) return { error: 'วันที่ไม่ถูกต้อง' }
  const today = bkkDateStr()
  if (days[0] < today || days[days.length - 1] > addDays(today, SCHEDULE_DAYS - 1)) return { error: 'บันทึกลาได้ตั้งแต่วันนี้ถึง 60 วันข้างหน้า' }
  const { data: staff } = await supabase.from('staff').select('id, branch_id').eq('id', staffId).maybeSingle()
  if (!staff || staff.branch_id !== branchId) return { error: 'พนักงานคนนี้ไม่ได้อยู่สาขานี้' }

  const ctx = await loadCtx(supabase, branchId, days[0], days[days.length - 1])
  const shiftDays = days.filter(d => hasShift(ctx, staffId, d))
  if (shiftDays.length === 0) return { error: 'ช่วงวันนี้คนนี้ไม่มีงาน (หรือลาไปแล้ว)' }

  const why = typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 300) : null
  const now = Date.now()
  const groupId = shiftDays.length > 1 ? crypto.randomUUID() : null
  for (const day of shiftDays) {
    const late = shiftStartMs(day) - now < 48 * 3_600_000
    const existing = ctx.leaves.find(l => l.staffId === staffId && l.day === day)
    if (existing) {
      // มีคำขอรออยู่แล้ว → เจ้าของบันทึกทับให้เป็นอนุมัติ
      await supabase.from('schedule_leaves')
        .update({ status: 'approved', decided_by: 'owner', decided_at: new Date(now).toISOString(), late, reason: why ?? existing.reason })
        .eq('id', existing.id).in('status', ['pending', 'pending_cover'])
    } else {
      const { error } = await supabase.from('schedule_leaves').insert({
        branch_id: branchId, staff_id: staffId, day, status: 'approved', source: 'owner', group_id: groupId, reason: why, late,
        decided_by: 'owner', decided_at: new Date(now).toISOString(),
      })
      if (error) return { error: 'บันทึกไม่สำเร็จ' }
    }
  }
  await dropExtraShifts(supabase, shiftDays.map(day => ({ staffId, day })))
  return { count: shiftDays.length }
}

// เจ้าของยกเลิกการลา (กลับมามีงานตามแบบแผน) — งานเพิ่มที่ลงเองซึ่งถูกตัดตอนลาไม่กลับมา และงานที่คนแทนรับไปยังอยู่ (ลบเองได้จากแผงรายวัน)
export async function ownerCancelLeave(supabase: Admin, branchId: string, leaveId: unknown): Promise<string | null> {
  if (typeof leaveId !== 'string' || !leaveId) return 'ไม่พบการลา'
  const { data, error } = await supabase.from('schedule_leaves')
    .update({ status: 'cancelled', decided_by: 'owner', decided_at: new Date().toISOString() })
    .eq('id', leaveId).eq('branch_id', branchId).in('status', ['pending', 'pending_cover', 'approved']).select('id')
  if (error) return 'ยกเลิกไม่สำเร็จ'
  return !data || data.length === 0 ? 'ไม่พบการลา' : null
}
