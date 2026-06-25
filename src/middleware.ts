import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/', '/staff/login', '/owner/login', '/bike']

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
    return NextResponse.next()
  }

  // Owner/admin routes — let page handle its own Supabase auth check
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
