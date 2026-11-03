'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { confirmOdometerClient } from '@/lib/odometerCheck'
import { computeNet, type Settlement } from '@/lib/monthlySettlement'

type Bike = { license_plate: string; brand: string; model: string; odometer: number }
type Customer = { name: string; phone: string }

type MonthlyRental = {
  id: string
  start_date: string
  payment_day: number | null
  monthly_rate: number
  deposit_amount: number
  deposit_method: string | null
}

type Props = {
  rental: MonthlyRental
  bike: Bike
  customer: Customer
  settlement: Settlement
  formulaBike: { plate: string; dailyRate: number; source: 'current' | 'previous' | 'previous_missing' }
  depositCash: number
  totalCollected: number
  monthsRented: number
  isThaiId: boolean
}

function fmtDate(iso: string) {
  return new Date(`${iso}T00:00:00+07:00`).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric',
  })
}

const baht = (n: number) => `฿${Math.abs(n).toLocaleString()}`

export default function MonthlyEndClient({ rental, bike, customer, settlement: s, formulaBike, depositCash, totalCollected, monthsRented, isThaiId }: Props) {
  const router = useRouter()

  const [returnOdometer, setReturnOdometer] = useState(String(bike.odometer ?? ''))
  const [returnNote, setReturnNote]         = useState('')
  const [photos, setPhotos]                 = useState<string[]>([])
  const [uploading, setUploading]           = useState(false)
  const [overdueDays, setOverdueDays]       = useState('')
  const [damage, setDamage]                 = useState('')
  const [fuel, setFuel]                     = useState('')
  const [method, setMethod]                 = useState<'cash' | 'transfer' | null>(isThaiId ? 'transfer' : null)
  const [slipUrl, setSlipUrl]               = useState('')
  const [slipUploading, setSlipUploading]   = useState(false)
  const [confirmed, setConfirmed]           = useState(false)
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState('')

  // ตัวเลขสดตามที่พนักงานกรอก — ใช้ตัวคิดตัวเดียวกับ API (API คิดซ้ำอีกรอบตอนกดยืนยัน ไม่เชื่อค่าจากหน้านี้)
  const net = computeNet(s, depositCash, { overdueDays, damage, fuel })
  const overdueTooMany = net.overdueDays > s.overdueDays
  const collecting = net.netToCustomer < 0

  const upload = async (file: File): Promise<string | null> => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/staff/upload', { method: 'POST', body: form })
    const data = await res.json()
    return res.ok && data.url ? data.url : null
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await upload(file)
      if (url) setPhotos(prev => [...prev, url])
    } finally {
      setUploading(false)
    }
  }

  const handleSlipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSlipUploading(true)
    try {
      const url = await upload(file)
      if (url) setSlipUrl(url)
    } finally {
      setSlipUploading(false)
    }
  }

  const handleConfirm = async () => {
    if (!confirmed) { setError('กรุณากดยืนยันก่อน'); return }
    if (overdueTooMany) { setError(`คิดวันเกินกำหนดได้ไม่เกิน ${s.overdueDays} วัน`); return }
    if (collecting && !method) { setError('กรุณาเลือกวิธีรับเงินที่เก็บเพิ่ม (เงินสด/โอน)'); return }
    if (returnOdometer) {
      const odoCheck = confirmOdometerClient(Number(returnOdometer), bike.odometer)
      if (!odoCheck.ok) { setError(odoCheck.error); return }
    }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/staff/monthly/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthlyRentalId: rental.id,
          returnPhotos: photos.length > 0 ? photos : null,
          returnNote: returnNote.trim() || null,   // API maps → notes
          returnOdometer: returnOdometer ? Number(returnOdometer) : null,
          overdueDays: net.overdueDays,
          damageAmount: net.damage,
          fuelAmount: net.fuel,
          paymentMethod: collecting ? method : null,
          slipUrl: collecting && slipUrl ? slipUrl : null,
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

  const adj = s.rentAdjustment
  const row = (key: string, val: string, color?: string, bold?: boolean) => (
    <div className="info-row">
      <span className="info-key">{key}</span>
      <span className="info-val" style={{ color, fontWeight: bold ? 700 : undefined }}>{val}</span>
    </div>
  )

  return (
    <div className="app-wrap">

      {/* Header */}
      <div className="app-header" style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
        <Link href={`/staff/collect/${rental.id}`} className="app-header-back">←</Link>
        <div>
          <h1>สิ้นสุดสัญญาเช่ารายเดือน</h1>
          <div className="sub">{bike.license_plate} {bike.brand} {bike.model}</div>
        </div>
      </div>

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

        {/* Contract summary */}
        <div className="card" style={{ borderTop: '3px solid #dc2626' }}>
          <div className="card-title">สรุปสัญญา</div>
          {row('ผู้เช่า', customer.name)}
          {row('เบอร์โทร', customer.phone)}
          {row('รถ', `${bike.license_plate} ${bike.brand} ${bike.model}`)}
          {row('เริ่มสัญญา', fmtDate(rental.start_date))}
          {row('เช่ามาแล้ว', `${monthsRented} เดือน`, '#7c3aed', true)}
          {row('ค่าเช่า/เดือน', `฿${rental.monthly_rate.toLocaleString()}`)}
          {row('รวมรับไปแล้ว', `฿${totalCollected.toLocaleString()}`, '#16a34a', true)}
          {row('มัดจำ', rental.deposit_method === 'id_card' ? 'วางบัตรประชาชน' : `฿${rental.deposit_amount.toLocaleString()}`)}
        </div>

        {/* ใบสรุปค่าเช่าเดือนปัจจุบัน */}
        <div className="card" style={{ border: '2px solid #bbf7d0', background: '#f0fdf4' }}>
          <div className="card-title" style={{ color: '#15803d' }}>🧾 สรุปค่าเช่าตอนคืนรถ</div>

          {!s.hasPeriod ? (
            <div style={{ fontSize: '13px', color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px' }}>
              ไม่พบรายการรับค่าเช่าของสัญญานี้ — ระบบไม่คิดค่าเช่าให้ กรอกส่วนที่เหลือเองได้ด้านล่าง
            </div>
          ) : (
            <>
              {s.periodStart && s.periodEnd && row('เดือนที่คิด', `${fmtDate(s.periodStart)} – ${fmtDate(s.periodEnd)}`)}
              {s.periodStart && (
                s.reachedEnd
                  ? row('สถานะ', 'ถึง/เลยวันครบดีลแล้ว — คิดเต็มเดือน', '#374151')
                  : row('สถานะ', `คืนก่อนครบ — ใช้จริง ${s.daysUsed} วัน`, '#374151', true)
              )}
              {row('ราคาเดือนตามสัญญา', `฿${s.contractRate.toLocaleString()}${s.usedSwapRate ? ' (ราคาก่อนสลับคัน)' : ''}`)}
              {row('จ่ายค่าเช่างวดนี้แล้ว', `฿${s.paidCurrent.toLocaleString()}`)}
              {s.futurePaid > 0 && row('จ่ายล่วงหน้า (ยังไม่ได้ใช้)', `฿${s.futurePaid.toLocaleString()}`, '#7c3aed')}
              {s.periodStart && row('ค่าใช้จริง', `฿${s.charge.toLocaleString()}`, '#111827', true)}

              {!s.reachedEnd && s.periodStart && !s.dailyRateMissing && (
                <div style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 8px' }}>
                  {s.daysUsed} วัน × เรทรายวัน ฿{formulaBike.dailyRate.toLocaleString()} (โปร 7 วันจ่าย 5 ไม่เกินราคาเดือนตามสัญญา)
                  {formulaBike.source === 'previous' && ` — ใช้เรทคันเดิม ${formulaBike.plate} เพราะสลับคันในเดือนนี้`}
                </div>
              )}
              {formulaBike.source === 'previous_missing' && (
                <div style={{ fontSize: '12px', color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '8px 10px', margin: '6px 0' }}>
                  ⚠️ เคยสลับคันในเดือนนี้ แต่หาคันเดิมไม่เจอ — ใช้เรทรายวันของคันปัจจุบันคิดแทน ทักหาผู้จัดการถ้าตัวเลขดูไม่ถูก
                </div>
              )}
              {s.dailyRateMissing && !s.reachedEnd && (
                <div style={{ fontSize: '12px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '8px 10px', margin: '6px 0' }}>
                  ⚠️ ไม่พบเรทรายวันของรถรุ่นนี้ — ระบบไม่คืนเงินค่าเช่าให้ ทักหาผู้จัดการให้ตั้งราคาก่อน
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '10px', borderTop: '1px dashed #86efac' }}>
                <span style={{ fontSize: '13px', color: '#374151' }}>ผลค่าเช่า</span>
                <span style={{ fontSize: '20px', fontWeight: 900, color: adj < 0 ? '#15803d' : adj > 0 ? '#dc2626' : '#6b7280' }}>
                  {adj < 0 ? `คืนลูกค้า ${baht(adj)}` : adj > 0 ? `เก็บเพิ่ม ${baht(adj)}` : 'ไม่มีส่วนต่าง'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* ค่าใช้จ่ายอื่นที่พนักงานกรอก */}
        <div className="card">
          <div className="card-title">ค่าใช้จ่ายอื่น (ถ้ามี)</div>

          <div className="field-row">
            <label className="field-label">
              ค่าวันเกินกำหนด (จำนวนวันที่จะคิด)
              {s.overdueDays > 0 && <span style={{ color: '#dc2626', fontWeight: 700 }}> — เลยวันครบดีลมา {s.overdueDays} วัน</span>}
            </label>
            <input
              className="field-input" type="number" min={0} inputMode="numeric"
              placeholder="0 = ไม่คิด (หยวน)"
              disabled={s.overdueDays === 0}
              value={overdueDays} onChange={e => setOverdueDays(e.target.value)}
            />
            {s.overdueDays === 0 ? (
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>ยังไม่เลยวันครบดีล — คิดค่าวันเกินกำหนดไม่ได้</div>
            ) : (
              <div style={{ fontSize: '11px', color: overdueTooMany ? '#dc2626' : '#6b7280', marginTop: '4px' }}>
                {overdueTooMany
                  ? `คิดได้ไม่เกิน ${s.overdueDays} วัน`
                  : `คิดวันละ ฿${Math.round(s.currentDailyRate).toLocaleString()} (เรทรายวันเต็ม ไม่มีโปร)${net.overdueDays > 0 ? ` = ฿${net.overdueCharge.toLocaleString()}` : ''}`}
              </div>
            )}
          </div>

          <div className="field-row">
            <label className="field-label">ค่าเสียหาย (บาท) — หักจากมัดจำ</label>
            <input className="field-input" type="number" min={0} inputMode="numeric" placeholder="0" value={damage} onChange={e => setDamage(e.target.value)} />
          </div>

          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">ค่าน้ำมัน (บาท) — หักจากมัดจำ</label>
            <input className="field-input" type="number" min={0} inputMode="numeric" placeholder="0" value={fuel} onChange={e => setFuel(e.target.value)} />
          </div>
        </div>

        {/* ยอดสุทธิ */}
        <div className="card" style={{ border: `2px solid ${collecting ? '#fecaca' : '#bbf7d0'}` }}>
          <div className="card-title">ยอดสุทธิ</div>
          {row('มัดจำเงินสด', rental.deposit_method === 'id_card' ? 'วางบัตร (ไม่มีเงินมัดจำ)' : `+ ฿${depositCash.toLocaleString()}`)}
          {adj !== 0 && row(adj < 0 ? 'คืนค่าเช่าส่วนที่ไม่ได้ใช้' : 'ค่าเช่าที่ต้องเก็บเพิ่ม', `${adj < 0 ? '+' : '−'} ${baht(adj)}`)}
          {net.overdueCharge > 0 && row(`ค่าวันเกินกำหนด ${net.overdueDays} วัน`, `− ฿${net.overdueCharge.toLocaleString()}`)}
          {net.damage > 0 && row('ค่าเสียหาย', `− ฿${net.damage.toLocaleString()}`)}
          {net.fuel > 0 && row('ค่าน้ำมัน', `− ฿${net.fuel.toLocaleString()}`)}
          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #d1d5db', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>{collecting ? 'ต้องเก็บเพิ่มจากลูกค้า' : 'คืนให้ลูกค้า'}</div>
            <div style={{ fontSize: '30px', fontWeight: 900, color: collecting ? '#dc2626' : '#15803d' }}>
              ฿{Math.abs(net.netToCustomer).toLocaleString()}
            </div>
          </div>

          {collecting && (
            <div style={{ marginTop: '12px' }}>
              <label className="field-label">วิธีรับเงินที่เก็บเพิ่ม</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                {(['cash', 'transfer'] as const).map(m => {
                  const disabled = m === 'cash' && isThaiId
                  const active = method === m
                  return (
                    <button key={m} type="button" disabled={disabled} onClick={() => setMethod(m)} style={{
                      flex: 1, padding: '10px', borderRadius: '10px', fontSize: '14px', fontWeight: 700,
                      border: `2px solid ${active ? '#dc2626' : '#e5e7eb'}`,
                      background: active ? '#fef2f2' : '#fff',
                      color: disabled ? '#d1d5db' : active ? '#dc2626' : '#374151',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                    }}>{m === 'cash' ? '💵 เงินสด' : '📲 โอน'}</button>
                  )
                })}
              </div>
              {isThaiId && <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>บัตรประชาชนไทย — รับเงินสดไม่ได้ ต้องโอนเท่านั้น</div>}
              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                border: '2px dashed #d1d5db', borderRadius: '10px', padding: '10px',
                cursor: slipUploading ? 'not-allowed' : 'pointer', color: '#6b7280', fontSize: '13px',
              }}>
                <input type="file" accept="image/*" onChange={handleSlipUpload} disabled={slipUploading} style={{ display: 'none' }} />
                {slipUploading ? '⏳ กำลังอัปโหลด...' : slipUrl ? '✅ แนบสลิปแล้ว (กดเพื่อเปลี่ยน)' : '📷 แนบสลิป/หลักฐานการรับเงิน (ถ้ามี)'}
              </label>
            </div>
          )}
        </div>

        {/* Return info */}
        <div className="card">
          <div className="card-title">บันทึกการคืนรถ</div>

          <div className="field-row">
            <label className="field-label">เลขไมล์ตอนคืน (กม.)</label>
            <input
              className="field-input"
              type="number"
              placeholder={String(bike.odometer ?? 0)}
              value={returnOdometer}
              onChange={e => setReturnOdometer(e.target.value)}
            />
          </div>

          <div className="field-row">
            <label className="field-label">หมายเหตุ (สภาพรถ, ความเสียหาย ฯลฯ)</label>
            <input
              className="field-input"
              type="text"
              placeholder="เช่น คืนสภาพดี / มีรอยขีดข้างซ้าย"
              value={returnNote}
              onChange={e => setReturnNote(e.target.value)}
            />
          </div>

          {/* Photo upload */}
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">รูปถ่ายสภาพรถ (ถ้ามี)</label>
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              border: '2px dashed #d1d5db', borderRadius: '10px', padding: '14px',
              cursor: uploading ? 'not-allowed' : 'pointer', color: '#6b7280', fontSize: '14px',
            }}>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} style={{ display: 'none' }} />
              {uploading ? '⏳ กำลังอัปโหลด...' : '📷 เพิ่มรูป'}
            </label>
            {photos.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                {photos.map((url, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                    <button
                      onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                      style={{
                        position: 'absolute', top: '-6px', right: '-6px',
                        background: '#dc2626', color: '#fff', border: 'none',
                        borderRadius: '50%', width: '18px', height: '18px',
                        fontSize: '10px', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Confirm checkbox */}
        <div className="card" style={{ border: '1.5px solid #dc2626' }}>
          <div style={{ fontSize: '14px', color: '#111827', lineHeight: 1.6, marginBottom: '14px' }}>
            <strong style={{ color: '#dc2626' }}>⚠️ ยืนยันสิ้นสุดสัญญา</strong><br />
            หลังจากกดยืนยัน รถ <strong>{bike.license_plate}</strong> จะกลับสู่สถานะ <strong>ว่าง</strong> และสัญญาเช่าจะถูกปิดถาวร
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: '#dc2626', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#dc2626' }}>
              {collecting
                ? `ฉันยืนยันว่าลูกค้าคืนรถแล้ว และเก็บเงินเพิ่ม ฿${Math.abs(net.netToCustomer).toLocaleString()} แล้ว`
                : net.netToCustomer > 0
                  ? `ฉันยืนยันว่าลูกค้าคืนรถแล้ว และคืนเงิน ฿${net.netToCustomer.toLocaleString()} ให้ลูกค้าแล้ว`
                  : 'ฉันยืนยันว่าลูกค้าคืนรถแล้ว'}
            </span>
          </label>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', color: '#dc2626', fontSize: '14px', marginBottom: '12px' }}>
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={loading || !confirmed}
          style={{
            width: '100%',
            background: confirmed ? '#dc2626' : '#e5e7eb',
            color: confirmed ? '#fff' : '#9ca3af',
            border: 'none', borderRadius: '12px', padding: '16px',
            fontSize: '16px', fontWeight: 700, cursor: confirmed ? 'pointer' : 'not-allowed',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '⏳ กำลังบันทึก...' : '🚫 ยืนยันสิ้นสุดสัญญา'}
        </button>

        <div style={{ height: '24px' }} />
      </div>
    </div>
  )
}
