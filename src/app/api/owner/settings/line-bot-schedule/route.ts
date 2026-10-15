import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DAY_KEYS, toMinutes, type DayRule } from '@/lib/botSchedule'

// ตรวจกฎของวัน: mode ต้องถูก และถ้าเป็นช่วงเวลา start/end ต้องเป็น HH:mm
function cleanRule(raw: unknown): DayRule | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { mode?: unknown; start?: unknown; end?: unknown }
  if (r.mode === 'all' || r.mode === 'off') return { mode: r.mode }
  if (r.mode === 'range' && toMinutes(r.start) != null && toMinutes(r.end) != null) {
    return { mode: 'range', start: r.start as string, end: r.end as string }
  }
  return null
}

// ตั้งเวลาที่บอทตอบ (เจ้าของเท่านั้น) — schedule = ตารางประจำสัปดาห์, today = ตั้งเฉพาะวันนั้น (null = ล้าง)
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { branch_id } = body
  if (!branch_id) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const fields: Record<string, unknown> = {}

  if ('schedule' in body) {
    if (body.schedule === null) {
      fields.line_bot_schedule = null
    } else {
      const schedule: Record<string, DayRule> = {}
      for (const key of DAY_KEYS) {
        if (!(key in (body.schedule ?? {}))) continue
        const rule = cleanRule(body.schedule[key])
        if (!rule) return NextResponse.json({ error: `เวลาของวัน ${key} ไม่ถูกต้อง` }, { status: 400 })
        schedule[key] = rule
      }
      fields.line_bot_schedule = schedule
    }
  }

  if ('today' in body) {
    if (body.today === null) {
      fields.line_bot_today_override = null
    } else {
      const rule = cleanRule(body.today)
      if (!rule || typeof body.today.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.today.date)) {
        return NextResponse.json({ error: 'เวลาของวันนี้ไม่ถูกต้อง' }, { status: 400 })
      }
      fields.line_bot_today_override = { ...rule, date: body.today.date }
    }
  }

  if (Object.keys(fields).length === 0) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existing } = await admin.from('branch_settings').select('branch_id').eq('branch_id', branch_id).maybeSingle()
  const { error } = existing
    ? await admin.from('branch_settings').update(fields).eq('branch_id', branch_id)
    : await admin.from('branch_settings').insert({ branch_id, ...fields })

  if (error) {
    const missingColumn = /line_bot_(schedule|today_override)/.test(error.message)
    return NextResponse.json({ error: missingColumn ? 'ยังไม่ได้เพิ่มคอลัมน์ในฐานข้อมูล — ให้รัน supabase-migration-line-bot-schedule.sql ก่อน' : error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
