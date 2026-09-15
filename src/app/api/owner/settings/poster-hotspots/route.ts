import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { branchId, brand, model, xPct, yPct, widthPct, heightPct } = await request.json()
  if (!branchId || !brand || !model) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('poster_hotspots').insert({
    branch_id: branchId, brand, model, x_pct: xPct, y_pct: yPct, width_pct: widthPct, height_pct: heightPct,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('poster_hotspots').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
