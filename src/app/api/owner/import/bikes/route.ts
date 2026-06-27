import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type CsvRow = {
  branch_name: string
  license_plate: string
  last_oil_change_date: string
  brand: string
  model: string
  year: string
  color: string
  daily_rate: string
  monthly_rate: string
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

    const plate = row.license_plate.trim()

    // Try insert bike; if duplicate → look up existing bike id
    let bikeId: string | null = null
    let isNew = false

    const { data: inserted, error: bikeErr } = await supabase
      .from('bikes')
      .insert({
        branch_id: branchId,
        license_plate: plate,
        brand: row.brand.trim(),
        model: row.model.trim(),
        year: row.year ? parseInt(row.year) : null,
        color: row.color.trim() || null,
        daily_rate: parseFloat(row.daily_rate),
        monthly_rate: row.monthly_rate ? parseFloat(row.monthly_rate) : null,
        deposit_amount: 0,
        odometer: 0,
        status: 'available',
      })
      .select('id')
      .single()

    if (bikeErr) {
      // Duplicate — find existing bike to update its documents
      const { data: existing } = await supabase
        .from('bikes')
        .select('id')
        .eq('license_plate', plate)
        .single()
      bikeId = existing?.id ?? null
    } else {
      bikeId = inserted.id
      isNew = true
    }

    if (!bikeId) {
      skipped.push(plate)
      continue
    }

    // Upsert documents (update expiry date even for existing bikes)
    if (row.tax_expiry?.trim()) {
      await supabase.from('bike_documents').upsert(
        { bike_id: bikeId, doc_type: 'tax', expiry_date: row.tax_expiry.trim() },
        { onConflict: 'bike_id,doc_type', ignoreDuplicates: false }
      )
    }
    if (row.pob_expiry?.trim()) {
      await supabase.from('bike_documents').upsert(
        { bike_id: bikeId, doc_type: 'pob', expiry_date: row.pob_expiry.trim() },
        { onConflict: 'bike_id,doc_type', ignoreDuplicates: false }
      )
    }

    // Insert routines only for new bikes
    if (isNew) {
      const routineInserts = []
      const oilKm = parseInt(row.oil_interval_km)
      const gearKm = parseInt(row.gear_oil_interval_km)
      if (!isNaN(oilKm) && oilKm > 0) {
        const lastOilDate = row.last_oil_change_date?.trim() || null
        routineInserts.push({
          bike_id: bikeId,
          task_name: 'เปลี่ยนน้ำมันเครื่อง',
          interval_km: oilKm,
          interval_days: null,
          last_done_date: lastOilDate,
          next_due_km: oilKm,
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
    }

    imported++
  }

  return NextResponse.json({ imported, skipped })
}
