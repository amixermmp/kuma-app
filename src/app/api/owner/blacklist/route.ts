import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeLog } from '@/lib/log'

async function requireOwner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// เพิ่มรายชื่อเข้าบัญชีดำ
export async function POST(request: NextRequest) {
  const user = await requireOwner()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, phone, reason } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'กรุณาระบุชื่อ' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('blacklist').insert({
    name: name.trim(),
    phone: phone?.trim() || null,
    reason: reason?.trim() || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeLog({
    actorType: 'owner',
    actorId: user.id,
    actorName: user.email ?? 'Owner',
    action: 'blacklist_added',
    description: `เพิ่มบัญชีดำ: ${name.trim()}${phone ? ` (${phone})` : ''}${reason ? ` — ${reason}` : ''}`,
    metadata: { name: name.trim(), phone: phone ?? null },
  })

  return NextResponse.json({ success: true })
}

// ลบออกจากบัญชีดำ
export async function DELETE(request: NextRequest) {
  const user = await requireOwner()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const admin = createAdminClient()
  const { data: row } = await admin.from('blacklist').select('name').eq('id', id).single()
  const { error } = await admin.from('blacklist').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeLog({
    actorType: 'owner',
    actorId: user.id,
    actorName: user.email ?? 'Owner',
    action: 'blacklist_removed',
    description: `ปลดบัญชีดำ: ${row?.name ?? id}`,
    metadata: { id },
  })

  return NextResponse.json({ success: true })
}
