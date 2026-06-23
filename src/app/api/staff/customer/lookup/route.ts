import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get('phone')
  if (!phone) return NextResponse.json({ customer: null })

  const supabase = createAdminClient()
  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, workplace')
    .eq('phone', phone)
    .maybeSingle()

  return NextResponse.json({ customer: customer ?? null })
}
