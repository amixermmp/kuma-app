import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeLog } from '@/lib/log'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const admin = createAdminClient()

  // If updating PIN, check uniqueness
  if (body.pin) {
    const { data: existing } = await admin.from('staff').select('id').eq('pin', body.pin).neq('id', id).maybeSingle()
    if (existing) return NextResponse.json({ error: 'PIN นี้มีพนักงานใช้อยู่แล้ว' }, { status: 400 })
  }

  const { error } = await admin.from('staff').update(body).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: staffRow } = await admin.from('staff').select('name').eq('id', id).single()
  const changed = Object.keys(body).filter(k => k !== 'pin')
  await writeLog({
    actorType: 'owner',
    actorId: user.id,
    actorName: user.email ?? 'Owner',
    action: 'staff_updated',
    description: `แก้ไขพนักงาน ${staffRow?.name ?? id} — ${[...changed, ...(body.pin ? ['pin'] : [])].join(', ')}`,
    metadata: { staffId: id, changed },
  })

  return NextResponse.json({ success: true })
}

// ลบพนักงานถาวร — ตัดการอ้างอิงเป็น null ก่อน (งานที่เขาทำไม่หาย แค่ไม่รู้ว่าใครทำ) แล้วลบ
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // ตัดการอ้างอิงในทุกตารางที่โยงกับพนักงานคนนี้ (ข้อมูลรายการยังอยู่ครบ)
  await Promise.all([
    admin.from('rentals').update({ staff_id: null }).eq('staff_id', id),
    admin.from('monthly_rentals').update({ staff_id: null }).eq('staff_id', id),
    admin.from('repairs').update({ reported_by: null }).eq('reported_by', id),
    admin.from('expenses').update({ recorded_by: null }).eq('recorded_by', id),
  ])

  const { data: staffRow } = await admin.from('staff').select('name').eq('id', id).single()
  const { error } = await admin.from('staff').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'ลบไม่สำเร็จ — ยังมีข้อมูลผูกอยู่ ลองปิดใช้งานแทน' }, { status: 500 })

  await writeLog({
    actorType: 'owner',
    actorId: user.id,
    actorName: user.email ?? 'Owner',
    action: 'staff_deleted',
    description: `ลบพนักงาน ${staffRow?.name ?? id} ออกจากระบบถาวร`,
    metadata: { staffId: id },
  })

  return NextResponse.json({ success: true })
}
