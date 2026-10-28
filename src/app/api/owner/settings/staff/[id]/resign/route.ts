import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeLog } from '@/lib/log'
import { resignStaff } from '@/lib/staffResign'

// พนักงานลาออก — เก็บประวัติครบ ชื่อขึ้น "(ลาออกแล้ว)" บัญชีปิดและ PIN ถูกเปลี่ยน (ดู lib/staffResign.ts)
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()
  const result = await resignStaff(admin, id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })

  if (!result.alreadyResigned) {
    await writeLog({
      actorType: 'owner',
      actorId: user.id,
      actorName: user.email ?? 'Owner',
      action: 'staff_resigned',
      description: `พนักงานลาออก ${result.name}`,
      metadata: { staffId: id },
    })
  }
  return NextResponse.json({ success: true, name: result.name })
}
