import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// เช็คว่าลูกค้าของสัญญานี้ผูกไลน์ (สาขานี้) แล้วหรือยัง — หน้า staff poll ระหว่างรอลูกค้าสแกน
// ?rentalId= (รายวัน) หรือ ?monthlyId= (รายเดือน)
export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rentalId = request.nextUrl.searchParams.get('rentalId')
  const monthlyId = request.nextUrl.searchParams.get('monthlyId')
  if (!rentalId && !monthlyId) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: contract } = rentalId
    ? await supabase.from('rentals').select('customer_id, branch_id').eq('id', rentalId).single()
    : await supabase.from('monthly_rentals').select('customer_id, branch_id').eq('id', monthlyId!).single()

  if (!contract) return NextResponse.json({ linked: false })

  const { data: link } = await supabase
    .from('customer_line_links')
    .select('id')
    .eq('customer_id', contract.customer_id)
    .eq('branch_id', contract.branch_id)
    .maybeSingle()

  return NextResponse.json({ linked: Boolean(link) })
}
