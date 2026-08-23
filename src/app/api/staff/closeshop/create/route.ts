import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffOwnBranchId } from '@/lib/staffBranch'
import { getShopOverviewGroups } from '@/lib/shopOverview'
import { normalizePlate } from '@/lib/plate'
import { logStaffAction } from '@/lib/log'
import { linePush, textMessage } from '@/lib/line'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { selfiePhotoUrl, plateEntries, manuallyConfirmedPlates, explanation } = await request.json()
  if (!selfiePhotoUrl) return NextResponse.json({ error: 'ไม่มีรูปถ่ายคู่ร้าน' }, { status: 400 })

  const admin = createAdminClient()
  const branchId = await getStaffOwnBranchId(staffId)

  // เช็คเวลาซ้ำฝั่ง server — ไม่เชื่อว่า client เข้าถึงหน้านี้อย่างถูกต้อง
  const { data: branchSettings } = await admin
    .from('branch_settings')
    .select('close_time_earliest')
    .eq('branch_id', branchId)
    .maybeSingle()
  const H7 = 7 * 60 * 60 * 1000
  const bkk = new Date(Date.now() + H7)
  const nowHM = `${String(bkk.getUTCHours()).padStart(2, '0')}:${String(bkk.getUTCMinutes()).padStart(2, '0')}`
  if (branchSettings?.close_time_earliest && nowHM < branchSettings.close_time_earliest) {
    return NextResponse.json({ error: 'ยังไม่ถึงเวลาปิดร้าน' }, { status: 400 })
  }

  // คำนวณรถที่ควรอยู่ร้านใหม่จาก DB เอง — ไม่เชื่อ list ที่ client ส่งมา
  const groups = await getShopOverviewGroups(admin, [branchId])
  const expectedPlates: string[] = [
    ...groups.atShop.map(b => b.licensePlate),
    ...groups.repairs.filter(r => r.locationType === 'shop').map(r => r.licensePlate),
  ]

  // ผูกรูปเข้ากับป้ายที่ถูกอ้างตามที่ client ส่งมา แล้วเช็คซ้ำฝั่ง server ว่าบอทอ่านได้ตรงกับป้ายนั้นจริงไหม
  // ไม่เชื่อ "found/matched" ที่ client อาจส่งมาตรงๆ — คำนวณ botVerified ใหม่จาก detectedPlates ดิบเสมอ
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entryByPlate = new Map<string, any>(
    (plateEntries ?? []).map((e: any) => [normalizePlate(e?.plate ?? ''), e])
  )
  const manualSet = new Set<string>(((manuallyConfirmedPlates ?? []) as string[]).map(normalizePlate))

  const found = expectedPlates.filter(p => {
    const np = normalizePlate(p)
    const entry = entryByPlate.get(np)
    const botMatch = Array.isArray(entry?.detectedPlates) && entry.detectedPlates.some((d: string) => normalizePlate(d) === np)
    return botMatch || manualSet.has(np)
  })
  const missing = expectedPlates.filter(p => !found.includes(p))

  if (missing.length > 0 && !explanation?.trim()) {
    return NextResponse.json({ error: 'กรุณาอธิบายรถที่ยังหาไม่พบ' }, { status: 400 })
  }

  const plate_photos = expectedPlates
    .map(p => entryByPlate.get(normalizePlate(p)))
    .filter(Boolean)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((e: any) => {
      const np = normalizePlate(e.plate)
      const detectedPlates: string[] = Array.isArray(e.detectedPlates) ? e.detectedPlates : []
      return {
        plate: e.plate,
        url: e.url,
        detectedPlates,
        botVerified: detectedPlates.some(d => normalizePlate(d) === np),
      }
    })

  const { data: session, error } = await admin
    .from('staff_closeshops')
    .insert({
      staff_id: staffId,
      branch_id: branchId,
      selfie_photo_url: selfiePhotoUrl,
      plate_photos,
      expected_plates: expectedPlates,
      found_plates: found,
      missing_plates: missing,
      explanation: explanation?.trim() || null,
    })
    .select('id')
    .single()

  if (error || !session) {
    console.error('closeshop create error:', error?.message)
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
  }

  await logStaffAction(staffId, 'staff_closeshop', `ปิดร้าน — พบ ${found.length}/${expectedPlates.length} คัน`, { missing })

  if (missing.length > 0) {
    const [{ data: shop }, { data: branch }, { data: staffRow }] = await Promise.all([
      admin.from('shop_settings').select('line_token, line_target_id').limit(1).maybeSingle(),
      admin.from('branches').select('name').eq('id', branchId).single(),
      admin.from('staff').select('name').eq('id', staffId).single(),
    ])
    if (shop?.line_token && shop.line_target_id) {
      const msg = `🚨 ปิดร้าน ${branch?.name ?? ''} — รถหาย/ไม่พบ ${missing.length} คัน\n\n` +
        missing.map(p => `• ${p}`).join('\n') +
        `\n\nเหตุผล: ${explanation?.trim() || '-'}\nโดย: ${staffRow?.name ?? ''}`
      await linePush(shop.line_token, shop.line_target_id, [textMessage(msg)])
    }
  }

  return NextResponse.json({ success: true, found: found.length, expected: expectedPlates.length, missing })
}
