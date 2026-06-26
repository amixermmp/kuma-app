import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BRANCH_ID = '00000000-0000-0000-0000-000000000001'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('expenses')
    .select('id, category, description, amount, expense_date, payment_method, receipt_url, notes')
    .eq('branch_id', BRANCH_ID)
    .order('expense_date', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { category, description, amount, expense_date, payment_method, notes } = await request.json()
  if (!category || !description || !amount || !expense_date) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('expenses')
    .insert({
      branch_id: BRANCH_ID,
      category,
      description,
      amount: Number(amount),
      expense_date,
      payment_method: payment_method ?? 'cash',
      notes: notes || null,
    })
    .select('id, category, description, amount, expense_date, payment_method, notes')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'ไม่พบ id' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('expenses').delete().eq('id', id).eq('branch_id', BRANCH_ID)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
