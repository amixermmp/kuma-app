import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const { pin } = await request.json()

  if (!pin || String(pin).length !== 6) {
    return NextResponse.json({ error: 'PIN ไม่ถูกต้อง' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: staff } = await supabase
    .from('staff')
    .select('id, name, role, branch_id, branches(name)')
    .eq('pin', String(pin))
    .eq('is_active', true)
    .maybeSingle()

  if (!staff) {
    return NextResponse.json({ error: 'PIN ไม่ถูกต้อง' }, { status: 401 })
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

  const res = NextResponse.json({ success: true })
  res.cookies.set('kuma_staff_id', staff.id, { ...cookieOpts, httpOnly: true })
  res.cookies.set('kuma_staff_name', staff.name, cookieOpts)
  res.cookies.set('kuma_branch_name', branchName, cookieOpts)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.cookies.set('kuma_staff_role', (staff as any).role ?? 'staff', cookieOpts)
  return res
}
