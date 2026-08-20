import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/', '/staff/login', '/owner/login', '/bike', '/contract']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/')) ||
    pathname.startsWith('/qr/') ||
    pathname.startsWith('/api/staff/pin-login')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes — pass through
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Staff routes — check staff cookie (no Supabase auth needed)
  if (pathname.startsWith('/staff/')) {
    const staffId = request.cookies.get('kuma_staff_id')?.value
    if (!staffId) {
      return NextResponse.redirect(new URL('/staff/login', request.url))
    }

    // บังคับลงทะเบียนเข้างาน — ตั้งแต่ 08:00 เวลาไทยของทุกวัน ถ้ายังไม่เช็คอินวันนี้ เด้งไปหน้าเช็คอินก่อน
    // ทำอย่างอื่นไม่ได้ (คุกกี้ kuma_checkin_date ตั้งตอนเช็คอินสำเร็จ — เร็วกว่า query DB ทุก request)
    if (pathname !== '/staff/checkin') {
      const H7 = 7 * 60 * 60 * 1000
      const bkkNow = new Date(Date.now() + H7)
      const todayStr = bkkNow.toISOString().split('T')[0]
      const pastGateTime = bkkNow.getUTCHours() >= 8
      const checkinDate = request.cookies.get('kuma_checkin_date')?.value
      if (pastGateTime && checkinDate !== todayStr) {
        const url = new URL('/staff/checkin', request.url)
        url.searchParams.set('redirect', pathname)
        return NextResponse.redirect(url)
      }
    }

    return NextResponse.next()
  }

  // Owner routes — refresh Supabase session ให้ token ต่ออายุอัตโนมัติ
  if (pathname.startsWith('/owner/') || pathname.startsWith('/api/owner/')) {
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

    await supabase.auth.getUser()
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
