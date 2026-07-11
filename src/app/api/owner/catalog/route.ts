import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// จัดการคลังยี่ห้อ/รุ่นรถ (owner เท่านั้น)
async function requireOwner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// เพิ่มยี่ห้อ หรือ รุ่น
export async function POST(request: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { type, brand, name } = await request.json()
  const admin = createAdminClient()

  if (type === 'brand') {
    if (!name?.trim()) return NextResponse.json({ error: 'กรุณาระบุชื่อยี่ห้อ' }, { status: 400 })
    const { error } = await admin.from('bike_brands').insert({ name: name.trim() })
    if (error) return NextResponse.json({ error: error.code === '23505' ? 'มียี่ห้อนี้อยู่แล้ว' : error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  if (type === 'model') {
    if (!brand?.trim() || !name?.trim()) return NextResponse.json({ error: 'กรุณาระบุยี่ห้อและรุ่น' }, { status: 400 })
    const { error } = await admin.from('bike_models').insert({ brand: brand.trim(), name: name.trim() })
    if (error) return NextResponse.json({ error: error.code === '23505' ? 'มีรุ่นนี้อยู่แล้ว' : error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'ประเภทไม่ถูกต้อง' }, { status: 400 })
}

// ลบยี่ห้อ (พร้อมรุ่นในยี่ห้อนั้น) หรือ ลบรุ่นเดียว
export async function DELETE(request: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { type, brand, name } = await request.json()
  const admin = createAdminClient()

  if (type === 'brand') {
    // กันลบยี่ห้อที่ยังมีรถใช้อยู่
    const { data: inUse } = await admin.from('bikes').select('id').eq('brand', brand).limit(1).maybeSingle()
    if (inUse) return NextResponse.json({ error: 'ยังมีรถใช้ยี่ห้อนี้อยู่ ลบไม่ได้' }, { status: 400 })
    await admin.from('bike_models').delete().eq('brand', brand)
    await admin.from('bike_brands').delete().eq('name', brand)
    return NextResponse.json({ success: true })
  }

  if (type === 'model') {
    const { data: inUse } = await admin.from('bikes').select('id').eq('brand', brand).eq('model', name).limit(1).maybeSingle()
    if (inUse) return NextResponse.json({ error: 'ยังมีรถใช้รุ่นนี้อยู่ ลบไม่ได้' }, { status: 400 })
    await admin.from('bike_models').delete().eq('brand', brand).eq('name', name)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'ประเภทไม่ถูกต้อง' }, { status: 400 })
}
