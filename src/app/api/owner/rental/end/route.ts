import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeLog } from '@/lib/log'
import { hasOpenContract } from '@/lib/availability'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rentalId, type } = await request.json() as { rentalId: string; type: 'daily' | 'monthly' }
  if (!rentalId || !type) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const admin = createAdminClient()
  const ownerName = user.email ?? 'owner'

  if (type === 'daily') {
    const { data: rental } = await admin
      .from('rentals')
      .select('id, bike_id, status, customers(name, phone), bikes(license_plate)')
      .eq('id', rentalId)
      .single()

    if (!rental) return NextResponse.json({ error: 'ไม่พบข้อมูลการเช่า' }, { status: 404 })
    if (rental.status === 'returned') return NextResponse.json({ error: 'คืนรถแล้ว' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customerName = (rental.customers as any)?.name ?? 'ลูกค้า'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plate = (rental.bikes as any)?.license_plate ?? ''

    // รูปเก็บไว้ 30 วันหลังคืน (ลบอัตโนมัติผ่าน cron ไม่ใช่ตอนนี้)
    await admin.from('rentals').update({
      status: 'returned',
      actual_end_datetime: new Date().toISOString(),
    }).eq('id', rentalId)

    // เว้นแต่รถมีสัญญาอื่นเปิดค้างอยู่แล้ว (ปิดสัญญานี้ช้าหลังสัญญาใหม่บนคันเดียวกันเปิดไปแล้ว)
    if (!(await hasOpenContract(admin, rental.bike_id, rentalId))) {
      const { error: bikeUpdateErr } = await admin.from('bikes').update({ status: 'available' }).eq('id', rental.bike_id)
      if (bikeUpdateErr) console.error('[owner/rental/end] bike update failed:', rental.bike_id, JSON.stringify(bikeUpdateErr))
    }

    // Log: owner action
    await writeLog({
      actorType: 'owner',
      actorId: user.id,
      actorName: ownerName,
      action: 'bike_returned',
      description: `คืนรถ ${plate} — ลูกค้า ${customerName}`,
      metadata: { rentalId, bikeId: rental.bike_id, type: 'daily' },
    })

  } else {
    const { data: rental } = await admin
      .from('monthly_rentals')
      .select('id, bike_id, status, customers(name, phone), bikes(license_plate)')
      .eq('id', rentalId)
      .single()

    if (!rental) return NextResponse.json({ error: 'ไม่พบข้อมูลการเช่า' }, { status: 404 })
    if (rental.status === 'ended') return NextResponse.json({ error: 'สิ้นสุดแล้ว' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customerName = (rental.customers as any)?.name ?? 'ลูกค้า'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plate = (rental.bikes as any)?.license_plate ?? ''

    // รูปเก็บไว้ 30 วันหลังคืน (ลบอัตโนมัติผ่าน cron ไม่ใช่ตอนนี้)
    await admin.from('monthly_rentals').update({
      status: 'ended',
      end_date: new Date().toISOString().split('T')[0],
    }).eq('id', rentalId)

    // เว้นแต่รถมีสัญญาอื่นเปิดค้างอยู่แล้ว (ปิดสัญญานี้ช้าหลังสัญญาใหม่บนคันเดียวกันเปิดไปแล้ว)
    if (!(await hasOpenContract(admin, rental.bike_id, undefined, rentalId))) {
      const { error: bikeUpdateErr } = await admin.from('bikes').update({ status: 'available' }).eq('id', rental.bike_id)
      if (bikeUpdateErr) console.error('[owner/rental/end] bike update failed:', rental.bike_id, JSON.stringify(bikeUpdateErr))
    }

    await writeLog({
      actorType: 'owner',
      actorId: user.id,
      actorName: ownerName,
      action: 'bike_returned',
      description: `คืนรถรายเดือน ${plate} — ลูกค้า ${customerName}`,
      metadata: { rentalId, bikeId: rental.bike_id, type: 'monthly' },
    })
  }

  return NextResponse.json({ success: true })
}
