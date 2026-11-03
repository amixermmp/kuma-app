import { createAdminClient } from '@/lib/supabase/admin'
import {
  DEFAULT_COUNTS, SCHEDULE_DAYS, addDays, bkkDateStr, dayTypeFor, isDateStr, openSlots, patternStaffOnDate, staffOnDate, validatePattern,
  type DayType, type ExtraShift, type LeaveMark, type SchedulePattern, type ScheduleCounts,
} from '@/lib/scheduleCalc'

// ตารางเวรพนักงานพาร์ทไทม์: ส่วนฝั่งเซิร์ฟเวอร์ (ดึง/บันทึกข้อมูล + ตัดสินวิธีเช็คอินของวันนี้)
// หลักการ: ระบบนี้กระทบเฉพาะ "คนที่เจ้าของตั้งแบบแผนให้" ในสาขาที่เปิดสวิตช์ — พนักงานประจำ/เจ้าของที่ไม่มีแบบแผนใช้เช็คอินเดิมทุกอย่าง
type Admin = ReturnType<typeof createAdminClient>

export type ScheduleConfig = { enabled: boolean; counts: ScheduleCounts }

export async function loadScheduleConfig(supabase: Admin, branchId: string): Promise<ScheduleConfig> {
  const { data } = await supabase.from('schedule_settings')
    .select('enabled, weekday_min, weekday_target, weekend_min, weekend_target')
    .eq('branch_id', branchId).maybeSingle()
  if (!data) return { enabled: false, counts: DEFAULT_COUNTS }
  return {
    enabled: !!data.enabled,
    counts: { weekdayMin: data.weekday_min, weekdayTarget: data.weekday_target, weekendMin: data.weekend_min, weekendTarget: data.weekend_target },
  }
}

type PatternRow = { id: string; staff_id: string; weekdays: number[]; start_date: string; end_date: string }
const toPattern = (r: PatternRow): SchedulePattern => ({ id: r.id, staffId: r.staff_id, weekdays: r.weekdays ?? [], startDate: r.start_date, endDate: r.end_date })

export async function loadPatterns(supabase: Admin, branchId: string): Promise<SchedulePattern[]> {
  const { data } = await supabase.from('schedule_patterns')
    .select('id, staff_id, weekdays, start_date, end_date').eq('branch_id', branchId).order('start_date')
  return (data ?? []).map(r => toPattern(r as PatternRow))
}

export async function loadOverrides(supabase: Admin, branchId: string, from: string, to: string): Promise<Record<string, DayType>> {
  const { data } = await supabase.from('schedule_day_overrides')
    .select('day, day_type').eq('branch_id', branchId).gte('day', from).lte('day', to)
  const out: Record<string, DayType> = {}
  for (const r of data ?? []) out[r.day as string] = r.day_type as DayType
  return out
}

export async function loadExtraShifts(supabase: Admin, branchId: string, from: string, to: string): Promise<ExtraShift[]> {
  const { data } = await supabase.from('schedule_extra_shifts')
    .select('staff_id, day').eq('branch_id', branchId).gte('day', from).lte('day', to)
  return (data ?? []).map(r => ({ staffId: r.staff_id as string, day: r.day as string }))
}

// วิธีเช็คอินของวันนี้: 'normal' = ฟอร์มถ่ายรูปปกติ / 'off_shift' = เป็นคนมีแบบแผนแต่วันนี้ไม่มีเวร → ถามว่าเข้าทำงานหรือดูตารางอย่างเดียว
// เวรที่ลงเพิ่มรายวัน (ลงเอง/เจ้าของเพิ่มให้) นับเป็น "มีเวร" ด้วย
export async function getCheckinMode(supabase: Admin, staffId: string, branchId: string, today: string): Promise<'normal' | 'off_shift'> {
  const cfg = await loadScheduleConfig(supabase, branchId)
  if (!cfg.enabled) return 'normal'
  const { data } = await supabase.from('schedule_patterns')
    .select('id, staff_id, weekdays, start_date, end_date').eq('staff_id', staffId).eq('branch_id', branchId)
  if (!data || data.length === 0) return 'normal'
  const [extras, leaves] = await Promise.all([loadExtraShifts(supabase, branchId, today, today), loadLeaves(supabase, branchId, today, today)])
  const marks = approvedMarks(leaves).filter(l => l.staffId === staffId)   // ลาอนุมัติแล้ววันนี้ = ไม่มีเวร
  return staffOnDate(data.map(r => toPattern(r as PatternRow)), today, extras.filter(e => e.staffId === staffId), marks).includes(staffId) ? 'normal' : 'off_shift'
}

// ── การลาที่ยังใช้งานอยู่ (รออนุมัติ/อนุมัติแล้ว) — ฟังก์ชันขอลา/อนุมัติอยู่ใน scheduleLeave.ts ───────────────
export type LeaveStatus = 'pending_cover' | 'pending' | 'approved'
export type LeaveRow = {
  id: string; staffId: string; day: string; status: LeaveStatus
  coverStaffId: string | null; groupId: string | null; reason: string | null; late: boolean; source: 'staff' | 'owner'
}

export async function loadLeaves(supabase: Admin, branchId: string, from: string, to: string): Promise<LeaveRow[]> {
  const { data } = await supabase.from('schedule_leaves')
    .select('id, staff_id, day, status, cover_staff_id, group_id, reason, late, source')
    .eq('branch_id', branchId).gte('day', from).lte('day', to).in('status', ['pending_cover', 'pending', 'approved']).order('day')
  return (data ?? []).map(r => ({
    id: r.id, staffId: r.staff_id, day: r.day, status: r.status as LeaveStatus, coverStaffId: r.cover_staff_id,
    groupId: r.group_id, reason: r.reason, late: !!r.late, source: r.source as 'staff' | 'owner',
  }))
}

// เฉพาะที่อนุมัติแล้วเท่านั้นที่ตัดคนออกจากวัน (คำขอที่ยังรออยู่ยังนับว่ามาทำงานตามปกติ)
export const approvedMarks = (leaves: LeaveRow[]): LeaveMark[] =>
  leaves.filter(l => l.status === 'approved').map(l => ({ staffId: l.staffId, day: l.day }))

// ── บันทึก (เจ้าของเท่านั้น — เรียกจาก API ที่ตรวจสิทธิ์แล้ว) ────────────────────────────────
const cleanCount = (v: unknown) => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n >= 0 && n <= 30 ? n : null
}

export async function saveScheduleSettings(
  supabase: Admin, branchId: string, input: { enabled: unknown; counts: Partial<Record<keyof ScheduleCounts, unknown>> },
): Promise<string | null> {
  const wMin = cleanCount(input.counts.weekdayMin), wT = cleanCount(input.counts.weekdayTarget)
  const eMin = cleanCount(input.counts.weekendMin), eT = cleanCount(input.counts.weekendTarget)
  if (wMin == null || wT == null || eMin == null || eT == null) return 'จำนวนคนต้องเป็นเลข 0-30'
  if (wMin > wT || eMin > eT) return 'จำนวนขั้นต่ำต้องไม่เกินจำนวนที่ต้องการ'
  const { error } = await supabase.from('schedule_settings').upsert({
    branch_id: branchId, enabled: input.enabled === true,
    weekday_min: wMin, weekday_target: wT, weekend_min: eMin, weekend_target: eT,
  })
  return error ? 'บันทึกไม่สำเร็จ' : null
}

export async function saveSchedulePattern(
  supabase: Admin,
  input: { id?: unknown; staffId: unknown; branchId: string; weekdays: unknown; startDate: unknown; endDate: unknown },
): Promise<{ error: string } | { id: string }> {
  if (typeof input.staffId !== 'string' || !input.staffId) return { error: 'ไม่พบพนักงาน' }
  const { data: staff } = await supabase.from('staff').select('id, branch_id').eq('id', input.staffId).maybeSingle()
  if (!staff || staff.branch_id !== input.branchId) return { error: 'พนักงานคนนี้ไม่ได้อยู่สาขานี้' }

  const { data: existing } = await supabase.from('schedule_patterns')
    .select('id, start_date, end_date').eq('staff_id', input.staffId).eq('branch_id', input.branchId)
  const selfId = typeof input.id === 'string' ? input.id : undefined
  const err = validatePattern(
    { weekdays: input.weekdays, startDate: input.startDate, endDate: input.endDate },
    (existing ?? []).map(e => ({ id: e.id, startDate: e.start_date, endDate: e.end_date })), selfId,
  )
  if (err) return { error: err }

  const weekdays = Array.from(new Set((input.weekdays as number[]))).sort((a, b) => a - b)
  const row = { staff_id: input.staffId, branch_id: input.branchId, weekdays, start_date: input.startDate as string, end_date: input.endDate as string }
  if (selfId) {
    const { data, error } = await supabase.from('schedule_patterns').update(row).eq('id', selfId).eq('branch_id', input.branchId).select('id').maybeSingle()
    return error || !data ? { error: 'บันทึกไม่สำเร็จ' } : { id: data.id }
  }
  const { data, error } = await supabase.from('schedule_patterns').insert(row).select('id').maybeSingle()
  return error || !data ? { error: 'บันทึกไม่สำเร็จ' } : { id: data.id }
}

export async function deleteSchedulePattern(supabase: Admin, branchId: string, id: unknown): Promise<string | null> {
  if (typeof id !== 'string' || !id) return 'ไม่พบแบบแผน'
  const { error } = await supabase.from('schedule_patterns').delete().eq('id', id).eq('branch_id', branchId)
  return error ? 'ลบไม่สำเร็จ' : null
}

// type = null → ล้างการกำหนดทับ (กลับไปตามวันในสัปดาห์)
export async function setScheduleDayType(supabase: Admin, branchId: string, day: unknown, type: unknown): Promise<string | null> {
  if (!isDateStr(day)) return 'วันที่ไม่ถูกต้อง'
  if (type === null) {
    const { error } = await supabase.from('schedule_day_overrides').delete().eq('branch_id', branchId).eq('day', day)
    return error ? 'บันทึกไม่สำเร็จ' : null
  }
  if (type !== 'weekday' && type !== 'weekend') return 'ประเภทวันไม่ถูกต้อง'
  const { error } = await supabase.from('schedule_day_overrides').upsert({ branch_id: branchId, day, day_type: type })
  return error ? 'บันทึกไม่สำเร็จ' : null
}

// ── เวรเพิ่มรายวัน ────────────────────────────────────────────────────────────────────────────

// พนักงานกด "ลงเวรนี้" ในวันที่ยังไม่เต็มเป้า — ใครไวได้ก่อน ลงแล้วถอนเองไม่ได้ (ต้องใช้ระบบลา)
// ผ่านฟังก์ชันฐานข้อมูล claim_schedule_shift ที่ล็อกต่อวัน (กดพร้อมกันได้คนเดียว) — เซิร์ฟเวอร์ใช้ service role เท่านั้น
export async function claimScheduleShift(
  supabase: Admin, staffId: string, branchId: string, day: unknown,
): Promise<{ ok: true } | { error: string; code: 'invalid' | 'full' | 'dup' | 'forbidden' }> {
  if (!isDateStr(day)) return { error: 'วันที่ไม่ถูกต้อง', code: 'invalid' }
  const today = bkkDateStr()
  if (day <= today || day > addDays(today, SCHEDULE_DAYS - 1)) {
    return { error: 'ลงเวรได้ตั้งแต่พรุ่งนี้ถึง 60 วันข้างหน้าเท่านั้น', code: 'invalid' }
  }

  const cfg = await loadScheduleConfig(supabase, branchId)
  if (!cfg.enabled) return { error: 'สาขานี้ยังไม่เปิดใช้ตารางเวร', code: 'forbidden' }
  const { data: staff } = await supabase.from('staff').select('id, branch_id, is_active').eq('id', staffId).maybeSingle()
  if (!staff || staff.branch_id !== branchId || !staff.is_active) return { error: 'บัญชีนี้ลงเวรสาขานี้ไม่ได้', code: 'forbidden' }

  // สิทธิ์: เฉพาะคนที่เจ้าของตั้งแบบแผนไว้ (พาร์ทไทม์ในตาราง)
  const [patterns, overrides, extras, leaves] = await Promise.all([
    loadPatterns(supabase, branchId),
    loadOverrides(supabase, branchId, day, day),
    loadExtraShifts(supabase, branchId, day, day),
    loadLeaves(supabase, branchId, day, day),
  ])
  if (!patterns.some(p => p.staffId === staffId)) return { error: 'คุณยังไม่ได้อยู่ในตารางเวร — ทักหาพี่เจ้าของร้าน', code: 'forbidden' }

  // คนที่มีคำขอลา/ลาแล้ววันนั้นลงวันเดียวกันไม่ได้; คนที่ลาอนุมัติแล้วไม่นับเป็นคนในวัน → ที่ว่างเพิ่ม
  if (leaves.some(l => l.staffId === staffId)) return { error: 'คุณมีคำขอลาวันนั้นอยู่แล้ว', code: 'dup' }
  const onLeave = new Set(approvedMarks(leaves).map(l => l.staffId))
  const fromPattern = patternStaffOnDate(patterns, day).filter(id => !onLeave.has(id))
  if (fromPattern.includes(staffId) || extras.some(e => e.staffId === staffId)) {
    return { error: 'คุณมีเวรวันนั้นอยู่แล้ว', code: 'dup' }
  }
  // ที่ว่างสำหรับเวรที่ลงเพิ่ม = เป้า − คนตามแบบแผน (ฟังก์ชันฐานข้อมูลนับเวรเพิ่มที่มีอยู่ภายใต้ล็อกอีกชั้น)
  const slots = openSlots(fromPattern.length, dayTypeFor(day, overrides), cfg.counts)
  if (slots <= 0) return { error: 'วันนี้เต็มแล้ว', code: 'full' }

  const { data, error } = await supabase.rpc('claim_schedule_shift', { p_branch: branchId, p_staff: staffId, p_day: day, p_open_slots: slots })
  if (error) return { error: 'ลงเวรไม่สำเร็จ ลองอีกครั้ง', code: 'invalid' }
  if (data === 'full') return { error: 'เต็มแล้ว — มีคนลงตัดหน้าไปก่อน', code: 'full' }
  if (data === 'dup') return { error: 'คุณมีเวรวันนั้นอยู่แล้ว', code: 'dup' }
  return { ok: true }
}

// เจ้าของเพิ่มคนลงวันไหนก็ได้ (เกินเป้าได้) — ห้ามซ้ำกับวันที่คนนั้นมีเวรตามแบบแผนอยู่แล้ว
export async function addOwnerExtraShift(supabase: Admin, branchId: string, staffId: unknown, day: unknown): Promise<string | null> {
  if (typeof staffId !== 'string' || !staffId) return 'ไม่พบพนักงาน'
  if (!isDateStr(day)) return 'วันที่ไม่ถูกต้อง'
  const { data: staff } = await supabase.from('staff').select('id, branch_id').eq('id', staffId).maybeSingle()
  if (!staff || staff.branch_id !== branchId) return 'พนักงานคนนี้ไม่ได้อยู่สาขานี้'
  const patterns = await loadPatterns(supabase, branchId)
  if (patternStaffOnDate(patterns, day).includes(staffId)) return 'คนนี้มีเวรตามแบบแผนวันนั้นอยู่แล้ว'
  const { error } = await supabase.from('schedule_extra_shifts')
    .upsert({ branch_id: branchId, staff_id: staffId, day, source: 'owner' }, { onConflict: 'staff_id,day', ignoreDuplicates: true })
  return error ? 'บันทึกไม่สำเร็จ' : null
}

// ลบเวรที่ลงเพิ่ม (ลงเอง/เจ้าของเพิ่ม) — ไม่แตะเวรตามแบบแผน (ลาเวรตามแบบแผนเป็นเรื่องของระบบลา)
export async function removeExtraShift(supabase: Admin, branchId: string, staffId: unknown, day: unknown): Promise<string | null> {
  if (typeof staffId !== 'string' || !staffId) return 'ไม่พบพนักงาน'
  if (!isDateStr(day)) return 'วันที่ไม่ถูกต้อง'
  const { error } = await supabase.from('schedule_extra_shifts').delete().eq('branch_id', branchId).eq('staff_id', staffId).eq('day', day)
  return error ? 'ลบไม่สำเร็จ' : null
}
