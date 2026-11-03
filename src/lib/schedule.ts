import { createAdminClient } from '@/lib/supabase/admin'
import {
  DEFAULT_COUNTS, isDateStr, staffOnDate, validatePattern,
  type DayType, type SchedulePattern, type ScheduleCounts,
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

// วิธีเช็คอินของวันนี้: 'normal' = ฟอร์มถ่ายรูปปกติ / 'off_shift' = เป็นคนมีแบบแผนแต่วันนี้ไม่มีเวร → ถามว่าเข้าทำงานหรือดูตารางอย่างเดียว
export async function getCheckinMode(supabase: Admin, staffId: string, branchId: string, today: string): Promise<'normal' | 'off_shift'> {
  const cfg = await loadScheduleConfig(supabase, branchId)
  if (!cfg.enabled) return 'normal'
  const { data } = await supabase.from('schedule_patterns')
    .select('id, staff_id, weekdays, start_date, end_date').eq('staff_id', staffId).eq('branch_id', branchId)
  if (!data || data.length === 0) return 'normal'
  return staffOnDate(data.map(r => toPattern(r as PatternRow)), today).includes(staffId) ? 'normal' : 'off_shift'
}

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
