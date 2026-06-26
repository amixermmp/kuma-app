import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PUT(request: Request, { params }: { params: Promise<{ bikeId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bikeId } = await params
  const body = await request.json()

  // Whitelist allowed fields
  const allowed = ['license_plate', 'brand', 'model', 'year', 'color', 'daily_rate', 'monthly_rate', 'deposit_amount', 'odometer', 'notes', 'status', 'branch_id']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'ไม่มีข้อมูลให้อัพเดท' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('bikes').update(update).eq('id', bikeId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ bikeId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bikeId } = await params
  const admin = createAdminClient()

  // Block deletion if bike has active rentals
  const { data: active } = await admin
    .from('rentals')
    .select('id')
    .eq('bike_id', bikeId)
    .in('status', ['active', 'extended'])
    .maybeSingle()

  if (active) {
    return NextResponse.json({ error: 'ไม่สามารถลบรถที่มีการเช่าอยู่' }, { status: 400 })
  }

  // Cascade delete related records first
  await Promise.all([
    admin.from('bike_documents').delete().eq('bike_id', bikeId),
    admin.from('rentals').delete().eq('bike_id', bikeId),
    admin.from('monthly_rentals').delete().eq('bike_id', bikeId),
    admin.from('bookings').delete().eq('bike_id', bikeId),
    admin.from('repair_jobs').delete().eq('bike_id', bikeId),
  ])

  const { error } = await admin.from('bikes').delete().eq('id', bikeId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
