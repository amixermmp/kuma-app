import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type CsvRow = {
  branch_name: string
  license_plate: string
  brand: string
  model: string
  year: string
  color: string
  daily_rate: string
  tax_expiry: string
  pob_expiry: string
  oil_interval_km: string
  gear_oil_interval_km: string
}

export async function POST(request: NextRequest) {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const rows: CsvRow[] = body.rows
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'ไม่มีข้อมูลที่จะ import' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Load all branches once
  const { data: branches } = await supabase.from('branches').select('id, name')
  const branchMap = new Map((branches ?? []).map(b => [b.name.trim(), b.id]))

  let imported = 0
  const skipped: string[] = []

  for (const row of rows) {
    const branchId = branchMap.get(row.branch_name.trim())
    if (!branchId) {
      skipped.push(`${row.license_plate} (สาขา "${row.branch_name}" ไม่พบ)`)
      continue
    }

    // Insert bike
    const { data: bike, error: bikeErr } = await supabase
      .from('bikes')
      .insert({
        branch_id: branchId,
        license_plate: row.license_plate.trim(),
        brand: row.brand.trim(),
        model: row.model.trim(),
        year: row.year ? parseInt(row.year) : null,
        color: row.color.trim() || null,
        daily_rate: parseFloat(row.daily_rate),
        monthly_rate: null,
        deposit_amount: 0,
        odometer: 0,
        status: 'available',
      })
      .select('id')
      .single()

    if (bikeErr) {
      // Duplicate license plate or other error — skip
      skipped.push(row.license_plate)
      continue
    }

    const bikeId = bike.id

    // Insert bike documents (tax + pob) if expiry dates provided
    const docInserts = []
    if (row.tax_expiry?.trim()) {
      docInserts.push({ bike_id: bikeId, doc_type: 'tax', expiry_date: row.tax_expiry.trim(), doc_photo_url: null })
    }
    if (row.pob_expiry?.trim()) {
      docInserts.push({ bike_id: bikeId, doc_type: 'pob', expiry_date: row.pob_expiry.trim(), doc_photo_url: null })
    }
    if (docInserts.length > 0) {
      await supabase.from('bike_documents').insert(docInserts)
    }

    // Insert routines
    const routineInserts = []
    const oilKm = parseInt(row.oil_interval_km)
    const gearKm = parseInt(row.gear_oil_interval_km)
    if (!isNaN(oilKm) && oilKm > 0) {
      routineInserts.push({
        bike_id: bikeId,
        task_name: 'เปลี่ยนน้ำมันเครื่อง',
        interval_km: oilKm,
        interval_days: null,
        next_due_km: oilKm, // odometer starts at 0
        next_due_date: null,
      })
    }
    if (!isNaN(gearKm) && gearKm > 0) {
      routineInserts.push({
        bike_id: bikeId,
        task_name: 'เปลี่ยนน้ำมันเฟืองท้าย',
        interval_km: gearKm,
        interval_days: null,
        next_due_km: gearKm,
        next_due_date: null,
      })
    }
    if (routineInserts.length > 0) {
      await supabase.from('bike_routines').insert(routineInserts)
    }

    imported++
  }

  return NextResponse.json({ imported, skipped })
}
