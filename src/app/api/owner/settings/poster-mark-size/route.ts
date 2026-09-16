import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { branchId, sizePct } = await request.json()
  if (!branchId || typeof sizePct !== 'number' || sizePct <= 0 || sizePct > 50) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: existing } = await admin.from('branch_settings').select('branch_id').eq('branch_id', branchId).maybeSingle()
  const { error } = existing
    ? await admin.from('branch_settings').update({ poster_mark_size_pct: sizePct }).eq('branch_id', branchId)
    : await admin.from('branch_settings').insert({ branch_id: branchId, poster_mark_size_pct: sizePct })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ปรับขนาดจุดเดิมที่เคยตั้งไว้ทั้งหมดให้เท่ากับขนาดใหม่ทันที โดยคงจุดศูนย์กลางเดิมไว้
  const { data: hotspots } = await admin.from('poster_hotspots').select('id, x_pct, y_pct, width_pct, height_pct').eq('branch_id', branchId)
  for (const h of hotspots ?? []) {
    const centerX = h.x_pct + h.width_pct / 2
    const centerY = h.y_pct + h.height_pct / 2
    await admin.from('poster_hotspots').update({
      x_pct: Math.min(100 - sizePct, Math.max(0, centerX - sizePct / 2)),
      y_pct: Math.min(100 - sizePct, Math.max(0, centerY - sizePct / 2)),
      width_pct: sizePct,
      height_pct: sizePct,
    }).eq('id', h.id)
  }

  return NextResponse.json({ success: true })
}
