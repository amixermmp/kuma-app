import { NextResponse } from 'next/server'

// ออกจากระบบ staff — ล้าง cookie แล้วกลับหน้า login (สลับไอดี/สาขาง่ายๆ)
export async function POST() {
  const res = NextResponse.redirect(
    new URL('/', process.env.NEXT_PUBLIC_APP_URL ?? 'https://kuma-app.vercel.app')
  )
  for (const name of ['kuma_staff_id', 'kuma_staff_name', 'kuma_branch_name']) {
    res.cookies.set(name, '', { maxAge: 0, path: '/' })
  }
  return res
}
