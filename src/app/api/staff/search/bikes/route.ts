import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffBranchIds } from '@/lib/staffBranch'
import { searchBikes } from '@/lib/bikeSearch'

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const supabase = createAdminClient()

  // Get staff's allowed branches
  const allowedBranchIds = await getStaffBranchIds(staffId)

  // ตรรกะค้นหาอยู่ที่ตัวกลาง — LINE chatbot ใช้ตัวเดียวกัน ผลจะตรงกันเสมอ
  return NextResponse.json(await searchBikes(supabase, allowedBranchIds, from, to))
}
