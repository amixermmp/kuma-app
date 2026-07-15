'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Repair = {
  id: string
  title: string
  description: string
  status: string
  created_at: string
  bikes: { id: string; license_plate: string; brand: string; model: string }
}

type Props = { repair: Repair; staffId: string; isFromSwap?: boolean }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function RepairDoneForm({ repair, isFromSwap = false }: Props) {
  const router = useRouter()
  const bike = repair.bikes

  const [repairNotes, setRepairNotes] = useState('')
  const [repairShop, setRepairShop] = useState('')
  const [repairCost, setRepairCost] = useState('')
  const [lockForSwap, setLockForSwap] = useState(isFromSwap)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/staff/repair/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repairId: repair.id,
          bikeId: bike.id,
          repairNotes: repairNotes.trim() || null,
          repairShop: repairShop.trim() || null,
          repairCost: repairCost ? parseFloat(repairCost) : null,
          lockForSwap,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      router.push('/staff/jobs')
    } catch {
      setError('เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: '#7c3aed' }}>
        <Link href="/staff/jobs" className="app-header-back">←</Link>
        <div>
          <h1>ซ่อมเสร็จ</h1>
          <div className="sub">{bike.license_plate} {bike.brand} {bike.model}</div>
        </div>
      </div>

      <div className="section-pad">
        {/* Repair info */}
        <div className="card" style={{ borderTop: '3px solid #d97706' }}>
          <div className="card-title" style={{ color: '#d97706' }}>
            🔧 ส่งซ่อม — {bike.license_plate}
          </div>
          <div className="info-row">
            <span className="info-key">อาการ</span>
            <span className="info-val">{repair.description}</span>
          </div>
          <div className="info-row">
            <span className="info-key">วันที่แจ้ง</span>
            <span className="info-val">{fmtDate(repair.created_at)}</span>
          </div>
          <div className="info-row">
            <span className="info-key">สถานะ</span>
            <span className="info-val">
              <span className="badge badge-red">กำลังซ่อม</span>
            </span>
          </div>
        </div>

        <div className="card">
          <div className="card-title">บันทึกผลการซ่อม</div>
          <div className="field-row">
            <label className="field-label">รายละเอียดงานซ่อม *</label>
            <textarea className="field-input" rows={3}
              placeholder="เช่น เปลี่ยนยาง เปลี่ยนน้ำมันเครื่อง ซ่อมไฟหน้า..."
              value={repairNotes}
              onChange={e => setRepairNotes(e.target.value)}
            />
          </div>
          <div className="field-row">
            <label className="field-label">ร้านซ่อม</label>
            <input className="field-input" type="text"
              placeholder="ร้านซ่อมมอเตอร์ไซค์เจริญ"
              value={repairShop}
              onChange={e => setRepairShop(e.target.value)}
            />
          </div>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <label className="field-label">ค่าซ่อม (บาท)</label>
            <input className="field-input" type="number" placeholder="850"
              value={repairCost}
              onChange={e => setRepairCost(e.target.value)}
            />
          </div>
        </div>

        {/* Toggle: ล็อครอสลับกลับ */}
        <div
          onClick={() => setLockForSwap(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            background: lockForSwap ? '#fef9c3' : '#f0fdf4',
            border: `2px solid ${lockForSwap ? '#ca8a04' : '#bbf7d0'}`,
            borderRadius: '12px', padding: '14px 16px',
            margin: '0 0 10px', cursor: 'pointer',
          }}
        >
          <div style={{
            width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
            border: `2px solid ${lockForSwap ? '#ca8a04' : '#16a34a'}`,
            background: lockForSwap ? '#ca8a04' : '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {lockForSwap && <span style={{ color: '#fff', fontSize: '13px', fontWeight: 900 }}>✓</span>}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: lockForSwap ? '#92400e' : '#16a34a' }}>
              {lockForSwap ? '🔒 ล็อครอสลับกลับ' : '✅ คืนสถานะว่าง'}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
              {lockForSwap
                ? 'รถจะอยู่ในสถานะ "ล็อค" รอ staff สลับกลับให้ลูกค้าคนเดิม'
                : 'รถจะกลับสู่สถานะ "ว่าง" พร้อมให้เช่าได้ทันที'}
            </div>
          </div>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '10px', padding: '12px', color: '#dc2626',
            fontSize: '14px', marginBottom: '12px',
          }}>⚠️ {error}</div>
        )}

        <button className="btn btn-success" onClick={handleSubmit} disabled={loading}
          style={{ width: '100%', opacity: loading ? 0.7 : 1 }}>
          {loading ? '⏳ กำลังบันทึก...' : '✅ ยืนยันซ่อมเสร็จ'}
        </button>
      </div>
    </div>
  )
}
