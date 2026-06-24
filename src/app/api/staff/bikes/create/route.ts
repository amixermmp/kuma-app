import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

const BRANCH_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    license_plate, brand, model, year, color,
    odometer, notes, photo_url,
    daily_rate, monthly_rate, deposit_amount,
    docs, routines,
  } = body

  if (!license_plate || !brand || !model || !daily_rate) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Create bike
  const { data: bike, error: bikeErr } = await supabase
    .from('bikes')
    .insert({
      branch_id: BRANCH_ID,
      license_plate,
      brand,
      model,
      year: year ?? null,
      color: color ?? null,
      odometer: odometer ?? 0,
      notes: notes ?? null,
      photo_url: photo_url ?? null,
      daily_rate,
      monthly_rate: monthly_rate ?? null,
      deposit_amount: deposit_amount ?? 0,
      status: 'available',
    })
    .select('id')
    .single()

  if (bikeErr || !bike) {
    console.error('Create bike error:', bikeErr?.message)
    if (bikeErr?.message?.includes('unique')) {
      return NextResponse.json({ error: `ทะเบียน ${license_plate} มีในระบบแล้ว` }, { status: 400 })
    }
    return NextResponse.json({ error: 'เพิ่มรถไม่สำเร็จ' }, { status: 500 })
  }

  const bikeId = bike.id

  // Create documents (only if has data)
  const docInserts = []
  if (docs?.registration?.photo_url) {
    docInserts.push({ bike_id: bikeId, doc_type: 'registration', doc_photo_url: docs.registration.photo_url })
  }
  if (docs?.tax?.photo_url || docs?.tax?.expiry_date) {
    docInserts.push({
      bike_id: bikeId, doc_type: 'tax',
      doc_photo_url: docs.tax.photo_url ?? null,
      expiry_date: docs.tax.expiry_date ?? null,
    })
  }
  if (docs?.pob?.photo_url || docs?.pob?.expiry_date) {
    docInserts.push({
      bike_id: bikeId, doc_type: 'pob',
      doc_photo_url: docs.pob.photo_url ?? null,
      expiry_date: docs.pob.expiry_date ?? null,
    })
  }
  if (docInserts.length > 0) {
    await supabase.from('bike_documents').insert(docInserts)
  }

  // Create routines
  if (Array.isArray(routines) && routines.length > 0) {
    const routineInserts = routines.map((r: {
      task_name: string; interval_km: number | null; interval_days: number | null
    }) => {
      const nextDueKm = r.interval_km ? (odometer ?? 0) + r.interval_km : null
      const nextDueDate = r.interval_days
        ? new Date(Date.now() + r.interval_days * 86_400_000).toISOString().split('T')[0]
        : null
      return {
        bike_id: bikeId,
        task_name: r.task_name,
        interval_km: r.interval_km ?? null,
        interval_days: r.interval_days ?? null,
        next_due_km: nextDueKm,
        next_due_date: nextDueDate,
      }
    })
    await supabase.from('bike_routines').insert(routineInserts)
  }

  return NextResponse.json({ bikeId })
}
