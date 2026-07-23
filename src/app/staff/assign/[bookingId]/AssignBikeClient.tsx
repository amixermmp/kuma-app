'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type AvailableBike = {
  id: string
  license_plate: string
  brand: string
  model: string
  color: string | null
  year: number | null
  daily_rate: number
  monthly_rate: number | null
  deposit_amount: number
  odometer: number
  available: boolean
}

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  booking: any
  assignedBike: AvailableBike | null
  availableBikes: AvailableBike[]
  staffId: string
  modelOnlyMode: boolean
  modelAvailability: Record<string, boolean>
  reassignReason: string | null
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric',
  })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function AssignBikeClient({ booking, assignedBike, availableBikes, staffId, modelOnlyMode, modelAvailability, reassignReason }: Props) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(assignedBike?.id ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const targetBrand = booking.requested_brand ?? assignedBike?.brand ?? ''
  const targetModel = booking.requested_model ?? assignedBike?.model ?? ''
  const bookingRate = Number(booking.requested_daily_rate ?? booking.daily_rate ?? 0)

  const isSameModel = (b: AvailableBike) => b.brand === targetBrand && b.model === targetModel
  const available = availableBikes.filter(b => b.available && isSameModel(b))
  // รุ่นอื่นที่ว่าง — ตัวเลือกอัพเกรด/ย้ายรุ่น คงราคาเดิมตามใบจอง (แบบโรงแรมย้าย room type)
  const upgradeOptions = availableBikes
    .filter(b => b.available && !isSameModel(b))
    .sort((a, b) => a.daily_rate - b.daily_rate)
  const busy = availableBikes.filter(b => !b.available && isSameModel(b))
  const selectedBike = availableBikes.find(b => b.id === selectedId)
  const selectedIsUpgrade = selectedBike ? !isSameModel(selectedBike) : false

  // ── โหมดเลือกแค่รุ่น (ใช้ตอนแก้ "คิวมีปัญหา") — จัดกลุ่มรถว่างทั้งหมดตามยี่ห้อ+รุ่น ──
  type ModelGroup = { brand: string; model: string; count: number; daily_rate: number }
  const modelGroups: ModelGroup[] = []
  if (modelOnlyMode) {
    const byKey = new Map<string, ModelGroup>()
    for (const b of availableBikes) {
      if (!b.available) continue
      const key = `${b.brand}__${b.model}`
      // เดิมนับรถว่างตรงๆ ไม่กันคิวจองแบบรุ่นอื่นที่แข่งรถชุดเดียวกันอยู่ ทำให้โชว์ "ว่าง" ทั้งที่คิวมีปัญหา
      // จะจับได้ว่าไม่พอถ้าลองสลับไปจริง — ตอนนี้เช็คด้วยการจำลองจัดสรรจริงแล้ว (modelAvailability)
      if (!modelAvailability[key]) continue
      const g = byKey.get(key)
      if (g) g.count += 1
      else byKey.set(key, { brand: b.brand, model: b.model, count: 1, daily_rate: b.daily_rate })
    }
    modelGroups.push(...Array.from(byKey.values()).sort((a, b) =>
      (a.brand === targetBrand && a.model === targetModel ? -1 : 0) - (b.brand === targetBrand && b.model === targetModel ? -1 : 0)
      || a.daily_rate - b.daily_rate
    ))
  }
  const [selectedModelKey, setSelectedModelKey] = useState<string | null>(null)
  const selectedGroup = modelGroups.find(g => `${g.brand}__${g.model}` === selectedModelKey) ?? null

  const handleSaveModel = async () => {
    if (!selectedGroup) { setError('กรุณาเลือกรุ่นก่อน'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/staff/booking/reassign-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, requestedBrand: selectedGroup.brand, requestedModel: selectedGroup.model, reason: reassignReason }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error); return }
      router.push('/staff/jobs')
    } catch { setError('เกิดข้อผิดพลาด') }
    finally { setLoading(false) }
  }

  const doAssign = async (): Promise<boolean> => {
    if (!selectedId) { setError('กรุณาเลือกรถก่อน'); return false }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/staff/booking/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, bikeId: selectedId, staffId }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error); return false }
      return true
    } catch { setError('เกิดข้อผิดพลาด'); return false }
    finally { setLoading(false) }
  }

  const handleConfirm = async () => {
    if (await doAssign()) router.push(`/staff/send/${selectedId}?bookingId=${booking.id}`)
  }

  // ย้ายคันอย่างเดียว (จองยังไม่ถึงวันรับรถ) — ไม่เข้า flow ส่งรถ
  const handleMoveOnly = async () => {
    if (await doAssign()) router.push('/staff/jobs')
  }

  // ถอดคันออก — กลับเป็นจองตามรุ่น
  const handleUnassign = async () => {
    if (!confirm('ถอดคันออกจากการจองนี้ — กลับเป็น "จองตามรุ่น" (staff เลือกคันใหม่ก่อนส่งรถ)?')) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/staff/booking/unassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error); return }
      router.push('/staff/jobs')
    } catch { setError('เกิดข้อผิดพลาด') }
    finally { setLoading(false) }
  }

  if (modelOnlyMode) {
    return (
      <div className="app-wrap">
        <div className="app-header">
          <Link href="/staff/jobs" className="app-header-back">←</Link>
          <div>
            <h1>เปลี่ยนรุ่นที่จอง</h1>
            <div className="sub">เดิม: {targetBrand} {targetModel}</div>
          </div>
        </div>

        <div className="section-pad">
          <div style={{
            background: '#111827', borderRadius: '14px', padding: '14px 16px', marginBottom: '12px', color: '#fff',
          }}>
            <div style={{ fontSize: '13px', opacity: 0.8, marginBottom: '2px' }}>#{booking.booking_ref}</div>
            <div style={{ fontSize: '16px', fontWeight: 800 }}>{booking.customer_name}</div>
            <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '2px' }}>{booking.customer_phone}</div>
            <div style={{ marginTop: '10px', fontSize: '12px', opacity: 0.8 }}>
              📅 {fmtDate(booking.start_datetime)} {fmtTime(booking.start_datetime)} น. → {fmtDate(booking.end_datetime)} {fmtTime(booking.end_datetime)} น.
            </div>
          </div>

          {modelGroups.length === 0 ? (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px',
              padding: '20px', textAlign: 'center', color: '#dc2626', fontSize: '14px',
            }}>
              😔 ไม่มีรุ่นรถว่างในสาขานี้เลยช่วงเวลานี้ — ลองติดต่อลูกค้าเปลี่ยนวัน
            </div>
          ) : (
            <>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' }}>
                เลือกรุ่นที่จะจองแทน ({modelGroups.length} รุ่นว่าง)
              </div>
              {modelGroups.map(g => {
                const key = `${g.brand}__${g.model}`
                const selected = selectedModelKey === key
                const isCurrent = g.brand === targetBrand && g.model === targetModel
                return (
                  <div
                    key={key}
                    onClick={() => setSelectedModelKey(key)}
                    style={{
                      background: selected ? '#fff1f2' : '#fff',
                      border: `2px solid ${selected ? '#e11d48' : '#e5e7eb'}`,
                      borderRadius: '12px', marginBottom: '8px', padding: '12px 14px',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                    }}
                  >
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${selected ? '#e11d48' : '#d1d5db'}`,
                      background: selected ? '#e11d48' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {selected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }} />}
                    </div>
                    <div style={{ fontSize: '28px' }}>🛵</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>
                        {g.brand} {g.model} {isCurrent && <span style={{ color: '#9ca3af', fontWeight: 400 }}>(รุ่นเดิม)</span>}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                        {g.count} คันว่าง
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#e11d48' }}>฿{g.daily_rate.toLocaleString()}</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>/วัน</div>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px',
              padding: '12px', color: '#dc2626', fontSize: '14px', marginTop: '8px',
            }}>⚠️ {error}</div>
          )}

          <button
            onClick={handleSaveModel}
            disabled={loading || !selectedModelKey}
            style={{
              width: '100%', padding: '16px', border: 'none', borderRadius: '12px',
              background: selectedModelKey ? '#e11d48' : '#e5e7eb',
              color: selectedModelKey ? '#fff' : '#9ca3af',
              fontSize: '16px', fontWeight: 700, cursor: selectedModelKey ? 'pointer' : 'default',
              fontFamily: 'inherit', opacity: loading ? 0.7 : 1, marginTop: '16px', marginBottom: '24px',
            }}
          >
            {loading ? '⏳ กำลังบันทึก...' : '💾 บันทึกเปลี่ยนรุ่น'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-wrap">

      <div className="app-header">
        <Link href="/staff/jobs" className="app-header-back">←</Link>
        <div>
          <h1>เลือกรถส่งลูกค้า</h1>
          <div className="sub">{targetBrand} {targetModel}</div>
        </div>
      </div>

      <div className="section-pad">

        {/* Booking summary */}
        <div style={{
          background: '#111827',
          borderRadius: '14px', padding: '14px 16px', marginBottom: '12px', color: '#fff',
        }}>
          <div style={{ fontSize: '13px', opacity: 0.8, marginBottom: '2px' }}>
            #{booking.booking_ref}
          </div>
          <div style={{ fontSize: '16px', fontWeight: 800 }}>{booking.customer_name}</div>
          <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '2px' }}>{booking.customer_phone}</div>
          <div style={{ marginTop: '10px', fontSize: '12px', opacity: 0.8 }}>
            📅 {fmtDate(booking.start_datetime)} {fmtTime(booking.start_datetime)} น.
            {' '}→{' '}
            {fmtDate(booking.end_datetime)} {fmtTime(booking.end_datetime)} น.
          </div>
          <div style={{ marginTop: '6px', display: 'flex', gap: '8px' }}>
            <span style={{ background: 'rgba(255,255,255,.2)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
              {booking.total_days} วัน
            </span>
            <span style={{ background: 'rgba(255,255,255,.2)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
              🛵 {targetBrand} {targetModel}
            </span>
          </div>
        </div>

        {/* Available bikes */}
        {available.length === 0 ? (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px',
            padding: '20px', textAlign: 'center', color: '#dc2626', fontSize: '14px', marginBottom: '12px',
          }}>
            😔 ไม่มี {targetBrand} {targetModel} ว่างในช่วงเวลานี้<br />
            <span style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px', display: 'block' }}>
              ลองเลือกรถรุ่นอื่นหรือติดต่อลูกค้า
            </span>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' }}>
              เลือกรถที่จะส่ง ({available.length} คันว่าง)
            </div>
            {available.map(bike => {
              const selected = selectedId === bike.id
              return (
                <div
                  key={bike.id}
                  onClick={() => setSelectedId(bike.id)}
                  style={{
                    background: selected ? '#fff1f2' : '#fff',
                    border: `2px solid ${selected ? '#e11d48' : '#e5e7eb'}`,
                    borderRadius: '12px', marginBottom: '8px', padding: '12px 14px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                    transition: 'all .15s',
                  }}
                >
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${selected ? '#e11d48' : '#d1d5db'}`,
                    background: selected ? '#e11d48' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <div style={{ fontSize: '28px' }}>🛵</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>
                      {bike.brand} {bike.model}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                      ทะเบียน {bike.license_plate}
                      {bike.color ? ` • ${bike.color}` : ''}
                      {bike.year ? ` • ปี ${bike.year}` : ''}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                      📍 {bike.odometer.toLocaleString()} กม.
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#e11d48' }}>
                      ฿{bike.daily_rate.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>/วัน</div>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* รุ่นอื่น — อัพเกรด/ย้ายรุ่น คงราคาเดิม */}
        {upgradeOptions.length > 0 && (
          <>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#7c3aed', marginTop: '12px', marginBottom: '8px' }}>
              🎁 รุ่นอื่นที่ว่าง — อัพเกรดให้ลูกค้า คงราคาเดิม (฿{bookingRate.toLocaleString()}/วัน)
            </div>
            {upgradeOptions.map(bike => {
              const selected = selectedId === bike.id
              return (
                <div
                  key={bike.id}
                  onClick={() => setSelectedId(bike.id)}
                  style={{
                    background: selected ? '#f5f3ff' : '#fff',
                    border: `2px solid ${selected ? '#7c3aed' : '#e5e7eb'}`,
                    borderRadius: '12px', marginBottom: '8px', padding: '12px 14px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                  }}
                >
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${selected ? '#7c3aed' : '#d1d5db'}`,
                    background: selected ? '#7c3aed' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <div style={{ fontSize: '28px' }}>🛵</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>
                      {bike.brand} {bike.model}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                      ทะเบียน {bike.license_plate}{bike.color ? ` • ${bike.color}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {bike.daily_rate > bookingRate && (
                      <div style={{ fontSize: '11px', color: '#9ca3af', textDecoration: 'line-through' }}>
                        ฿{bike.daily_rate.toLocaleString()}
                      </div>
                    )}
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#7c3aed' }}>
                      ฿{bookingRate.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>/วัน (ราคาจอง)</div>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* Busy bikes (greyed out, not selectable) */}
        {busy.length > 0 && (
          <>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', marginTop: '8px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>
              ไม่ว่างในช่วงเวลานี้
            </div>
            {busy.map(bike => (
              <div key={bike.id} style={{
                background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px',
                marginBottom: '6px', padding: '10px 14px', opacity: 0.5,
                display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <div style={{ fontSize: '24px', filter: 'grayscale(1)' }}>🛵</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#6b7280' }}>
                    {bike.brand} {bike.model} • {bike.license_plate}
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>🔴 ไม่ว่างในช่วงเวลานี้</div>
                </div>
              </div>
            ))}
          </>
        )}

        {selectedBike && (
          <div style={{
            background: selectedIsUpgrade ? '#f5f3ff' : '#f0fdf4',
            border: `1px solid ${selectedIsUpgrade ? '#ddd6fe' : '#bbf7d0'}`, borderRadius: '10px',
            padding: '10px 14px', marginTop: '8px', fontSize: '13px',
            color: selectedIsUpgrade ? '#7c3aed' : '#16a34a',
          }}>
            {selectedIsUpgrade
              ? <>🎁 อัพเกรดเป็น {selectedBike.brand} {selectedBike.model} ทะเบียน {selectedBike.license_plate} — <strong>คิดราคาเดิม ฿{bookingRate.toLocaleString()}/วัน</strong></>
              : <>✅ เลือกแล้ว: {selectedBike.brand} {selectedBike.model} ทะเบียน {selectedBike.license_plate}</>}
          </div>
        )}

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px',
            padding: '12px', color: '#dc2626', fontSize: '14px', marginTop: '8px',
          }}>
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={loading || !selectedId}
          style={{
            width: '100%', padding: '16px', border: 'none', borderRadius: '12px',
            background: selectedId ? '#e11d48' : '#e5e7eb',
            color: selectedId ? '#fff' : '#9ca3af',
            fontSize: '16px', fontWeight: 700, cursor: selectedId ? 'pointer' : 'default',
            fontFamily: 'inherit', opacity: loading ? 0.7 : 1, marginTop: '16px',
          }}
        >
          {loading ? '⏳ กำลังดำเนินการ...' : '🛵 ยืนยัน — ไปหน้าส่งรถ →'}
        </button>

        <button
          onClick={handleMoveOnly}
          disabled={loading || !selectedId}
          style={{
            width: '100%', padding: '13px', borderRadius: '12px',
            background: '#fff', border: '2px solid #111827',
            color: selectedId ? '#111827' : '#9ca3af',
            fontSize: '14px', fontWeight: 700, cursor: selectedId ? 'pointer' : 'default',
            fontFamily: 'inherit', opacity: loading ? 0.7 : 1, marginTop: '8px',
          }}
        >
          💾 บันทึกย้ายคันอย่างเดียว (ยังไม่ส่งรถ)
        </button>

        {assignedBike && (
          <button
            onClick={handleUnassign}
            disabled={loading}
            style={{
              width: '100%', padding: '13px', borderRadius: '12px',
              background: '#fff', border: '1px solid #e5e7eb',
              color: '#6b7280', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', marginTop: '8px', marginBottom: '24px',
            }}
          >
            ↩️ ถอดคันนี้ออก — กลับเป็นจองตามรุ่น (ไม่ผูกคัน)
          </button>
        )}

      </div>
    </div>
  )
}
