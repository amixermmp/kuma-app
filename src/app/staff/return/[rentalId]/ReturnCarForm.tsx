'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PhotoUpload from '@/components/PhotoUpload'
import TabBar from '@/components/staff/TabBar'
import { addTab } from '@/lib/tabStore'
import { calcRentQuote, calcLateHours, calcOvertimeCharge, OVERTIME_HOURLY_RATE } from '@/lib/pricing'

type Rental = {
  id: string
  start_datetime: string
  expected_end_datetime: string
  total_amount: number
  deposit_amount: number
  deposit_method?: string | null
  daily_rate: number
  total_days: number
  outstanding_credit: number
  status: string
  notes: string | null
  discount: number
  return_type: string | null
  return_address: string | null
  send_fuel_full: boolean | null
  bikes: { id: string; license_plate: string; brand: string; model: string; odometer: number; daily_rate: number; monthly_rate: number | null }
  customers: { id: string; name: string; phone: string }
}

type Props = {
  rental: Rental
  staffId: string
  promoPayDays?: number
  fuelReferencePhotoUrl: string | null
  qrDailyUrl: string | null
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

const CHECKLIST = [
  'ไฟหน้า-ไฟท้าย ปกติ',
  'กระจกมองข้าง ครบ',
  'ตัวรถไม่มีรอยขีดข่วนใหม่',
  'กุญแจครบ',
  'แผ่นป้ายทะเบียน ปกติ',
]

export default function ReturnCarForm({ rental, staffId, promoPayDays = 5, fuelReferencePhotoUrl, qrDailyUrl }: Props) {
  const router = useRouter()
  const bike = rental.bikes
  const customer = rental.customers

  useEffect(() => {
    addTab({
      type: 'returncar',
      title: `รับคืน ${bike.license_plate}`,
      href: `/staff/return/${rental.id}`,
    })
  }, [rental.id, bike.license_plate])

  // Overtime — grace period 0–30 นาที = ฟรี, หลังจากนั้นคิดเป็นชั่วโมง (สูตรกลาง ใช้ร่วมกับพรีวิวราคาตอนค้นหา/จอง)
  const now = Date.now()
  const expectedMs = new Date(rental.expected_end_datetime).getTime()
  const isLate = now > expectedMs
  const lateMs = Math.max(0, now - expectedMs)
  const lateMinutes = lateMs / 60_000
  const lateHours = calcLateHours(lateMs)
  const lateChargeIsDay = lateHours >= 5
  const grossOvertimeCharge = calcOvertimeCharge(lateHours, rental.daily_rate)
  // หักเครดิตที่ลูกค้าจ่ายค้างไว้จากการต่อเวลาก่อนหน้า
  const credit = rental.outstanding_credit ?? 0
  const overtimeCharge = Math.max(0, grossOvertimeCharge - credit)

  // คืนรถก่อนกำหนด (เกิน 1 ชม.ก่อนกำหนดถือว่า early) — คิดค่าเช่าใหม่ตามวันที่ใช้จริง
  // ด้วยเรทที่ตกลงไว้จริง (รวมส่วนลดโปรนักศึกษาถ้ามี — ไม่ใช่แค่เรทเต็มของรถ) แล้วคืนส่วนต่างจากที่จ่ายไปแล้ว
  // สมมติฐาน: วันที่ใช้จริงปัดขึ้นเป็นวันเต็ม (ใช้เกินเที่ยงคืนแล้วนับเป็นอีกวัน) — มาตรฐานร้านเช่ารถทั่วไป
  const STUDENT_PROMO_DISCOUNT = 50 // ต้องตรงกับส่วนลด/วันในหน้าส่งรถ (SendCarForm.tsx)
  const isEarly = now < expectedMs - 3_600_000
  const usedDaysMs = Math.max(0, now - new Date(rental.start_datetime).getTime())
  const actualDaysUsed = Math.max(1, Math.ceil(usedDaysMs / 86_400_000))
  const isStudentPromo = (rental.discount ?? 0) > 0
  const effectiveDailyRate = rental.daily_rate - (isStudentPromo ? STUDENT_PROMO_DISCOUNT : 0)
  const normalMonthlyRate = bike.monthly_rate || bike.daily_rate * 30
  const recalculatedCharge = isEarly
    ? calcRentQuote(new Date(rental.start_datetime), actualDaysUsed, effectiveDailyRate, normalMonthlyRate, promoPayDays).total
    : rental.total_amount
  // คืนเฉพาะกรณีจ่ายไปแล้วมากกว่าที่ควรจ่ายจริง — ไม่มีทางเรียกเก็บเพิ่มจากการคืนก่อน
  const earlyReturnRefund = isEarly ? Math.max(0, rental.total_amount - recalculatedCharge) : 0

  // ต้องเช็คน้ำมันเฉพาะกรณีตอนส่งรถให้เต็มไปเท่านั้น — ถ้าส่งไม่เต็มอยู่แล้ว ไม่มีข้อผูกพันต้องคืนเต็ม ไม่ต้องถามเลย
  // สัญญาเก่าก่อนมีฟีเจอร์นี้ (send_fuel_full เป็นค่าว่าง) ถือว่าส่งเต็มเสมอ เพราะร้านส่งรถเต็มถังทุกคันมาตลอดอยู่แล้ว
  const sentNotFull = rental.send_fuel_full === false
  const requiresFuelCheck = !sentNotFull
  const [returnFuelFull, setReturnFuelFull] = useState<boolean | null>(null)
  const [refueledByCustomer, setRefueledByCustomer] = useState<boolean | null>(null)
  const [fuelFee, setFuelFee] = useState('0')
  const [damageFee, setDamageFee] = useState('0')
  const [damageNotes, setDamageNotes] = useState('')
  const [checklist, setChecklist] = useState<boolean[]>(CHECKLIST.map(() => true))
  const [odometer, setOdometer] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [overrideOvertime, setOverrideOvertime] = useState('')
  const [routineDue, setRoutineDue] = useState<{ taskName: string; dueReason: string }[] | null>(null)

  const fuel = parseFloat(fuelFee) || 0
  const damage = parseFloat(damageFee) || 0
  const finalOvertimeCharge = overrideOvertime !== '' ? Math.max(0, parseFloat(overrideOvertime) || 0) : overtimeCharge
  const netRefund = rental.deposit_amount - finalOvertimeCharge - damage - fuel + earlyReturnRefund

  // โชว์รูปกำกับราคาน้ำมัน เมื่อคืนไม่เต็ม หรือดูเต็มแต่ลูกค้ายังไม่ได้เติมมาเอง
  const showFuelReference = requiresFuelCheck && (returnFuelFull === false || (returnFuelFull === true && refueledByCustomer === false))
  const fuelCheckIncomplete = requiresFuelCheck && (returnFuelFull === null || (returnFuelFull === true && refueledByCustomer === null))

  const toggleCheck = useCallback((i: number) => {
    setChecklist(prev => prev.map((v, idx) => idx === i ? !v : v))
  }, [])

  const handleSubmit = async () => {
    if (!odometer) { setError('กรุณากรอกเลขไมล์ตอนรับคืน'); return }
    if (fuelCheckIncomplete) { setError('กรุณาเลือกระดับน้ำมันตอนรับคืน'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/staff/rental/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rentalId: rental.id,
          bikeId: bike.id,
          staffId,
          returnOdometer: odometer ? parseInt(odometer) : null,
          returnFuelFull: requiresFuelCheck ? returnFuelFull : null,
          returnFuelRefueledByCustomer: requiresFuelCheck ? refueledByCustomer : null,
          fuelFee: fuel,
          damageFee: damage,
          damageNotes: damageNotes.trim() || null,
          returnPhotoUrl: photoUrl || null,
          refundAmount: netRefund,
          checklistPassed: checklist,
          finalRentAmount: recalculatedCharge,
          overtimeCharge: finalOvertimeCharge,
          earlyReturnRefund,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      if (Array.isArray(data.routineDue) && data.routineDue.length > 0) {
        setRoutineDue(data.routineDue)
        return
      }
      router.push('/staff/home')
    } catch {
      setError('เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-wrap">

      {/* Header */}
      <div className="app-header">
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div>
          <h1>รับรถคืน</h1>
          <div className="sub">{bike.license_plate} {bike.brand} {bike.model}</div>
        </div>
      </div>
      <TabBar />

      <div className="section-pad">

        {/* เตือนคืนบัตรประชาชน — ลูกค้าวางบัตรไว้แทนมัดจำตอนส่งรถ ต้องคืนบัตรจริงตอนนี้ */}
        {rental.deposit_method === 'id_card' && (
          <div style={{
            background: '#eff6ff', border: '2px solid #93c5fd', borderRadius: '12px',
            padding: '14px 16px', marginBottom: '12px',
          }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#1d4ed8' }}>🪪 อย่าลืมคืนบัตรประชาชนให้ลูกค้า!</div>
            <div style={{ fontSize: '13px', color: '#1e40af', marginTop: '2px' }}>ลูกค้าวางบัตรไว้แทนมัดจำตอนส่งรถ ไม่มีเงินมัดจำต้องคืน</div>
          </div>
        )}

        {/* จุดคืนรถ — เด่นไว้ก่อนเลย เผื่อกะอื่นรับคืนต้องรู้ว่าไปรับที่ไหน */}
        {rental.return_type === 'offsite' && (
          <div style={{
            background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: '10px',
            padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: '#0369a1',
          }}>
            <strong>🛵 นัดรับคืนนอกสถานที่</strong>
            {rental.return_address && (
              <div style={{ fontSize: '13px', marginTop: '4px', color: '#0c4a6e' }}>{rental.return_address}</div>
            )}
          </div>
        )}
        {rental.return_type === 'shop' && (
          <div style={{
            background: '#f1f5f9', border: '1.5px solid #e5e7eb', borderRadius: '10px',
            padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: '#111827',
          }}>
            <strong>🏠 นัดคืนที่ร้าน</strong>
          </div>
        )}

        {/* Rental summary */}
        <div className="card" style={{ borderTop: '3px solid #111827' }}>
          <div className="card-title">สรุปการเช่า</div>
          <div className="info-row">
            <span className="info-key">ผู้เช่า</span>
            <span className="info-val">{customer.name}</span>
          </div>
          <div className="info-row">
            <span className="info-key">เบอร์โทร</span>
            <span className="info-val">{customer.phone}</span>
          </div>
          <div className="info-row">
            <span className="info-key">วันเริ่มเช่า</span>
            <span className="info-val">{fmtDate(rental.start_datetime)}</span>
          </div>
          <div className="info-row">
            <span className="info-key">กำหนดคืน</span>
            <span className="info-val" style={{ color: isLate ? '#dc2626' : 'inherit' }}>
              {fmtDate(rental.expected_end_datetime)}
            </span>
          </div>
          <div className="info-row">
            <span className="info-key">วันที่คืนจริง</span>
            <span className="info-val" style={{ color: lateHours > 0 ? '#dc2626' : '#16a34a' }}>
              {fmtDate(new Date().toISOString())}
              {lateHours > 0
                ? ` (เกิน ${lateHours} ชม.)`
                : lateMinutes > 0 && lateMinutes <= 30
                  ? ' (เกินนิดหน่อย — ยังอยู่ในเกรซ)'
                  : now < expectedMs - 3_600_000 ? ' (คืนก่อนกำหนด)' : ' (คืนตามกำหนด)'}
            </span>
          </div>
          <div className="info-row">
            <span className="info-key">ค่าเช่าที่ชำระแล้ว</span>
            <span className="info-val">฿{rental.total_amount.toLocaleString()}</span>
          </div>
          <div className="info-row">
            <span className="info-key">เงินมัดจำ</span>
            <span className="info-val">฿{rental.deposit_amount.toLocaleString()}</span>
          </div>
        </div>

        {/* ===== ส่วนลูกค้า (ต่อหน้าลูกค้า รีบ ต้องเก็บเงินให้จบก่อน) ===== */}

        {/* น้ำมัน — เช็คก่อนเลย เป็นเรื่องเงินที่ต้องคุยกับลูกค้าตรงหน้า */}
        {requiresFuelCheck && (
          <div className="card">
            <div className="card-title">ระดับน้ำมันตอนรับคืน</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => { setReturnFuelFull(true); setRefueledByCustomer(null); setFuelFee('0') }} style={{
                flex: 1, padding: '12px', borderRadius: '10px', border: '1.5px solid #e5e7eb',
                background: returnFuelFull === true ? '#16a34a' : '#fff', color: returnFuelFull === true ? '#fff' : '#374151',
                fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                เต็ม
              </button>
              <button type="button" onClick={() => { setReturnFuelFull(false); setRefueledByCustomer(null) }} style={{
                flex: 1, padding: '12px', borderRadius: '10px', border: '1.5px solid #e5e7eb',
                background: returnFuelFull === false ? '#d97706' : '#fff', color: returnFuelFull === false ? '#fff' : '#374151',
                fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                ไม่เต็ม
              </button>
            </div>

            {returnFuelFull === true && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>ลูกค้าเติมน้ำมันมาหรือยัง?</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={() => { setRefueledByCustomer(true); setFuelFee('0') }} style={{
                    flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #e5e7eb',
                    background: refueledByCustomer === true ? '#16a34a' : '#fff', color: refueledByCustomer === true ? '#fff' : '#374151',
                    fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    เติมแล้ว
                  </button>
                  <button type="button" onClick={() => setRefueledByCustomer(false)} style={{
                    flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #e5e7eb',
                    background: refueledByCustomer === false ? '#dc2626' : '#fff', color: refueledByCustomer === false ? '#fff' : '#374151',
                    fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    ยังไม่ได้เติม
                  </button>
                </div>
              </div>
            )}

            {showFuelReference && (
              <div style={{ marginTop: '12px' }}>
                <div style={{
                  background: '#fffbeb', border: '1.5px solid #fcd34d',
                  borderRadius: '10px', padding: '12px 14px', marginBottom: '10px',
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400e', marginBottom: '8px' }}>
                    น้ำมันยังไม่เต็ม — โชว์รูปนี้ให้ลูกค้าดูด้วยกัน เทียบหน้าปัดแล้วกรอกราคาตามรูปด้านล่าง
                  </div>
                  {fuelReferencePhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fuelReferencePhotoUrl} alt="อัตราค่าน้ำมัน" style={{ width: '100%', borderRadius: '8px' }} />
                  ) : (
                    <div style={{ fontSize: '12px', color: '#92400e' }}>
                      ยังไม่ได้ตั้งค่ารูปกำกับราคาน้ำมันของรุ่นนี้ไว้ (ตั้งค่าได้ที่หน้าตั้งราคารถ)
                    </div>
                  )}
                </div>
                <div className="field-row" style={{ marginBottom: 0 }}>
                  <label className="field-label">ค่าน้ำมัน (บาท)</label>
                  <input className="field-input" type="number" placeholder="0"
                    value={fuelFee}
                    onChange={e => setFuelFee(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ตอนส่งกดไว้ว่าไม่เต็ม (แถมให้) — ไม่ต้องถามน้ำมันตอนคืนเลย แต่บอกพนักงานไว้กันงงคิดว่าหาย/บั๊ก */}
        {sentNotFull && (
          <div style={{
            background: '#eff6ff', border: '2px solid #93c5fd',
            borderRadius: '12px', padding: '14px 16px', marginBottom: '12px',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#1d4ed8', marginBottom: '2px' }}>
              ⛽ น้ำมันไม่ต้องเก็บ
            </div>
            <div style={{ fontSize: '13px', color: '#1e40af' }}>
              ตอนรับรถลูกค้าคันนี้ได้น้ำมันไม่เต็มถัง (ทางร้านแถมให้) — ไม่ต้องเก็บค่าน้ำมันตอนคืน
            </div>
          </div>
        )}

        {/* ตรวจสภาพรถแบบเร็ว — ถ้าเห็นรอยเสียหายชัดเจนที่ต้องเก็บเงิน ใส่ตอนนี้เลย */}
        <div className="card">
          <div className="card-title">ค่าเสียหาย (ถ้ามี)</div>
          <div className="field-row">
            <label className="field-label">ค่าเสียหายเพิ่มเติม (บาท)</label>
            <input className="field-input" type="number" placeholder="0"
              value={damageFee}
              onChange={e => setDamageFee(e.target.value)}
            />
          </div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">หมายเหตุ / รายละเอียดความเสียหาย</label>
            <textarea className="field-input" rows={2}
              placeholder="เช่น มีรอยขีดข่วนด้านซ้าย ค่าเสียหาย 200 บาท"
              value={damageNotes}
              onChange={e => setDamageNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Overtime charge — แค่แจ้งข้อมูล ไม่ต้องเด่นมาก เด่นแค่ยอดรวมสุดท้ายพอ */}
        {lateHours > 0 && (
          <div style={{
            background: '#fffbeb', border: '1.5px solid #fde68a',
            borderRadius: '14px', padding: '14px 18px', marginBottom: '10px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400e', marginBottom: '6px' }}>
              ⏱ คืนรถช้า — ค่าล่วงเวลา
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: credit > 0 ? '6px' : '0' }}>
              <span style={{ fontSize: '13px', color: '#374151' }}>
                {lateChargeIsDay
                  ? `เกิน ${lateHours} ชม. → คิด ${Math.ceil(lateHours / 24)} วัน × ฿${rental.daily_rate.toLocaleString()}`
                  : `เกิน ${lateHours} ชม. × ฿${OVERTIME_HOURLY_RATE}/ชม.`}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#92400e', textDecoration: credit > 0 ? 'line-through' : 'none', opacity: credit > 0 ? 0.6 : 1 }}>
                ฿{grossOvertimeCharge.toLocaleString()}
              </span>
            </div>
            {credit > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', color: '#16a34a' }}>💳 หักเครดิตที่จ่ายไว้แล้ว</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a' }}>−฿{Math.min(credit, grossOvertimeCharge).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #fde68a', paddingTop: '6px' }}>
                  <span style={{ fontSize: '13px', color: '#374151', fontWeight: 600 }}>คงเหลือ</span>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: finalOvertimeCharge > 0 ? '#92400e' : '#16a34a' }}>
                    {finalOvertimeCharge > 0 ? `+฿${finalOvertimeCharge.toLocaleString()}` : '฿0 (ชำระครบ)'}
                  </span>
                </div>
              </>
            )}
            {credit === 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span />
                <span style={{ fontSize: '15px', fontWeight: 700, color: finalOvertimeCharge > 0 ? '#92400e' : '#16a34a' }}>
                  {finalOvertimeCharge > 0 ? `+฿${finalOvertimeCharge.toLocaleString()}` : '฿0'}
                </span>
              </div>
            )}
            {/* Manual override */}
            <div style={{ marginTop: '10px', borderTop: '1px solid #fde68a', paddingTop: '10px' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                แก้ไขค่าล่วงเวลาด้วยตนเอง (ลืมกดรับคืน ฯลฯ)
              </div>
              <input
                type="number"
                placeholder={`ปล่อยว่าง = ใช้ auto (฿${overtimeCharge.toLocaleString()})`}
                value={overrideOvertime}
                onChange={e => setOverrideOvertime(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: '8px',
                  border: overrideOvertime !== '' ? '2px solid #92400e' : '1.5px solid #fde68a',
                  fontSize: '16px', fontWeight: 700, background: '#fff',
                  boxSizing: 'border-box', fontFamily: 'inherit',
                }}
              />
              {overrideOvertime !== '' && (
                <div style={{ fontSize: '12px', color: '#92400e', marginTop: '4px', fontWeight: 600 }}>
                  ✏️ ใช้ค่าที่กรอก: ฿{finalOvertimeCharge.toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Early return refund */}
        {isEarly && (
          <div style={{
            background: '#f0fdf4', border: '2px solid #bbf7d0',
            borderRadius: '14px', padding: '14px 18px', marginBottom: '10px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a', marginBottom: '6px' }}>
              📆 คืนรถก่อนกำหนด — คิดค่าเช่าใหม่ตามวันที่ใช้จริง
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>
              ใช้จริง {actualDaysUsed} วัน × ฿{effectiveDailyRate.toLocaleString()}/วัน{isStudentPromo ? ' (รวมส่วนลดนักศึกษาแล้ว)' : ''} = ฿{recalculatedCharge.toLocaleString()}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#374151' }}>
                จ่ายไปแล้ว ฿{rental.total_amount.toLocaleString()} − ควรจ่ายจริง ฿{recalculatedCharge.toLocaleString()}
              </span>
              <span style={{ fontSize: '20px', fontWeight: 900, color: earlyReturnRefund > 0 ? '#15803d' : '#6b7280' }}>
                {earlyReturnRefund > 0 ? `คืน ฿${earlyReturnRefund.toLocaleString()}` : 'ไม่มีส่วนคืน'}
              </span>
            </div>
          </div>
        )}

        {/* Deposit refund / extra charge — กล่องนี้เด่นที่สุดในหน้า เพราะเป็นยอดที่ต้องเก็บ/คืนจริง */}
        <div style={{
          background: netRefund >= 0 ? '#f0fdf4' : '#fef2f2',
          border: `2px solid ${netRefund >= 0 ? '#bbf7d0' : '#fecaca'}`,
          borderRadius: '14px', padding: '18px 20px', marginBottom: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '13px', color: netRefund >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
              {netRefund >= 0 ? '💰 คืนเงินมัดจำให้ลูกค้า' : '⚠️ มัดจำไม่พอ — เก็บเงินเพิ่ม'}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
              {netRefund >= 0
                ? `มัดจำ ฿${rental.deposit_amount.toLocaleString()}`
                  + (finalOvertimeCharge > 0 ? ` − ล่วงเวลา ฿${finalOvertimeCharge.toLocaleString()}` : '')
                  + (fuel > 0 ? ` − น้ำมัน ฿${fuel.toLocaleString()}` : '')
                  + (damage > 0 ? ` − เสียหาย ฿${damage.toLocaleString()}` : '')
                  + (earlyReturnRefund > 0 ? ` + คืนค่าเช่า ฿${earlyReturnRefund.toLocaleString()}` : '')
                : `ล่วงเวลา+น้ำมัน+เสียหาย (หลังหักเครดิต) ฿${(finalOvertimeCharge + fuel + damage).toLocaleString()} เกินมัดจำ ฿${rental.deposit_amount.toLocaleString()}`}
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: netRefund >= 0 ? '#15803d' : '#dc2626' }}>
            ฿{Math.abs(netRefund).toLocaleString()}
          </div>
        </div>

        {/* QR รับเงิน — โชว์เฉพาะตอนมัดจำไม่พอ ต้องเก็บเงินเพิ่ม */}
        {netRefund < 0 && qrDailyUrl && (
          <div style={{ textAlign: 'center', padding: '14px', background: '#f9fafb', borderRadius: '10px', marginBottom: '12px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDailyUrl} alt="QR รับเงิน" style={{ maxWidth: '260px', width: '100%', height: 'auto', borderRadius: '8px' }} />
          </div>
        )}

        <div style={{
          borderTop: '2px dashed #d1d5db', margin: '20px 0 16px', paddingTop: '16px',
          fontSize: '12px', color: '#9ca3af', fontWeight: 600, textAlign: 'center',
        }}>
          — เก็บเงินเรียบร้อยแล้ว ต่อไปตรวจสภาพรถ (ไม่รีบก็ได้) —
        </div>

        {/* ===== ส่วนพนักงาน (ตรวจหลังลูกค้าไปก็ได้ ยังอยู่หน้าเดียวกัน กดยืนยันครั้งเดียวจบ) ===== */}

        {/* Checklist */}
        <div className="card">
          <div className="card-title">ตรวจสภาพรถตอนรับคืน</div>
          {CHECKLIST.map((item, i) => (
            <div key={i} className="checklist-item" onClick={() => toggleCheck(i)}>
              <div className={`check-box ${checklist[i] ? 'checked' : ''}`}>
                {checklist[i] ? '✓' : ''}
              </div>
              <span style={{ color: checklist[i] ? '#111827' : '#9ca3af' }}>{item}</span>
            </div>
          ))}
        </div>

        {/* Return info */}
        <div className="card">
          <div className="card-title">ข้อมูลตอนรับคืน</div>
          <div className="field-row">
            <label className="field-label">เลขไมล์ตอนรับคืน *</label>
            <input className="field-input" type="number"
              placeholder={String(bike.odometer ?? '')}
              value={odometer}
              onChange={e => setOdometer(e.target.value)}
            />
          </div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">รูปภาพตอนรับคืน</label>
            <PhotoUpload
              icon="📷"
              hint="อัพโหลดรูปรถตอนคืน"
              folder={`return/${bike.id}`}
              onUpload={(url) => setPhotoUrl(url)}
              onRemove={() => setPhotoUrl('')}
            />
          </div>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '10px', padding: '12px', color: '#dc2626',
            fontSize: '14px', marginBottom: '12px',
          }}>
            ⚠️ {error}
          </div>
        )}

        <button
          className="btn btn-success"
          onClick={handleSubmit}
          disabled={loading}
          style={{ width: '100%', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? '⏳ กำลังบันทึก...' : '✅ ยืนยันรับรถคืน'}
        </button>

        <button className="btn" style={{
          width: '100%', marginTop: '8px',
          background: 'transparent', border: '2px solid #7c3aed', color: '#7c3aed',
        }}>
          🧾 ออกใบกำกับภาษี
        </button>

      </div>

      {/* คันนี้ถึงกำหนดรูทีน — เตือนตอนรับคืนสดๆ เลย กันลืมเพราะรถถูกเช่าไปอีกก่อนถึงรอบเช็คเย็น */}
      {routineDue && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(17,24,39,.85)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
        }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '24px', maxWidth: '360px', width: '100%' }}>
            <div style={{ fontSize: '40px', textAlign: 'center', marginBottom: '10px' }}>🛢️</div>
            <div style={{ fontSize: '17px', fontWeight: 800, textAlign: 'center', color: '#111827', marginBottom: '4px' }}>
              {bike.license_plate} ถึงกำหนดบำรุงรักษา
            </div>
            <div style={{ fontSize: '13px', textAlign: 'center', color: '#6b7280', marginBottom: '16px' }}>
              โปรดตรวจสอบก่อนปล่อยเช่าคันนี้อีก
            </div>
            <div style={{ background: '#fef2f2', borderRadius: '12px', padding: '12px 14px', marginBottom: '16px' }}>
              {routineDue.map((r, i) => (
                <div key={i} style={{ padding: '4px 0', borderTop: i > 0 ? '1px solid #fecaca' : 'none' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{r.taskName}</div>
                  <div style={{ fontSize: '12px', color: '#dc2626' }}>{r.dueReason}</div>
                </div>
              ))}
            </div>
            <button
              className="btn btn-success"
              style={{ width: '100%' }}
              onClick={() => router.push('/staff/home')}
            >
              ✓ รับทราบ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
