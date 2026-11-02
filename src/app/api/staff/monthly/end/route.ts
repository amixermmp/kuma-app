import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { recalcNeverDoneRoutines } from '@/lib/routines'
import { logStaffAction } from '@/lib/log'
import { hasOpenContract } from '@/lib/availability'
import { odometerLowerError } from '@/lib/odometerCheck'
import { isThaiIdNumber } from '@/lib/customer'
import { computeNet } from '@/lib/monthlySettlement'
import { loadMonthlySettlement } from '@/lib/monthlySettlementServer'

const baht = (n: number) => `฿${Math.abs(n).toLocaleString()}`

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    monthlyRentalId, returnPhotos, returnNote, returnOdometer,
    overdueDays, damageAmount, fuelAmount, paymentMethod, slipUrl,
  } = await request.json()
  if (!monthlyRentalId) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const supabase = createAdminClient()

  // คิดใบสรุปซ้ำฝั่งเซิร์ฟเวอร์ทั้งหมด — ไม่เชื่อยอดคืน/เก็บเพิ่มที่หน้าเว็บส่งมา (รับเฉพาะตัวเลขที่พนักงานกรอก)
  const loaded = await loadMonthlySettlement(supabase, monthlyRentalId)
  if (!loaded) return NextResponse.json({ error: 'ไม่พบสัญญา หรือสัญญาสิ้นสุดแล้ว' }, { status: 404 })
  const { rental, customer, currentBike, settlement, depositCash, today } = loaded

  // ไมล์ตอนจบสัญญา (ถ้ากรอก) ต้องไม่ต่ำกว่าไมล์ในระบบ — กันพิมพ์หลักหาย เช็คก่อนแก้ข้อมูลอะไรทั้งหมด
  if (returnOdometer) {
    const lowerErr = odometerLowerError(Number(returnOdometer), currentBike.odometer)
    if (lowerErr) return NextResponse.json({ error: lowerErr }, { status: 400 })
  }

  const net = computeNet(settlement, depositCash, { overdueDays, damage: damageAmount, fuel: fuelAmount })
  if (net.overdueDays > settlement.overdueDays) {
    return NextResponse.json({
      error: settlement.overdueDays > 0
        ? `คิดวันเกินกำหนดได้ไม่เกิน ${settlement.overdueDays} วัน (เลยวันครบดีลมาแค่นี้)`
        : 'ยังไม่เลยวันครบดีล — คิดค่าวันเกินกำหนดไม่ได้',
    }, { status: 400 })
  }

  // ต้องเก็บเงินเพิ่มจากลูกค้าจริง (ยอดสุทธิติดลบ) → ต้องรู้วิธีรับเงิน และบัตรไทยรับเงินสดไม่ได้ ตามนโยบายร้าน
  const collecting = net.netToCustomer < 0
  const method: 'cash' | 'transfer' | null = collecting ? (paymentMethod === 'cash' || paymentMethod === 'transfer' ? paymentMethod : null) : null
  if (collecting && !method) return NextResponse.json({ error: 'กรุณาเลือกวิธีรับเงินที่เก็บเพิ่ม (เงินสด/โอน)' }, { status: 400 })
  if (collecting && method === 'cash' && isThaiIdNumber(customer?.id_card_number ?? '')) {
    return NextResponse.json({ error: 'บัตรประชาชนไทย — รับเงินสดไม่ได้ ต้องโอนเงินเท่านั้น' }, { status: 400 })
  }

  const summaryParts: string[] = []
  if (settlement.rentAdjustment !== 0) summaryParts.push(`ค่าเช่า${settlement.rentAdjustment > 0 ? 'เก็บเพิ่ม' : 'คืน'} ${baht(settlement.rentAdjustment)}`)
  if (net.overdueDays > 0) summaryParts.push(`วันเกิน ${net.overdueDays} วัน ${baht(net.overdueCharge)}`)
  if (net.damage > 0) summaryParts.push(`ค่าเสียหาย ${baht(net.damage)}`)
  if (net.fuel > 0) summaryParts.push(`ค่าน้ำมัน ${baht(net.fuel)}`)
  if (depositCash > 0) summaryParts.push(`มัดจำ ${baht(depositCash)}`)
  summaryParts.push(net.netToCustomer >= 0 ? `คืนลูกค้าสุทธิ ${baht(net.netToCustomer)}` : `เก็บเพิ่มสุทธิ ${baht(net.netToCustomer)}`)
  const note = (typeof returnNote === 'string' ? returnNote.trim() : '')
  const notes = `${note ? note + '\n' : ''}[สรุปจบสัญญา] ${summaryParts.join(' | ')}`

  // จองสิทธิ์ปิดสัญญาก่อน (อัปเดตแบบมีเงื่อนไขว่ายังเปิดอยู่) — กดซ้ำ/สองคนพร้อมกันจะผ่านได้แค่ครั้งเดียว ก่อนจะบันทึกเงินใดๆ
  const { data: claimed, error: claimErr } = await supabase
    .from('monthly_rentals')
    .update({
      status: 'ended',
      end_date: today,
      return_photos: returnPhotos ?? [],
      return_odometer: returnOdometer ?? null,
      notes,
    })
    .eq('id', monthlyRentalId)
    .eq('status', 'active')
    .select('id')
  if (claimErr) {
    console.error('End monthly rental error:', claimErr.message)
    return NextResponse.json({ error: 'อัปเดตสัญญาไม่สำเร็จ' }, { status: 500 })
  }
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: 'สัญญานี้ถูกปิดไปแล้ว' }, { status: 409 })
  }

  // บันทึกเงินคืน/เก็บเพิ่ม — ถ้าล้ม ย้อนสัญญากลับเป็นเปิด กันสัญญาปิดไปแล้วแต่เงินไม่ลงบัญชี
  const slip = typeof slipUrl === 'string' && slipUrl ? slipUrl : null
  const rows: Record<string, unknown>[] = []
  if (settlement.rentAdjustment !== 0) {
    rows.push({
      monthly_rental_id: monthlyRentalId,
      due_date: today,
      paid_date: today,
      amount: settlement.rentAdjustment,
      status: 'paid',
      staff_id: staffId,
      payment_method: settlement.rentAdjustment > 0 ? method : null,
      photo_url: settlement.rentAdjustment > 0 ? slip : null,
      payment_note: settlement.rentAdjustment < 0
        ? `คืนเงินค่าเช่าส่วนที่ไม่ได้ใช้ (คืนรถก่อนครบงวด ใช้จริง ${settlement.daysUsed} วัน)`
        : settlement.reachedEnd
          ? 'เก็บค่าเช่างวดสุดท้ายที่ยังค้างตอนจบสัญญา'
          : `เก็บค่าเช่าเพิ่มตอนจบสัญญา (ใช้จริง ${settlement.daysUsed} วัน ค่าใช้ ${baht(settlement.charge)} หักที่จ่ายแล้ว ${baht(settlement.paidCurrent)})`,
    })
  }
  if (net.overdueCharge > 0) {
    rows.push({
      monthly_rental_id: monthlyRentalId,
      due_date: today,
      paid_date: today,
      amount: net.overdueCharge,
      status: 'paid',
      staff_id: staffId,
      payment_method: method,
      photo_url: slip,
      payment_note: `ค่าวันเกินกำหนด ${net.overdueDays} วัน × ${baht(Math.round(settlement.currentDailyRate))}`,
    })
  }
  if (rows.length > 0) {
    const { error: payErr } = await supabase.from('monthly_payments').insert(rows)
    if (payErr) {
      console.error('End monthly rental payment insert failed:', JSON.stringify(payErr))
      const { error: revertErr } = await supabase
        .from('monthly_rentals')
        .update({
          status: 'active',
          end_date: rental.end_date ?? null,
          return_photos: rental.return_photos ?? [],
          return_odometer: rental.return_odometer ?? null,
          notes: rental.notes ?? null,
        })
        .eq('id', monthlyRentalId)
      if (revertErr) console.error('End monthly rental REVERT failed:', monthlyRentalId, JSON.stringify(revertErr))
      return NextResponse.json({ error: 'บันทึกเงินคืน/เก็บเพิ่มไม่สำเร็จ — ยังไม่ได้จบสัญญา ลองอีกครั้ง' }, { status: 500 })
    }
  }

  // Only free the bike if no other open contract exists for it (รายเดือนอื่น หรือรายวันที่ยังไม่คืน —
  // กันเคสปิดสัญญานี้ช้าหลังจากมีสัญญาใหม่บนคันเดียวกันเปิดไปแล้ว)
  const stillOpen = await hasOpenContract(supabase, rental.bike_id, undefined, monthlyRentalId)

  let updateBikeErr = null
  if (!stillOpen) {
    const { error } = await supabase
      .from('bikes')
      .update({
        status: 'available',
        ...(returnOdometer ? { odometer: returnOdometer } : {}),
      })
      .eq('id', rental.bike_id)
    updateBikeErr = error
    if (returnOdometer) {
      await recalcNeverDoneRoutines(supabase, rental.bike_id, Number(returnOdometer))
    }
  }

  // หมายเหตุ: "วันเช่าสะสม" ของรูทีนนับทีละ 1 วันทุกวันที่รถออกใช้งานจริงผ่าน cron รายวันแทนแล้ว
  // (เดิมบวกยกก้อนทั้งสัญญาตรงนี้ ทำให้นับซ้ำวันที่เกิดก่อนเปลี่ยนน้ำมันครั้งล่าสุดไปแล้ว และไม่นับตอนต่อสัญญาเรื่อยๆ)

  if (updateBikeErr) {
    console.error('Update bike status error:', updateBikeErr.message)
    return NextResponse.json({ error: 'อัปเดตสถานะรถไม่สำเร็จ' }, { status: 500 })
  }

  await logStaffAction(staffId, 'monthly_ended',
    `จบสัญญารายเดือน ${currentBike.license_plate} — ลูกค้า ${customer?.name ?? ''} — ${summaryParts.join(' | ')}`,
    {
      monthlyRentalId, bikeId: rental.bike_id, returnOdometer: returnOdometer ?? null,
      periodStart: settlement.periodStart, periodEnd: settlement.periodEnd, daysUsed: settlement.daysUsed,
      contractRate: settlement.contractRate, paidCurrent: settlement.paidCurrent, futurePaid: settlement.futurePaid,
      charge: settlement.charge, rentAdjustment: settlement.rentAdjustment,
      overdueDays: net.overdueDays, overdueCharge: net.overdueCharge, damage: net.damage, fuel: net.fuel,
      depositCash, netToCustomer: net.netToCustomer, method,
    })

  return NextResponse.json({ ok: true, netToCustomer: net.netToCustomer })
}
