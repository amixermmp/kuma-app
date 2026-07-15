import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeLog } from '@/lib/log'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { branch_id, category, description, amount, expense_date, receipt_url } = await request.json()

  if (!category || !amount || !expense_date) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('expenses').insert({
    branch_id: branch_id || null,
    category,
    description: description || null,
    amount: parseFloat(amount),
    expense_date,
    receipt_url: receipt_url || null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeLog({
    actorType: 'owner',
    actorId: user.id,
    actorName: user.email ?? 'Owner',
    action: 'expense_created',
    description: `ลงรายจ่าย ${category} — ${description || '-'} — ฿${parseFloat(amount).toLocaleString()} (${expense_date})`,
    metadata: { category, amount: parseFloat(amount), expense_date },
  })

  return NextResponse.json({ success: true })
}
