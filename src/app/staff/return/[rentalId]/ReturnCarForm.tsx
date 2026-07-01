'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PhotoUpload from '@/components/PhotoUpload'
import TabBar from '@/components/staff/TabBar'
import { addTab } from '@/lib/tabStore'

type Rental = {
  id: string
  start_datetime: string
  expected_end_datetime: string
  total_amount: number
  deposit_amount: number
  daily_rate: number
  total_days: number
  status: string
  notes: string | null
  bikes: { id: string; license_plate: string; brand: string; model: string; odometer: number }
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

  // Late/early calculation
  const now = Date.now()
  const expectedMs = new Date(rental.expected_end_datetime).getTime()
  const isLate = now > expectedMs
  const extraDays = isLate ? Math.ceil((now - expectedMs) / 86_400_000) : 0
  const baseRent = rental.total_amount + extraDays * rental.daily_rate

  const [checklist, setChecklist] = useState<boolean[]>(CHECKLIST.map(() => true))
  const [odometer, setOdometer] = useState('')
  const [fuelLevel, setFuelLevel] = useState(4)
  const [photoUrl, setPhotoUrl] = useState('')
  const [damageFee, setDamageFee] = useState('0')
  const [damageNotes, setDamageNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const damage = parseFloat(damageFee) || 0
  const refund = rental.deposit_amount - baseRent - damage

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
          refundAmount: refund,
          checklistPassed: checklist,
          finalRentAmount: baseRent,
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
            <span className="info-val" style={{ color: isLate ? '#dc2626' : '#16a34a' }}>
              {fmtDate(new Date().toISOString())}
              {isLate ? ` (เกิน ${extraDays} วัน)` : now < expectedMs - 3_600_000 ? ' (คืนก่อนกำหนด)' : ' (คืนตามกำหนด)'}
            </span>
          </div>
          <div className="info-row">
            <span className="info-key">ค่าเช่าที่คิด</span>
            <span className="info-val" style={{ color: '#111827' }}>
              ฿{baseRent.toLocaleString()}
              {extraDays > 0 && (
                <span style={{ fontSize: '11px', color: '#dc2626', marginLeft: '6px' }}>
                  (+{extraDays} วัน × ฿{rental.daily_rate.toLocaleString()})
                </span>
              )}
            </span>
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

        {/* Financial summary */}
        <div className="card">
          <div className="card-title">สรุปการเงิน</div>
          <div className="info-row">
            <span className="info-key">ค่าเช่า</span>
            <span className="info-val">฿{baseRent.toLocaleString()}</span>
          </div>
          <div className="info-row">
            <span className="info-key">ค่าเสียหาย</span>
            <span className="info-val" style={{ color: damage > 0 ? '#dc2626' : 'inherit' }}>
              ฿{damage.toLocaleString()}
            </span>
          </div>
          <div className="info-row">
            <span className="info-key">เงินมัดจำที่รับไว้</span>
            <span className="info-val">฿{rental.deposit_amount.toLocaleString()}</span>
          </div>
          <div className="info-row" style={{ borderTop: '2px solid #e5e7eb', paddingTop: '10px', marginTop: '2px' }}>
            <span className="info-key" style={{ fontWeight: 700 }}>
              {refund >= 0 ? 'คืนเงินลูกค้า' : 'ลูกค้าต้องจ่ายเพิ่ม'}
            </span>
            <span className="info-val" style={{
              color: refund >= 0 ? '#16a34a' : '#dc2626',
              fontSize: '20px', fontWeight: 800,
            }}>
              ฿{Math.abs(refund).toLocaleString()}
            </span>
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
