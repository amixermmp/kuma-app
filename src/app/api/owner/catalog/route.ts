import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncMonthlyRentalRate } from '@/lib/monthlyRate'

// จัดการคลังยี่ห้อ/รุ่นรถ (owner เท่านั้น)
async function requireOwner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// เพิ่มยี่ห้อ หรือ รุ่น หรือแก้ค่าโปรของรุ่น
export async function POST(request: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { type, brand, name, promoPayDays, branchId, dailyRate, monthlyRate, fuelReferencePhotoUrl } = await request.json()
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

  if (type === 'branch_pricing') {
    if (!branchId || !brand?.trim() || !name?.trim()) return NextResponse.json({ error: 'กรุณาระบุสาขา ยี่ห้อ และรุ่น' }, { status: 400 })
    const promoValue = promoPayDays === null || promoPayDays === undefined || promoPayDays === '' ? null : Number(promoPayDays)
    if (promoValue !== null && (!Number.isInteger(promoValue) || promoValue < 1 || promoValue > 7)) {
      return NextResponse.json({ error: 'จำนวนวันโปรต้องเป็น 1-7' }, { status: 400 })
    }
    const dailyValue = dailyRate === null || dailyRate === '' ? null : Number(dailyRate)
    const monthlyValue = monthlyRate === null || monthlyRate === '' ? null : Number(monthlyRate)
    const { error } = await admin.from('branch_model_pricing').upsert({
      branch_id: branchId,
      brand: brand.trim(),
      model: name.trim(),
      // undefined = ไม่ได้ส่งฟิลด์นี้มาเลย (เช่น อัพโหลดแค่รูปน้ำมัน) ไม่แตะค่าเดิม — ต่างจาก null ที่ตั้งใจล้างค่า
      ...(dailyRate !== undefined ? { daily_rate: dailyValue } : {}),
      ...(monthlyRate !== undefined ? { monthly_rate: monthlyValue } : {}),
      ...(promoPayDays !== undefined ? { promo_pay_days: promoValue } : {}),
      ...(fuelReferencePhotoUrl !== undefined ? { fuel_reference_photo_url: fuelReferencePhotoUrl || null } : {}),
    }, { onConflict: 'branch_id,brand,model' })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // ราคามาตรฐานเปลี่ยน — sync ไปสัญญารายเดือนที่เช่าอยู่ของรถทุกคันในรุ่นนี้ที่สาขานี้ ที่ยังไม่ได้ override
    // ราคาไว้เอง (ตามมาตรฐานอยู่) ทันที ไม่ต้องให้พนักงานยืนยัน — คันที่ override ราคาเองไว้แล้วไม่กระทบ
    if (monthlyValue != null) {
      const { data: standardBikes } = await admin
        .from('bikes')
        .select('id')
        .eq('branch_id', branchId)
        .eq('brand', brand.trim())
        .eq('model', name.trim())
        .is('monthly_rate', null)
      for (const b of standardBikes ?? []) {
        await syncMonthlyRentalRate(admin, b.id, monthlyValue)
      }
    }

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
    const { error: modelsErr } = await admin.from('bike_models').delete().eq('brand', brand)
    const { error: brandErr } = await admin.from('bike_brands').delete().eq('name', brand)
    if (modelsErr || brandErr) {
      console.error('[owner/catalog] brand delete failed:', brand, JSON.stringify(modelsErr ?? brandErr))
      return NextResponse.json({ error: 'ลบยี่ห้อไม่สำเร็จ' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  if (type === 'model') {
    const { data: inUse } = await admin.from('bikes').select('id').eq('brand', brand).eq('model', name).limit(1).maybeSingle()
    if (inUse) return NextResponse.json({ error: 'ยังมีรถใช้รุ่นนี้อยู่ ลบไม่ได้' }, { status: 400 })
    const { error: modelErr } = await admin.from('bike_models').delete().eq('brand', brand).eq('name', name)
    if (modelErr) {
      console.error('[owner/catalog] model delete failed:', brand, name, JSON.stringify(modelErr))
      return NextResponse.json({ error: 'ลบรุ่นไม่สำเร็จ' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'ประเภทไม่ถูกต้อง' }, { status: 400 })
}
