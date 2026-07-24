import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeLog } from '@/lib/log'

// waive/คืนรายการเงินที่บันทึกผิด — เซ็ต voided_at ไม่ลบทิ้ง (audit ครบ)
const TABLE_MAP: Record<string, { table: string; amountCol: string }> = {
  rental: { table: 'rental_payments', amountCol: 'amount' },
  monthly: { table: 'monthly_payments', amountCol: 'amount' },
  expense: { table: 'expenses', amountCol: 'amount' },
  repair: { table: 'repairs', amountCol: 'repair_cost' },
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { source, id, action, reason } = await request.json() as {
    source: string; id: string; action: 'void' | 'restore'; reason?: string
  }
  const target = TABLE_MAP[source]
  if (!target || !id || !['void', 'restore'].includes(action)) {
    return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
  }
  const { table, amountCol } = target

  const admin = createAdminClient()
  const { data: row } = await admin.from(table).select(amountCol).eq('id', id).single()
  if (!row) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })
  const amount = Number((row as unknown as Record<string, unknown>)[amountCol] ?? 0)

  const { error } = await admin.from(table).update(
    action === 'void'
      ? { voided_at: new Date().toISOString(), void_reason: reason?.trim() || null }
      : { voided_at: null, void_reason: null }
  ).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeLog({
    actorType: 'owner',
    actorId: user.id,
    actorName: user.email ?? 'Owner',
    action: action === 'void' ? 'entry_waived' : 'entry_restored',
    description: `${action === 'void' ? 'Waive' : 'คืน'}รายการ ${table} ฿${amount.toLocaleString()}${reason ? ` — ${reason}` : ''}`,
    metadata: { table, id, amount, reason: reason ?? null },
  })

  return NextResponse.json({ success: true })
}
