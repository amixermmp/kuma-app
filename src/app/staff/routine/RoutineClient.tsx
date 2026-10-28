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
  const skippedTimes = cycle ? Math.max(0, cycle.count - (CYCLE_LENGTH - 1)) : 0
  // ถึงรอบ/ค้าง → ต้องเลือก "เปลี่ยนด้วย" หรือ "ยังไม่ได้ทำ" ไม่มีค่าเริ่มต้น (กันพนักงานกดผ่านไวๆ จนบันทึกว่าเปลี่ยนเฟืองท้ายทั้งที่ไม่ได้ทำ)
  // ยังไม่ถึงรอบ → ซ่อนเป็นบรรทัดเทา แตะแล้วขยายเป็นตัวเลือก "ทำก่อนรอบ" ไม่บังคับ
  const [gearChoice, setGearChoice] = useState<'do' | 'skip' | null>(null)
  const [gearExpanded, setGearExpanded] = useState(false)
  const [gearUsedShopOil, setGearUsedShopOil] = useState<boolean | null>(null)
  const gearShopOut = cycle != null && cycle.gearShopQty <= 0
  const showGearBox = cycle != null && (gearOffered || gearExpanded)
  const doingGear = showGearBox && gearChoice === 'do'

  // ข้อที่ยังไม่ได้ตอบ (เฉพาะรถที่ใช้โหมดตามรอบ — ปุ่มบันทึกกดไม่ได้จนกว่าจะตอบครบ)
  const missing: string[] = []
  if (cycle) {
    if (oilType && usedShopOil === null) missing.push('น้ำมันเครื่อง: ใช้น้ำมันร้านไหม')
    if (gearOffered && gearChoice === null) missing.push('เฟืองท้าย: เปลี่ยนด้วยหรือยังไม่ได้ทำ')
    if (doingGear && gearUsedShopOil === null) missing.push('เฟืองท้าย: ใช้น้ำมันร้านไหม')
  }
  const blocked = missing.length > 0
  const stockCount = (usedShopOil === true ? 1 : 0) + (doingGear && gearUsedShopOil === true ? 1 : 0)
  const saveSummary = gearOffered && gearChoice === null
    ? 'ยังไม่ได้เลือกว่าครั้งนี้เปลี่ยนเฟืองท้ายด้วยหรือไม่'
    : `${doingGear ? 'เปลี่ยนน้ำมันเครื่อง + เฟืองท้าย' : 'เปลี่ยนน้ำมันเครื่องอย่างเดียว'}${gearOffered && !doingGear ? ' (เฟืองท้ายค้างไว้ถามรอบหน้า)' : ''} — ${stockCount > 0 ? `หักสต๊อก ${stockCount} ขวด` : 'ไม่หักสต๊อก'}`

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
          {/* โหมดตามรอบ: แยกส่วน 🛢️ น้ำมันเครื่อง กับ ⚙️ เฟืองท้ายเป็นกรอบสีคนละสี (รถอื่นไม่มีกรอบ หน้าตาเหมือนเดิม) */}
          <div style={cycle ? { border: '2px solid #fdba74', background: '#fffaf0', borderRadius: '12px', padding: '12px', marginBottom: '12px' } : undefined}>
          {cycle && <div style={{ fontWeight: 800, color: '#c2410c', fontSize: '14px', marginBottom: '10px' }}>🛢️ น้ำมันเครื่อง</div>}
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
          </div>
          {cycle && !showGearBox && (
            <button type="button" onClick={() => setGearExpanded(true)} style={{
              width: '100%', textAlign: 'left', background: '#f3f4f6', border: 'none', borderRadius: '10px',
              padding: '10px 12px', marginBottom: '14px', fontSize: '12px', color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              ⚙️ ยังไม่ถึงรอบเฟืองท้าย (รอบนี้ {nextEnginePosition(cycle.count)}/{CYCLE_LENGTH}) — ถ้าจะทำก่อนรอบ แตะที่นี่ (ไม่บังคับ)
            </button>
          )}
          {showGearBox && (
            <div style={{
              border: `2px solid ${gearBacklog ? '#fca5a5' : gearOffered ? '#93c5fd' : '#d1d5db'}`,
              background: gearBacklog ? '#fef2f2' : gearOffered ? '#eff6ff' : '#f9fafb',
              borderRadius: '12px', padding: '12px', marginBottom: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontWeight: 800, fontSize: '14px', color: gearBacklog ? '#dc2626' : gearOffered ? '#1d4ed8' : '#4b5563' }}>⚙️ น้ำมันเฟืองท้าย</span>
                <span style={{
                  fontSize: '11px', fontWeight: 700, borderRadius: '999px', padding: '2px 8px',
                  background: gearBacklog ? '#dc2626' : gearOffered ? '#1d4ed8' : '#9ca3af', color: '#fff',
                }}>{gearBacklog ? `🚨 ค้าง — ข้ามมา ${skippedTimes} ครั้ง` : gearOffered ? 'ถึงรอบ — ต้องตอบ' : 'ไม่บังคับ'}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#4b5563', marginBottom: '10px' }}>
                {gearBacklog
                  ? `ข้ามเฟืองท้ายมาแล้ว ${skippedTimes} ครั้ง ควรเปลี่ยนเลยครั้งนี้`
                  : gearOffered
                    ? `ถึงรอบเปลี่ยนเฟืองท้ายแล้ว (รอบ ${CYCLE_LENGTH}/${CYCLE_LENGTH})`
                    : 'เปลี่ยนเฟืองท้ายก่อนถึงรอบ — ถ้าเปลี่ยนจริง ระบบจะนับรอบใหม่ทันที'}
              </div>
              <div className="field-label" style={{ marginBottom: '6px' }}>
                {gearOffered ? 'ครั้งนี้ได้เปลี่ยนเฟืองท้ายด้วยไหม *' : 'เปลี่ยนเฟืองท้ายพร้อมนี้ด้วย'}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setGearChoice('do')} style={{
                  flex: 1, padding: '10px', borderRadius: '10px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
                  border: `2px solid ${gearChoice === 'do' ? '#16a34a' : '#e5e7eb'}`,
                  background: gearChoice === 'do' ? '#dcfce7' : '#fff', color: gearChoice === 'do' ? '#166534' : '#6b7280',
                }}>✅ เปลี่ยนด้วย</button>
                {gearOffered ? (
                  <button type="button" onClick={() => setGearChoice('skip')} style={{
                    flex: 1, padding: '10px', borderRadius: '10px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
                    border: `2px solid ${gearChoice === 'skip' ? '#374151' : '#e5e7eb'}`,
                    background: gearChoice === 'skip' ? '#f1f5f9' : '#fff', color: gearChoice === 'skip' ? '#111827' : '#6b7280',
                  }}>❌ ยังไม่ได้ทำ</button>
                ) : (
                  <button type="button" onClick={() => { setGearChoice(null); setGearExpanded(false) }} style={{
                    flex: 1, padding: '10px', borderRadius: '10px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
                    border: '2px solid #e5e7eb', background: '#fff', color: '#6b7280',
                  }}>ยกเลิก</button>
                )}
              </div>
              {gearChoice === 'skip' && (
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                  ครั้งนี้ไม่ได้ทำเฟืองท้าย — ระบบจะค้างไว้ถามอีกในรอบหน้า
                </div>
              )}
              {doingGear && (
                <div style={{ marginTop: '12px' }}>
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
          {cycle && (
            <div style={{ marginTop: '14px', fontSize: '13px', background: '#f1f5f9', borderRadius: '10px', padding: '10px 12px', color: '#111827' }}>
              📝 จะบันทึก: {saveSummary}
            </div>
          )}
          {blocked && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>
              ยังขาด: {missing.join(' • ')}
            </div>
          )}
          <button className="btn btn-success"
            style={{ marginTop: '14px', width: '100%', opacity: loading || blocked ? 0.5 : 1 }}
            onClick={handleSave} disabled={loading || blocked}>
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
