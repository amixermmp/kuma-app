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

  const { selfiePhotoUrl, platePhotos, manuallyFoundPlates, explanation } = await request.json()
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

  // รวมป้ายที่ "พบแล้ว" จาก OCR จริง (จาก platePhotos ที่ client ส่งมาพร้อมรูป) + ที่พนักงานแตะยืนยันเอง
  // ไม่เชื่อ "foundPlates" ที่ client อาจส่งมาตรงๆ โดยไม่มีรูป/เหตุผลรองรับ
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detectedAll: string[] = (platePhotos ?? []).flatMap((p: any) => Array.isArray(p?.detectedPlates) ? p.detectedPlates : [])
  const foundSet = new Set<string>([
    ...detectedAll.map(normalizePlate),
    ...((manuallyFoundPlates ?? []) as string[]).map(normalizePlate),
  ])
  const found = expectedPlates.filter(p => foundSet.has(normalizePlate(p)))
  const missing = expectedPlates.filter(p => !foundSet.has(normalizePlate(p)))

  if (missing.length > 0 && !explanation?.trim()) {
    return NextResponse.json({ error: 'กรุณาอธิบายรถที่ยังหาไม่พบ' }, { status: 400 })
  }

  const { data: session, error } = await admin
    .from('staff_closeshops')
    .insert({
      staff_id: staffId,
      branch_id: branchId,
      selfie_photo_url: selfiePhotoUrl,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      plate_photos: (platePhotos ?? []).map((p: any) => ({ url: p.url, detectedPlates: p.detectedPlates ?? [] })),
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
