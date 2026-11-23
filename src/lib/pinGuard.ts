import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { linePush, textMessage } from '@/lib/line'

// กันสุ่ม PIN พนักงาน (PIN 6 หลัก = 1 ล้านแบบ เดิมลองได้ไม่จำกัด)
// - ต่อ IP: ผิด 5 ครั้งใน 15 นาที → ล็อก IP นั้นจนครบ 15 นาทีนับจากครั้งที่ผิด
// - ทั้งระบบ: ผิดรวม 60 ครั้งใน 15 นาที (กันคนยิงจากหลาย IP) → ล็อกทุกคน แลกกับการที่พนักงานเข้าไม่ได้ชั่วคราวระหว่างถูกโจมตี
// - ใส่ถูก → ล้างครั้งที่ผิดของ IP นั้น (ร้านใช้ wifi เดียวกันหลายคน กดผิดสะสมจะได้ไม่ล็อกทั้งร้าน)
// - ไลน์เตือนกลุ่มรายงานของเจ้าของตอนเริ่มล็อก
// ตาราง/ฐานข้อมูลมีปัญหา → ปล่อยผ่าน (ไม่ให้พนักงานทั้งร้านล็อกอินไม่ได้เพราะระบบกันสุ่มเอง)

const WINDOW_MS = 15 * 60 * 1000
const IP_MAX_FAILS = 5
const GLOBAL_MAX_FAILS = 60

export function clientIp(request: NextRequest): string {
  return request.headers.get('x-real-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? 'unknown'
}

/** ล็อกอยู่ไหม — คืนจำนวนนาทีที่ต้องรอ (0 = ไม่ล็อก) */
export async function pinLockMinutes(ip: string): Promise<number> {
  try {
    const db = createAdminClient()
    const since = new Date(Date.now() - WINDOW_MS).toISOString()
    const [{ data: ipFails, error: e1 }, { count: globalFails, error: e2 }] = await Promise.all([
      db.from('staff_login_attempts').select('created_at')
        .eq('ip', ip).eq('success', false).gte('created_at', since)
        .order('created_at', { ascending: false }).limit(IP_MAX_FAILS),
      db.from('staff_login_attempts').select('id', { count: 'exact', head: true })
        .eq('success', false).gte('created_at', since),
    ])
    if (e1 || e2) throw e1 ?? e2
    if ((ipFails?.length ?? 0) >= IP_MAX_FAILS) {
      const unlockAt = new Date(ipFails![IP_MAX_FAILS - 1].created_at).getTime() + WINDOW_MS
      return Math.max(1, Math.ceil((unlockAt - Date.now()) / 60_000))
    }
    if ((globalFails ?? 0) >= GLOBAL_MAX_FAILS) return 15
    return 0
  } catch (err) {
    console.error('[pinGuard] check failed — allowing login:', err)
    return 0
  }
}

/** บันทึกผลการใส่ PIN (+ เตือนเจ้าของตอนเริ่มล็อก) */
export async function recordPinAttempt(ip: string, success: boolean): Promise<void> {
  try {
    const db = createAdminClient()
    const since = new Date(Date.now() - WINDOW_MS).toISOString()
    if (success) {
      await db.from('staff_login_attempts').delete().eq('ip', ip).eq('success', false).gte('created_at', since)
      // เก็บประวัติแค่ 30 วัน
      await db.from('staff_login_attempts').delete().lt('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString())
      return
    }
    await db.from('staff_login_attempts').insert({ ip, success: false })
    const [{ count: ipFails }, { count: globalFails }] = await Promise.all([
      db.from('staff_login_attempts').select('id', { count: 'exact', head: true }).eq('ip', ip).eq('success', false).gte('created_at', since),
      db.from('staff_login_attempts').select('id', { count: 'exact', head: true }).eq('success', false).gte('created_at', since),
    ])
    // เตือนครั้งเดียวตอนเพิ่งถึงเกณฑ์ (ไม่เตือนซ้ำทุกครั้งที่ยิงต่อ)
    if (globalFails === GLOBAL_MAX_FAILS) {
      await alertOwner(`🚨 มีการใส่ PIN พนักงานผิดรวม ${GLOBAL_MAX_FAILS} ครั้งใน 15 นาที (อาจมีคนพยายามสุ่ม PIN จากหลายที่) — ระบบล็อกการเข้าหน้าพนักงานทุกคน 15 นาที`)
    } else if (ipFails === IP_MAX_FAILS) {
      await alertOwner(`⚠️ มีการใส่ PIN พนักงานผิด ${IP_MAX_FAILS} ครั้งติดกัน (IP ${ip}) — ระบบล็อก IP นี้ 15 นาทีแล้ว\nถ้าไม่ใช่พนักงานกดผิดเอง อาจมีคนพยายามสุ่ม PIN`)
    }
  } catch (err) {
    console.error('[pinGuard] record failed:', err)
  }
}

async function alertOwner(text: string) {
  const db = createAdminClient()
  const { data: shop } = await db.from('shop_settings').select('line_token, line_target_id').limit(1).maybeSingle()
  if (shop?.line_token && shop.line_target_id) await linePush(shop.line_token, shop.line_target_id, [textMessage(text)])
}
