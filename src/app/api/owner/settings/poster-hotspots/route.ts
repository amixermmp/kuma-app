import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { branchId, models, xPct, yPct, widthPct, heightPct } = await request.json()
  if (!branchId || !Array.isArray(models) || models.length === 0) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: hotspot, error } = await admin.from('poster_hotspots').insert({
    branch_id: branchId, x_pct: xPct, y_pct: yPct, width_pct: widthPct, height_pct: heightPct,
  }).select('id').single()
  if (error || !hotspot) return NextResponse.json({ error: error?.message ?? 'บันทึกไม่สำเร็จ' }, { status: 500 })

  const { error: modelsError } = await admin.from('poster_hotspot_models').insert(
    models.map((m: { brand: string; model: string }) => ({ hotspot_id: hotspot.id, brand: m.brand, model: m.model }))
  )
  if (modelsError) {
    await admin.from('poster_hotspots').delete().eq('id', hotspot.id)
    return NextResponse.json({ error: modelsError.message }, { status: 500 })
  }

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
