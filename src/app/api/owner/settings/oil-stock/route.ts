import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const OIL_LABEL: Record<string, string> = { engine: 'น้ำมันเครื่อง', gear: 'น้ำมันเฟืองท้าย' }

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, branch_id, oil_type, quantity, cost, threshold } = await request.json()
  if (!branch_id || !oil_type || !['engine', 'gear'].includes(oil_type)) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('branch_oil_stock')
    .select('id, quantity')
    .eq('branch_id', branch_id)
    .eq('oil_type', oil_type)
    .maybeSingle()

  if (action === 'restock') {
    const addQty = Number(quantity)
    if (!addQty || addQty <= 0) return NextResponse.json({ error: 'กรุณาใส่จำนวนขวดที่เติม' }, { status: 400 })

    const newQuantity = (existing?.quantity ?? 0) + addQty
    const { error } = existing
      ? await admin.from('branch_oil_stock').update({ quantity: newQuantity, updated_at: new Date().toISOString() }).eq('id', existing.id)
      : await admin.from('branch_oil_stock').insert({ branch_id, oil_type, quantity: newQuantity })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // ลงเป็นค่าใช้จ่ายจริงตอนซื้อเข้าสต๊อก (ครั้งเดียว ไม่ซ้ำกับตอนใช้)
    if (cost && Number(cost) > 0) {
      const bkkToday = new Date(Date.now() + 7 * 3600_000).toISOString().split('T')[0]
      await admin.from('expenses').insert({
        branch_id,
        recorded_by: user.id,
        category: 'maintenance',
        description: `เติมสต๊อก${OIL_LABEL[oil_type]} ${addQty} ขวด`,
        amount: Number(cost),
        expense_date: bkkToday,
      })
    }

    return NextResponse.json({ success: true, quantity: newQuantity })
  }

  if (action === 'set_threshold') {
    const newThreshold = Number(threshold)
    if (!newThreshold || newThreshold <= 0) return NextResponse.json({ error: 'กรุณาใส่เกณฑ์แจ้งเตือน' }, { status: 400 })

    const { error } = existing
      ? await admin.from('branch_oil_stock').update({ low_stock_threshold: newThreshold, updated_at: new Date().toISOString() }).eq('id', existing.id)
      : await admin.from('branch_oil_stock').insert({ branch_id, oil_type, low_stock_threshold: newThreshold })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'ไม่รู้จักคำสั่งนี้' }, { status: 400 })
}
