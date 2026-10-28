import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const pin = searchParams.get('pin') ?? ''
  const bikeId = searchParams.get('bikeId') ?? ''
  const redirect = searchParams.get('redirect') ?? '/staff/home'

  if (pin.length !== 6) {
    return NextResponse.redirect(new URL(`/bike/${bikeId}?error=pin`, request.url))
  }

  const supabase = createAdminClient()
  const { data: staff } = await supabase
    .from('staff')
    .select('id, name, role, branch_id, branches(name)')
    .eq('pin', pin)
    .eq('is_active', true)
    .maybeSingle()

  if (!staff) {
    return NextResponse.redirect(new URL(`/bike/${bikeId}?error=pin`, request.url))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const branchName = (staff as any).branches?.name ?? 'Kuma Bikes'

  const cookieOpts = {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 12,
    path: '/',
  }

  const res = NextResponse.redirect(new URL(redirect, request.url))
  res.cookies.set('kuma_staff_id', staff.id, { ...cookieOpts, httpOnly: true })
  res.cookies.set('kuma_staff_name', staff.name, cookieOpts)
  res.cookies.set('kuma_branch_name', branchName, cookieOpts)
  // บัญชีเจ้าของ (role = owner) ข้ามการเช็คอินเข้างาน: บัตรผ่านผูกกับรหัสบัญชี ใช้ข้ามบัญชีไม่ได้ (middleware เทียบกับ kuma_staff_id)
  // บัญชีปกติล้างบัตรผ่านเดิมทิ้ง กันเครื่องที่แชร์กันหลุดสิทธิ์จากคนก่อนหน้า
  if ((staff as { role?: string }).role === 'owner') {
    res.cookies.set('kuma_owner_pass', staff.id, { ...cookieOpts, httpOnly: true })
  } else {
    res.cookies.set('kuma_owner_pass', '', { maxAge: 0, path: '/' })
  }
  return res
}
