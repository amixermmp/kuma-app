'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PhotoUpload from '@/components/PhotoUpload'
import { confirmOdometerClient } from '@/lib/odometerCheck'
import type { RoutineItem } from './page'
import { CYCLE_LENGTH, gearDueThisChange, nextEnginePosition } from '@/lib/routineCycle'

function urgencyColor(u: RoutineItem['urgency']) {
  if (u === 'overdue') return '#dc2626'
  if (u === 'warning') return '#d97706'
  return '#16a34a'
}

function RoutineCard({ r }: { r: RoutineItem }) {
  const router = useRouter()
  const [shop, setShop] = useState('')
  const [cost, setCost] = useState('')
  const [doneKm, setDoneKm] = useState(String(r.bikes?.odometer ?? ''))
  const [receiptUrl, setReceiptUrl] = useState('')
  const [usedShopOil, setUsedShopOil] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const color = urgencyColor(r.urgency)
  const isKmBased = r.interval_km != null
  const isActionable = true // ทำรายการได้ตลอด ไม่ต้องรอใกล้ครบกำหนด
  const oilType = r.oil_type
  const shopOilOut = oilType != null && (r.shop_oil_qty ?? 0) <= 0

  // น้ำมันเครื่องของรถที่เฟืองท้ายตามรอบ: รอบที่ 3 ขึ้นไป (หรือค้างจากรอบก่อน) ติ๊กเปลี่ยนเฟืองท้ายด้วยไว้ให้ ติ๊กออกได้ถ้าครั้งนี้ไม่ได้ทำ
  const cycle = r.gear_cycle ?? null
  const gearOffered = cycle != null && gearDueThisChange(cycle.count)
  const gearBacklog = cycle != null && cycle.count + 1 > CYCLE_LENGTH
  // ถึงรอบแล้ว → ติ๊กไว้ให้เลย / ยังไม่ถึงรอบ → ซ่อนเป็นบรรทัดเทา แตะแล้วค่อยขยาย (เปลี่ยนพร้อมนอกรอบ ไม่ติ๊กไว้ให้)
  const [alsoGear, setAlsoGear] = useState(gearOffered)
  const [gearExpanded, setGearExpanded] = useState(false)
  const [gearUsedShopOil, setGearUsedShopOil] = useState<boolean | null>(null)
  const gearShopOut = cycle != null && cycle.gearShopQty <= 0
  const showGearBox = cycle != null && (gearOffered || gearExpanded)
  const doingGear = showGearBox && alsoGear

  const handleSave = async () => {
    if (oilType && usedShopOil === null) { setError('กรุณาเลือกว่าใช้น้ำมันร้านหรือไม่'); return }
    if (doingGear && gearUsedShopOil === null) { setError('กรุณาเลือกว่าใช้น้ำมันเฟืองท้ายร้านหรือไม่'); return }
    if (doneKm) {
      const odoCheck = confirmOdometerClient(parseInt(doneKm), r.bikes?.odometer)
      if (!odoCheck.ok) { setError(odoCheck.error); return }
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/staff/routine/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routineId: r.id,
          bikeId: r.bike_id,
          doneKm: doneKm ? parseInt(doneKm) : null,
          shop: shop.trim() || null,
          cost: cost ? parseFloat(cost) : null,
          receiptUrl: receiptUrl || null,
          intervalKm: r.interval_km,
          intervalDays: r.interval_days,
          oilType,
          usedShopOil: oilType ? usedShopOil : null,
          ...(cycle ? { alsoGear: doingGear, gearUsedShopOil: doingGear ? gearUsedShopOil : null } : {}),
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error); return }
      setSaved(true)
      router.refresh()
    } catch { setError('เกิดข้อผิดพลาด') }
    finally { setLoading(false) }
  }

  return (
    <div className="card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="card-title" style={{ color }}>
        {r.urgency === 'overdue' ? '🚨 ถึงกำหนดแล้ว!' : r.urgency === 'warning' ? '⚠️ ใกล้ถึงกำหนด' : '✅ ปกติ'}
      </div>
      <div className="info-row">
        <span className="info-key">งาน</span>
        <span className="info-val">{r.oil_type === 'engine' ? '🛢️ ' : r.oil_type === 'gear' ? '⚙️ ' : ''}{r.task_name}</span>
      </div>
      <div className="info-row">
        <span className="info-key">ทะเบียนรถ</span>
        <span className="info-val">{r.bikes?.license_plate} {r.bikes?.brand} {r.bikes?.model}</span>
      </div>
      {isKmBased && (
        <div className="info-row">
          <span className="info-key">ไมล์ปัจจุบัน</span>
          <span className="info-val">{r.bikes?.odometer?.toLocaleString()} กม.</span>
        </div>
      )}
      <div className="info-row">
        <span className="info-key">กำหนด</span>
        <span className="info-val" style={{ color }}>
          {r.follows_engine
            ? `ตามรอบน้ำมันเครื่อง (ทุกรอบที่ ${CYCLE_LENGTH}) — เตือนเองถ้าเกิน ${r.interval_days ?? 365} วัน`
            : isKmBased
              ? `ทุก ${r.interval_km?.toLocaleString()} กม.`
              : `ทุก ${r.interval_days} วัน`}
        </span>
      </div>
      {cycle && (
        <div className="info-row">
          <span className="info-key">รอบเฟืองท้าย</span>
          <span className="info-val" style={{ fontWeight: 700, color: gearOffered ? '#dc2626' : '#374151' }}>
            {gearOffered && cycle.count + 1 > CYCLE_LENGTH
              ? `ค้างเปลี่ยนเฟืองท้าย (น้ำมันเครื่องเปลี่ยนมาแล้ว ${cycle.count} ครั้งตั้งแต่เฟืองท้ายล่าสุด)`
              : `ครั้งนี้เป็นรอบที่ ${nextEnginePosition(cycle.count)}/${CYCLE_LENGTH}${gearOffered ? ' — เปลี่ยนเฟืองท้ายด้วย' : ''}`}
            {cycle.gearLastDate ? ` • เฟืองท้ายล่าสุด ${new Date(cycle.gearLastDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
          </span>
        </div>
      )}
      {r.interval_rented_days != null && (
        <div className="info-row">
          <span className="info-key">หรือเช่าสะสม</span>
          <span className="info-val">{r.rented_days_accumulated ?? 0} / {r.interval_rented_days} วัน</span>
        </div>
      )}
      <div className="info-row">
        <span className="info-key">สถานะ</span>
        <span className="info-val" style={{ color, fontWeight: 700 }}>{r.due_reason}</span>
      </div>
      {r.last_done_date && (
        <div className="info-row">
          <span className="info-key">ทำล่าสุด</span>
          <span className="info-val">
            {new Date(r.last_done_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
            {r.last_done_km ? ` • ${r.last_done_km.toLocaleString()} กม.` : ''}
            {r.last_cost ? ` • ฿${Number(r.last_cost).toLocaleString()}` : ''}
          </span>
        </div>
      )}

      {isActionable && !saved && (
        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px dashed #e5e7eb' }}>
          {isKmBased && (
            <div className="field-row">
              <label className="field-label">เลขไมล์ที่ทำ</label>
              <input className="field-input" type="number" placeholder={String(r.bikes?.odometer ?? '')}
                value={doneKm} onChange={e => setDoneKm(e.target.value)} />
            </div>
          )}
          {oilType && (
            <div className="field-row">
              <label className="field-label">ใช้น้ำมันร้านไหม *</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" disabled={shopOilOut} onClick={() => setUsedShopOil(true)} style={{
                  flex: 1, padding: '10px', borderRadius: '10px',
                  border: `2px solid ${usedShopOil === true ? '#b45309' : '#e5e7eb'}`,
                  background: usedShopOil === true ? '#fffbeb' : '#fff',
                  color: usedShopOil === true ? '#b45309' : '#6b7280',
                  fontWeight: 700, fontSize: '14px', cursor: shopOilOut ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  opacity: shopOilOut ? 0.4 : 1,
                }}>🛢️ ใช้น้ำมันร้าน</button>
                <button type="button" onClick={() => setUsedShopOil(false)} style={{
                  flex: 1, padding: '10px', borderRadius: '10px',
                  border: `2px solid ${usedShopOil === false ? '#374151' : '#e5e7eb'}`,
                  background: usedShopOil === false ? '#f1f5f9' : '#fff',
                  color: usedShopOil === false ? '#111827' : '#6b7280',
                  fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
                }}>ไม่ใช่</button>
              </div>
              {shopOilOut && (
                <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '6px' }}>
                  น้ำมันร้านของสาขานี้หมด (สต๊อก 0) — เลือก &quot;ไม่ใช่&quot; หรือแจ้งเจ้าของให้เติมสต๊อกก่อน
                </div>
              )}
              {usedShopOil === true && (
                <div style={{ fontSize: '12px', color: '#b45309', marginTop: '6px' }}>
                  จะหักสต๊อกสาขา 1 ขวดอัตโนมัติ — ค่าใช้จ่ายด้านล่างกรอกแค่ค่าแรง/ค่าเปลี่ยน ไม่ต้องรวมค่าน้ำมัน
                </div>
              )}
            </div>
          )}
          {cycle && !showGearBox && (
            <button type="button" onClick={() => { setGearExpanded(true); setAlsoGear(true) }} style={{
              width: '100%', textAlign: 'left', background: '#f3f4f6', border: 'none', borderRadius: '10px',
              padding: '10px 12px', marginBottom: '14px', fontSize: '12px', color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              ⚙️ ยังไม่ถึงรอบเฟืองท้าย (รอบนี้ {nextEnginePosition(cycle.count)}/{CYCLE_LENGTH}) — ถ้าเปลี่ยนพร้อมนี้ด้วย แตะที่นี่
            </button>
          )}
          {showGearBox && (
            <div className="field-row" style={{
              background: gearBacklog ? '#fef2f2' : gearOffered ? '#eff6ff' : '#f3f4f6',
              border: `1px solid ${gearBacklog ? '#fecaca' : gearOffered ? '#bfdbfe' : '#e5e7eb'}`,
              borderRadius: '12px', padding: '12px',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px', color: gearBacklog ? '#dc2626' : gearOffered ? '#1d4ed8' : '#374151' }}>
                <input type="checkbox" checked={alsoGear} onChange={e => setAlsoGear(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                {gearBacklog
                  ? '🚨 ⚙️ ค้างเปลี่ยนเฟืองท้าย — เปลี่ยนพร้อมกันด้วย'
                  : gearOffered
                    ? '✅ ⚙️ ถึงรอบเปลี่ยนเฟืองท้ายแล้ว — เปลี่ยนพร้อมกันด้วย'
                    : '⚙️ เปลี่ยนเฟืองท้ายพร้อมกันด้วย (นอกรอบ)'}
              </label>
              {!alsoGear && gearOffered && (
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                  ครั้งนี้ไม่ได้ทำเฟืองท้าย — ระบบจะค้างไว้ถามอีกในรอบหน้า
                </div>
              )}
              {alsoGear && (
                <div style={{ marginTop: '10px' }}>
                  <div className="field-label" style={{ marginBottom: '6px' }}>ใช้น้ำมันเฟืองท้ายร้านไหม *</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" disabled={gearShopOut} onClick={() => setGearUsedShopOil(true)} style={{
                      flex: 1, padding: '10px', borderRadius: '10px',
                      border: `2px solid ${gearUsedShopOil === true ? '#1d4ed8' : '#e5e7eb'}`,
                      background: gearUsedShopOil === true ? '#dbeafe' : '#fff',
                      color: gearUsedShopOil === true ? '#1d4ed8' : '#6b7280',
                      fontWeight: 700, fontSize: '14px', cursor: gearShopOut ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                      opacity: gearShopOut ? 0.4 : 1,
                    }}>⚙️ ใช้น้ำมันร้าน</button>
                    <button type="button" onClick={() => setGearUsedShopOil(false)} style={{
                      flex: 1, padding: '10px', borderRadius: '10px',
                      border: `2px solid ${gearUsedShopOil === false ? '#374151' : '#e5e7eb'}`,
                      background: gearUsedShopOil === false ? '#f1f5f9' : '#fff',
                      color: gearUsedShopOil === false ? '#111827' : '#6b7280',
                      fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
                    }}>ไม่ใช่</button>
                  </div>
                  {gearShopOut && (
                    <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '6px' }}>
                      น้ำมันเฟืองท้ายร้านของสาขานี้หมด (สต๊อก 0) — เลือก &quot;ไม่ใช่&quot; หรือแจ้งเจ้าของให้เติมสต๊อกก่อน
                    </div>
                  )}
                  {gearUsedShopOil === true && (
                    <div style={{ fontSize: '12px', color: '#1d4ed8', marginTop: '6px' }}>
                      จะหักสต๊อกเฟืองท้ายสาขา 1 ขวดอัตโนมัติ — ค่าใช้จ่ายด้านล่างกรอกค่าแรงรวมทั้งสองงาน ไม่ต้องรวมค่าน้ำมัน
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="field-row">
            <label className="field-label">ร้านซ่อม / ผู้ดำเนินการ</label>
            <input className="field-input" type="text" placeholder="เช่น ช่างหมู"
              value={shop} onChange={e => setShop(e.target.value)} />
          </div>
          <div className="field-row">
            <label className="field-label">ค่าใช้จ่าย (บาท)</label>
            <input className="field-input" type="number" placeholder="250"
              value={cost} onChange={e => setCost(e.target.value)} />
          </div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">อัพโหลดบิล (ถ้ามี)</label>
            <PhotoUpload
              icon="🧾"
              hint="อัพโหลดใบเสร็จ"
              folder={`routine/${r.bike_id}`}
              onUpload={url => setReceiptUrl(url)}
              onRemove={() => setReceiptUrl('')}
            />
          </div>
          {error && <div style={{ color: '#dc2626', fontSize: '13px', marginTop: '8px' }}>⚠️ {error}</div>}
          <button className="btn btn-success"
            style={{ marginTop: '14px', width: '100%', opacity: loading ? 0.7 : 1 }}
            onClick={handleSave} disabled={loading}>
            {loading ? '⏳ กำลังบันทึก...' : '✅ บันทึกว่าเสร็จแล้ว'}
          </button>
        </div>
      )}
      {saved && (
        <div style={{ marginTop: '10px', color: '#16a34a', fontSize: '13px', fontWeight: 600 }}>
          ✅ บันทึกเรียบร้อยแล้ว
        </div>
      )}
    </div>
  )
}

export default function RoutineClient({ routines, backHref = '/staff/home' }: { routines: RoutineItem[]; backHref?: string }) {
  const overdue = routines.filter(r => r.urgency === 'overdue')
  const warning = routines.filter(r => r.urgency === 'warning')
  const ok = routines.filter(r => r.urgency === 'ok')

  const bike = routines[0]?.bikes

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: '#92400e' }}>
        <Link href={backHref} className="app-header-back">←</Link>
        <div>
          <h1>งานซ่อมบำรุงรูทีน</h1>
          <div className="sub">{bike ? `${bike.license_plate} ${bike.brand} ${bike.model}` : 'การบำรุงรักษาประจำ'}</div>
        </div>
      </div>

      <div className="section-pad" style={{ paddingTop: '12px' }}>
        {routines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '14px' }}>
            ยังไม่มีข้อมูลงานบำรุงรักษา<br />
            <span style={{ fontSize: '12px' }}>เพิ่มได้จากหน้ารายละเอียดรถ</span>
          </div>
        ) : (
          <>
            {overdue.length > 0 && (
              <div style={{
                background: '#fef2f2', borderRadius: '10px', padding: '12px 14px',
                margin: '12px 0 4px', fontSize: '13px', color: '#dc2626', border: '1px solid #fecaca',
              }}>
                🚨 มีงานบำรุงรักษาที่ถึงกำหนดแล้ว {overdue.length} รายการ
              </div>
            )}
            {overdue.map(r => <RoutineCard key={r.id} r={r} />)}

            {warning.length > 0 && (
              <div style={{
                background: '#fffbeb', borderRadius: '10px', padding: '12px 14px',
                margin: '4px 0', fontSize: '13px', color: '#d97706', border: '1px solid #fcd34d',
              }}>
                🛢️ มีงานบำรุงรักษาที่ใกล้ถึงกำหนด {warning.length} รายการ
              </div>
            )}
            {warning.map(r => <RoutineCard key={r.id} r={r} />)}

            {ok.length > 0 && (
              <>
                <div className="card-title" style={{ padding: '8px 0', fontSize: '12px', color: '#6b7280' }}>
                  เสร็จแล้ว / ปกติ
                </div>
                {ok.map(r => <RoutineCard key={r.id} r={r} />)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
