import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkBlacklist } from '@/lib/blacklist'

// เช็คชื่อ/เบอร์กับบัญชีดำของร้าน — ใช้ขึ้นป้ายแดงในฟอร์มส่งรถ
export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const name = request.nextUrl.searchParams.get('name')
  const phone = request.nextUrl.searchParams.get('phone')
  const idCardNumber = request.nextUrl.searchParams.get('idCardNumber')

  const supabase = createAdminClient()
  const hit = await checkBlacklist(supabase, { name, phone, idCardNumber })

  return NextResponse.json({ blacklisted: !!hit, hit })
}
