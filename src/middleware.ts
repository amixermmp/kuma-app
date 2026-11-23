import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SIGNED_COOKIES, verifyCookieValue } from '@/lib/signedCookie'
import { isOwnerUser } from '@/lib/ownerAuth'

const PUBLIC_PATHS = ['/', '/staff/login', '/owner/login', '/bike', '/contract']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/')) ||
    pathname.startsWith('/qr/') ||
    pathname.startsWith('/api/staff/pin-login')
}

// API พนักงานที่เรียกได้โดยยังไม่มีสิทธิ์พนักงาน (ล็อกอิน/ออกจากระบบ)
const STAFF_API_OPEN = ['/api/staff/pin-login', '/api/staff/login', '/api/staff/logout']
// หน้า/API ของเจ้าของที่ต้องเข้าได้ก่อนล็อกอิน
const OWNER_OPEN = ['/owner/login', '/api/owner/login', '/api/owner/logout']

// ผู้ใช้ Supabase ของ request นี้ (ต่ออายุ session ลงคุกกี้ของ response ด้วย)
async function getSupabaseUser(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          )
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return { user, response }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── ตรวจลายเซ็นคุกกี้สิทธิ์พนักงานทุก request ──
  // ถูกต้อง → ส่งค่าจริง (ไม่มีลายเซ็น) ต่อให้หน้า/API ทุกตัวอ่านแบบเดิม
  // ปลอม/หมดอายุ/รูปแบบเก่า → ตัดทิ้งก่อนถึงโค้ดข้างใน และล้างที่เบราว์เซอร์
  const verified: Record<string, string | null> = {}
  const invalid: string[] = []
  for (const name of SIGNED_COOKIES) {
    const raw = request.cookies.get(name)?.value
    if (raw === undefined) { verified[name] = null; continue }
    const value = await verifyCookieValue(name, raw)
    verified[name] = value
    if (value) request.cookies.set(name, value)
    else { request.cookies.delete(name); invalid.push(name) }
  }
  const finish = (res: NextResponse) => {
    for (const name of invalid) res.cookies.set(name, '', { maxAge: 0, path: '/' })
    return res
  }
  const staffId = verified.kuma_staff_id

  // Public routes — pass through
  if (isPublicPath(pathname)) {
    return finish(NextResponse.next({ request }))
  }

  // API พนักงาน — ต้องมีสิทธิ์พนักงานจริง หรือเป็นบัญชีเจ้าของ (หน้าเจ้าของเรียกบางตัว เช่น อัปโหลดรูป/เพิ่มรถ)
  if (pathname.startsWith('/api/staff/')) {
    if (staffId || STAFF_API_OPEN.some(p => pathname === p || pathname.startsWith(p + '/'))) {
      return finish(NextResponse.next({ request }))
    }
    const { user, response } = await getSupabaseUser(request)
    if (isOwnerUser(user)) return finish(response)
    return finish(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  // Staff routes — check staff cookie (no Supabase auth needed)
  if (pathname.startsWith('/staff/')) {
    if (!staffId) {
      return finish(NextResponse.redirect(new URL('/staff/login', request.url)))
    }

    // บังคับลงทะเบียนเข้างาน — ตั้งแต่ 08:00 เวลาไทยของทุกวัน ถ้ายังไม่เช็คอินวันนี้ เด้งไปหน้าเช็คอินก่อน
    // ทำอย่างอื่นไม่ได้ (คุกกี้ kuma_checkin_date ตั้งตอนเช็คอินสำเร็จ — เร็วกว่า query DB ทุก request)
    if (pathname !== '/staff/checkin') {
      const H7 = 7 * 60 * 60 * 1000
      const bkkNow = new Date(Date.now() + H7)
      const todayStr = bkkNow.toISOString().split('T')[0]
      const pastGateTime = bkkNow.getUTCHours() >= 8
      // ผูกกับ staffId ด้วย (ไม่ใช่แค่วันที่) — กันเครื่อง/แท็บเล็ตที่แชร์กันหลายคน
      // คุกกี้ของคนก่อนหน้าที่เช็คอินไปแล้วทำให้คนถัดไปที่ล็อคอินต่อดูเหมือนเช็คอินแล้วไปด้วย
      const checkinCookie = verified.kuma_checkin_date
      // บัญชีเจ้าของ: บัตรผ่านต้องตรงกับรหัสบัญชีที่ล็อกอินอยู่ (ไม่ผูกวัน ล็อกอินข้ามคืนก็ไม่เด้ง)
      const isOwnerPass = verified.kuma_owner_pass === staffId
      // "ดูตารางอย่างเดียว" (คนที่ไม่มีงานวันนี้ เลือกที่หน้าเช็คอิน): ผ่านด่านได้เฉพาะหน้าปฏิทินงาน ไม่ใช่หน้าอื่น
      const viewOnlySchedule = verified.kuma_schedule_view === `${staffId}:${todayStr}`
        && (pathname === '/staff/schedule' || pathname.startsWith('/staff/schedule/'))
      if (pastGateTime && checkinCookie !== `${staffId}:${todayStr}` && !isOwnerPass && !viewOnlySchedule) {
        const url = new URL('/staff/checkin', request.url)
        url.searchParams.set('redirect', pathname)
        return finish(NextResponse.redirect(url))
      }
    }

    return finish(NextResponse.next({ request }))
  }

  // Owner routes — refresh Supabase session ให้ token ต่ออายุอัตโนมัติ + รับเฉพาะบัญชีเจ้าของ
  // (ยังไม่ล็อกอิน → ปล่อยให้หน้า/API จัดการเองแบบเดิม; ล็อกอินแล้วแต่ไม่ใช่เจ้าของ → ไม่ให้เข้า)
  if (pathname.startsWith('/owner/') || pathname.startsWith('/api/owner/')) {
    const { user, response } = await getSupabaseUser(request)
    const open = OWNER_OPEN.some(p => pathname === p || pathname.startsWith(p + '/'))
    if (user && !isOwnerUser(user) && !open) {
      if (pathname.startsWith('/api/')) return finish(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      return finish(NextResponse.redirect(new URL('/owner/login', request.url)))
    }
    return finish(response)
  }

  return finish(NextResponse.next({ request }))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
