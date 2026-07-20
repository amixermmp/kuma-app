'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PhotoUpload from '@/components/PhotoUpload'
import TabBar from '@/components/staff/TabBar'
import { addTab } from '@/lib/tabStore'
import { calcRentQuote } from '@/lib/pricing'

type Rental = {
  id: string
  start_datetime: string
  expected_end_datetime: string
  total_amount: number
  deposit_amount: number
  daily_rate: number
  total_days: number
  outstanding_credit: number
  status: string
  notes: string | null
  bikes: { id: string; license_plate: string; brand: string; model: string; odometer: number; daily_rate: number; monthly_rate: number | null }
  customers: { id: string; name: string; phone: string }
}

type Props = {
  rental: Rental
  staffId: string
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

export default function ReturnCarForm({ rental, staffId }: Props) {
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

  // Overtime — grace period 0–30 นาที = ฟรี, หลังจากนั้นคิดเป็นชั่วโมง
  const HOURLY_RATE = 50
  const now = Date.now()
  const expectedMs = new Date(rental.expected_end_datetime).getTime()
  const isLate = now > expectedMs
  const lateMs = Math.max(0, now - expectedMs)
  const lateMinutes = lateMs / 60_000
  // 0–30 min grace → 0 ชั่วโมง; เกิน 30 นาที → เศษ ≤30 นาทีในชั่วโมงนั้นไม่ปัดขึ้น, >30 นาที ปัดขึ้น
  const lateWholeHours = Math.floor(lateMs / 3_600_000)
  const lateRemainMs = lateMs % 3_600_000
  const lateHours = lateMinutes <= 30 ? 0 : lateWholeHours + (lateRemainMs > 30 * 60_000 ? 1 : 0)
  const lateChargeIsDay = lateHours >= 5
  const grossOvertimeCharge = lateHours === 0 ? 0
    : lateChargeIsDay ? Math.ceil(lateHours / 24) * rental.daily_rate
    : lateHours * HOURLY_RATE
  // หักเครดิตที่ลูกค้าจ่ายค้างไว้จากการต่อเวลาก่อนหน้า
  const credit = rental.outstanding_credit ?? 0
  const overtimeCharge = Math.max(0, grossOvertimeCharge - credit)

  // คืนรถก่อนกำหนด (เกิน 1 ชม.ก่อนกำหนดถือว่า early) — คิดค่าเช่าใหม่ตามวันที่ใช้จริง
  // ด้วยเรทปกติของรถ (ไม่ใช้ส่วนลด/โปรที่ตกลงไว้ตอนจอง) แล้วคืนส่วนต่างจากที่จ่ายไปแล้ว
  // สมมติฐาน: วันที่ใช้จริงปัดขึ้นเป็นวันเต็ม (ใช้เกินเที่ยงคืนแล้วนับเป็นอีกวัน) — มาตรฐานร้านเช่ารถทั่วไป
  const isEarly = now < expectedMs - 3_600_000
  const usedDaysMs = Math.max(0, now - new Date(rental.start_datetime).getTime())
  const actualDaysUsed = Math.max(1, Math.ceil(usedDaysMs / 86_400_000))
  const normalMonthlyRate = bike.monthly_rate || bike.daily_rate * 30
  const recalculatedCharge = isEarly
    ? calcRentQuote(new Date(rental.start_datetime), actualDaysUsed, bike.daily_rate, normalMonthlyRate).total
    : rental.total_amount
  // คืนเฉพาะกรณีจ่ายไปแล้วมากกว่าที่ควรจ่ายจริง — ไม่มีทางเรียกเก็บเพิ่มจากการคืนก่อน
  const earlyReturnRefund = isEarly ? Math.max(0, rental.total_amount - recalculatedCharge) : 0

  const [checklist, setChecklist] = useState<boolean[]>(CHECKLIST.map(() => true))
  const [odometer, setOdometer] = useState('')
  const [fuelLevel, setFuelLevel] = useState(8)
  const [photoUrl, setPhotoUrl] = useState('')
  const [damageFee, setDamageFee] = useState('0')
  const [damageNotes, setDamageNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [overrideOvertime, setOverrideOvertime] = useState('')

  const damage = parseFloat(damageFee) || 0
  const finalOvertimeCharge = overrideOvertime !== '' ? Math.max(0, parseFloat(overrideOvertime) || 0) : overtimeCharge
  const netRefund = rental.deposit_amount - finalOvertimeCharge - damage + earlyReturnRefund

  const toggleCheck = useCallback((i: number) => {
    setChecklist(prev => prev.map((v, idx) => idx === i ? !v : v))
  }, [])

  const handleSubmit = async () => {
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
          returnFuel: fuelLevel,
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
            <label className="field-label">เลขไมล์ตอนรับคืน</label>
            <input className="field-input" type="number"
              placeholder={String(bike.odometer ?? '')}
              value={odometer}
              onChange={e => setOdometer(e.target.value)}
            />
          </div>
          <div className="field-row">
            <label className="field-label">ระดับน้ำมันตอนรับคืน ({fuelLevel}/8)</label>
            <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} onClick={() => setFuelLevel(i + 1)} style={{
                  flex: 1, height: '30px', borderRadius: '4px', cursor: 'pointer',
                  background: i < fuelLevel ? '#16a34a' : '#e5e7eb',
                  transition: 'background .1s',
                }} />
              ))}
            </div>
          </div>
          <div className="field-row">
            <label className="field-label">รูปภาพตอนรับคืน</label>
            <PhotoUpload
              icon="📷"
              hint="อัพโหลดรูปรถตอนคืน"
              folder={`return/${bike.id}`}
              onUpload={(url) => setPhotoUrl(url)}
              onRemove={() => setPhotoUrl('')}
            />
          </div>
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

        {/* Overtime charge */}
        {lateHours > 0 && (
          <div style={{
            background: '#fef2f2', border: '2px solid #fecaca',
            borderRadius: '14px', padding: '14px 18px', marginBottom: '10px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#dc2626', marginBottom: '6px' }}>
              ⏱ คืนรถช้า — ค่าล่วงเวลา
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: credit > 0 ? '6px' : '0' }}>
              <span style={{ fontSize: '13px', color: '#374151' }}>
                {lateChargeIsDay
                  ? `เกิน ${lateHours} ชม. → คิด ${Math.ceil(lateHours / 24)} วัน × ฿${rental.daily_rate.toLocaleString()}`
                  : `เกิน ${lateHours} ชม. × ฿${HOURLY_RATE}/ชม.`}
              </span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#dc2626', textDecoration: credit > 0 ? 'line-through' : 'none', opacity: credit > 0 ? 0.6 : 1 }}>
                ฿{grossOvertimeCharge.toLocaleString()}
              </span>
            </div>
            {credit > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', color: '#16a34a' }}>💳 หักเครดิตที่จ่ายไว้แล้ว</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a' }}>−฿{Math.min(credit, grossOvertimeCharge).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #fecaca', paddingTop: '6px' }}>
                  <span style={{ fontSize: '13px', color: '#374151', fontWeight: 600 }}>คงเหลือ</span>
                  <span style={{ fontSize: '20px', fontWeight: 900, color: finalOvertimeCharge > 0 ? '#dc2626' : '#16a34a' }}>
                    {finalOvertimeCharge > 0 ? `+฿${finalOvertimeCharge.toLocaleString()}` : '฿0 (ชำระครบ)'}
                  </span>
                </div>
              </>
            )}
            {credit === 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span />
                <span style={{ fontSize: '20px', fontWeight: 900, color: finalOvertimeCharge > 0 ? '#dc2626' : '#16a34a' }}>
                  {finalOvertimeCharge > 0 ? `+฿${finalOvertimeCharge.toLocaleString()}` : '฿0'}
                </span>
              </div>
            )}
            {/* Manual override */}
            <div style={{ marginTop: '10px', borderTop: '1px solid #fecaca', paddingTop: '10px' }}>
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
                  border: overrideOvertime !== '' ? '2px solid #dc2626' : '1.5px solid #fca5a5',
                  fontSize: '16px', fontWeight: 700, background: '#fff',
                  boxSizing: 'border-box', fontFamily: 'inherit',
                }}
              />
              {overrideOvertime !== '' && (
                <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px', fontWeight: 600 }}>
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
              ใช้จริง {actualDaysUsed} วัน × เรทปกติ (ไม่รวมส่วนลด/โปรตอนจอง) = ฿{recalculatedCharge.toLocaleString()}
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

        {/* Deposit refund / extra charge */}
        <div style={{
          background: netRefund >= 0 ? '#f0fdf4' : '#fff7ed',
          border: `2px solid ${netRefund >= 0 ? '#bbf7d0' : '#fed7aa'}`,
          borderRadius: '14px', padding: '18px 20px', marginBottom: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '13px', color: netRefund >= 0 ? '#16a34a' : '#ea580c', fontWeight: 600 }}>
              {netRefund >= 0 ? '💰 คืนเงินมัดจำให้ลูกค้า' : '⚠️ มัดจำไม่พอ — เก็บเงินเพิ่ม'}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
              {netRefund >= 0
                ? `มัดจำ ฿${rental.deposit_amount.toLocaleString()}`
                  + (finalOvertimeCharge > 0 ? ` − ล่วงเวลา ฿${finalOvertimeCharge.toLocaleString()}` : '')
                  + (damage > 0 ? ` − เสียหาย ฿${damage.toLocaleString()}` : '')
                  + (earlyReturnRefund > 0 ? ` + คืนค่าเช่า ฿${earlyReturnRefund.toLocaleString()}` : '')
                : `ล่วงเวลา (หลังหักเครดิต) ฿${finalOvertimeCharge.toLocaleString()} เกินมัดจำ ฿${rental.deposit_amount.toLocaleString()}`}
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: netRefund >= 0 ? '#15803d' : '#ea580c' }}>
            ฿{Math.abs(netRefund).toLocaleString()}
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
    </div>
  )
}
