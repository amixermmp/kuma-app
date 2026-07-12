'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PhotoUpload from '@/components/PhotoUpload'
import type { RoutineItem } from './page'

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const color = urgencyColor(r.urgency)
  const isKmBased = r.interval_km != null
  const isActionable = true // ทำรายการได้ตลอด ไม่ต้องรอใกล้ครบกำหนด

  const handleSave = async () => {
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
        <span className="info-val">{r.task_name}</span>
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
          {isKmBased
            ? `ทุก ${r.interval_km?.toLocaleString()} กม.`
            : `ทุก ${r.interval_days} วัน`}
        </span>
      </div>
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
