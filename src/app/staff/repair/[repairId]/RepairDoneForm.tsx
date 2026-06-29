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

type Props = { repair: Repair; staffId: string }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function RepairDoneForm({ repair }: Props) {
  const router = useRouter()
  const bike = repair.bikes

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/staff/repair/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repairId: repair.id, bikeId: bike.id }),
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

        <div style={{
          background: '#f0fdf4', borderRadius: '10px', padding: '14px',
          margin: '0 0 12px', fontSize: '13px', color: '#16a34a',
        }}>
          ✅ เมื่อกดยืนยัน รถจะกลับสู่สถานะ <strong>"ว่าง"</strong> และ Job Task จะปิด
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
