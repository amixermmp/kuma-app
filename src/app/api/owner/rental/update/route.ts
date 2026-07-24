import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeLog } from '@/lib/log'

// แก้ไขสัญญา (owner เท่านั้น) — ทุกการแก้ลง log แบบ ก่อน→หลัง
// แก้ยอดรวมรายวันจะ sync สมุดรายรับ (rental_payments) ให้อัตโนมัติ

/* eslint-disable @typescript-eslint/no-explicit-any */
const one = (v: any) => (Array.isArray(v) ? v[0] : v)

const fmtDT = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { type, id } = body as { type: 'daily' | 'monthly'; id: string }
  if (!type || !id) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const admin = createAdminClient()
  const changes: string[] = []

  // อัพเดทชื่อ/เบอร์ลูกค้า (ใช้ร่วมกับสัญญาอื่นของลูกค้าคนเดียวกัน)
  const updateCustomer = async (customerId: string, cust: any) => {
    const custUpd: Record<string, unknown> = {}
    if (body.customerName?.trim() && body.customerName.trim() !== cust?.name) {
      custUpd.name = body.customerName.trim()
      changes.push(`ชื่อ: ${cust?.name ?? '-'} → ${body.customerName.trim()}`)
    }
    if (body.customerPhone?.trim() && body.customerPhone.trim() !== cust?.phone) {
      custUpd.phone = body.customerPhone.trim()
      changes.push(`เบอร์: ${cust?.phone ?? '-'} → ${body.customerPhone.trim()}`)
    }
    if (Object.keys(custUpd).length > 0) {
      await admin.from('customers').update(custUpd).eq('id', customerId)
    }
  }

  if (type === 'daily') {
    const { data: rental } = await admin
      .from('rentals')
      .select('id, customer_id, start_datetime, expected_end_datetime, total_amount, deposit_amount, notes, bikes(license_plate), customers(name, phone)')
      .eq('id', id)
      .single()
    if (!rental) return NextResponse.json({ error: 'ไม่พบสัญญา' }, { status: 404 })

    await updateCustomer(rental.customer_id, one(rental.customers))

    const upd: Record<string, unknown> = {}
    if (body.startDatetime && new Date(body.startDatetime).getTime() !== new Date(rental.start_datetime).getTime()) {
      upd.start_datetime = body.startDatetime
      changes.push(`วันเริ่ม: ${fmtDT(rental.start_datetime)} → ${fmtDT(body.startDatetime)}`)
    }
    if (body.expectedEndDatetime && new Date(body.expectedEndDatetime).getTime() !== new Date(rental.expected_end_datetime).getTime()) {
      upd.expected_end_datetime = body.expectedEndDatetime
      changes.push(`กำหนดคืน: ${fmtDT(rental.expected_end_datetime)} → ${fmtDT(body.expectedEndDatetime)}`)
    }
    const newTotal = body.totalAmount != null ? Number(body.totalAmount) : null
    if (newTotal != null && newTotal !== Number(rental.total_amount ?? 0)) {
      upd.total_amount = newTotal
      changes.push(`ยอดรวม: ฿${Number(rental.total_amount ?? 0).toLocaleString()} → ฿${newTotal.toLocaleString()}`)
    }
    if (body.depositAmount != null && Number(body.depositAmount) !== Number(rental.deposit_amount ?? 0)) {
      upd.deposit_amount = Number(body.depositAmount)
      changes.push(`มัดจำ: ฿${Number(rental.deposit_amount ?? 0).toLocaleString()} → ฿${Number(body.depositAmount).toLocaleString()}`)
    }
    if (body.notes !== undefined && (body.notes || null) !== rental.notes) {
      upd.notes = body.notes || null
      changes.push('หมายเหตุ')
    }

    if (changes.length === 0) return NextResponse.json({ success: true })

    if (Object.keys(upd).length > 0) {
      const { error } = await admin.from('rentals').update(upd).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // sync สมุดรายรับ — แถวค่าเช่าตอนส่งรถ = ยอดรวมใหม่ − เงินต่อเวลาที่ลงไว้แยกแล้ว
    if (upd.total_amount != null || upd.start_datetime != null) {
      const { data: pays } = await admin
        .from('rental_payments')
        .select('id, kind, amount')
        .eq('rental_id', id)
        .order('created_at', { ascending: true })
      const initial = (pays ?? []).find(p => p.kind === 'rental')
      const extendSum = (pays ?? []).filter(p => p.kind === 'extend').reduce((s, p) => s + Number(p.amount), 0)
      const paySync: Record<string, unknown> = {}
      if (upd.total_amount != null) paySync.amount = Math.max(0, Number(upd.total_amount) - extendSum)
      if (upd.start_datetime != null) paySync.paid_at = upd.start_datetime
      if (initial) {
        await admin.from('rental_payments').update(paySync).eq('id', initial.id)
      } else if (upd.total_amount != null) {
        await admin.from('rental_payments').insert({
          rental_id: id, kind: 'rental',
          amount: Math.max(0, Number(upd.total_amount) - extendSum),
          paid_at: (upd.start_datetime as string) ?? rental.start_datetime,
        })
      }
    }

    const plate = one(rental.bikes)?.license_plate ?? ''
    await writeLog({
      actorType: 'owner', actorId: user.id, actorName: user.email ?? 'Owner',
      action: 'rental_edited',
      description: `แก้ไขสัญญารายวัน ${plate} — ${changes.join(' | ')}`,
      metadata: { rentalId: id, changes },
    })
    return NextResponse.json({ success: true })
  }

  // ── monthly ──
  const { data: rental } = await admin
    .from('monthly_rentals')
    .select('id, customer_id, start_date, payment_day, monthly_rate, deposit_amount, bikes(license_plate), customers(name, phone)')
    .eq('id', id)
    .single()
  if (!rental) return NextResponse.json({ error: 'ไม่พบสัญญา' }, { status: 404 })

  await updateCustomer(rental.customer_id, one(rental.customers))

  const upd: Record<string, unknown> = {}
  if (body.startDate && body.startDate !== rental.start_date) {
    upd.start_date = body.startDate
    changes.push(`วันเริ่ม: ${rental.start_date} → ${body.startDate}`)
  }
  if (body.paymentDay != null && Number(body.paymentDay) !== Number(rental.payment_day)) {
    if (Number(body.paymentDay) < 1 || Number(body.paymentDay) > 31) {
      return NextResponse.json({ error: 'วันเก็บเงินต้องอยู่ระหว่าง 1-31' }, { status: 400 })
    }
    upd.payment_day = Number(body.paymentDay)
    changes.push(`วันเก็บเงิน: ${rental.payment_day} → ${body.paymentDay}`)
  }
  if (body.monthlyRate != null && Number(body.monthlyRate) !== Number(rental.monthly_rate)) {
    upd.monthly_rate = Number(body.monthlyRate)
    changes.push(`ค่าเช่า/เดือน: ฿${Number(rental.monthly_rate).toLocaleString()} → ฿${Number(body.monthlyRate).toLocaleString()}`)
  }
  if (body.depositAmount != null && Number(body.depositAmount) !== Number(rental.deposit_amount ?? 0)) {
    upd.deposit_amount = Number(body.depositAmount)
    changes.push(`มัดจำ: ฿${Number(rental.deposit_amount ?? 0).toLocaleString()} → ฿${Number(body.depositAmount).toLocaleString()}`)
  }

  if (changes.length === 0) return NextResponse.json({ success: true })

  if (Object.keys(upd).length > 0) {
    const { error } = await admin.from('monthly_rentals').update(upd).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const plate = one(rental.bikes)?.license_plate ?? ''
  await writeLog({
    actorType: 'owner', actorId: user.id, actorName: user.email ?? 'Owner',
    action: 'monthly_edited',
    description: `แก้ไขสัญญารายเดือน ${plate} — ${changes.join(' | ')}`,
    metadata: { monthlyRentalId: id, changes },
  })
  return NextResponse.json({ success: true })
}
