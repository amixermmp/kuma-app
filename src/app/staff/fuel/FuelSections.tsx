'use client'

import { useState } from 'react'

type FuelBike = { id: string; license_plate: string; brand: string; model: string; fuel_level: number | null }

export default function FuelSections({ bikes }: { bikes: FuelBike[] }) {
  const [levels, setLevels] = useState<Record<string, number | null>>(
    Object.fromEntries(bikes.map(b => [b.id, b.fuel_level]))
  )
  const [refueling, setRefueling] = useState<Record<string, boolean>>({})

  const isFull = (id: string) => (levels[id] ?? 8) >= 8
  const needsFuel = bikes.filter(b => !isFull(b.id))

  const markRefueled = async (id: string) => {
    setRefueling(p => ({ ...p, [id]: true }))
    try {
      await fetch(`/api/staff/bikes/${id}/refuel`, { method: 'POST' })
      setLevels(p => ({ ...p, [id]: 8 }))
    } finally {
      setRefueling(p => ({ ...p, [id]: false }))
    }
  }

  if (bikes.length === 0) {
    return (
      <div className="section-pad" style={{ paddingTop: '12px' }}>
        <div style={{ textAlign: 'center', padding: '40px 16px', color: '#9ca3af' }}>
          ไม่มีรถว่างอยู่ในร้านตอนนี้
        </div>
      </div>
    )
  }

  return (
    <div className="section-pad" style={{ paddingTop: '12px' }}>
      {needsFuel.length > 0 && (
        <div className="card" style={{ marginBottom: '10px', borderTop: '3px solid #dc2626' }}>
          <div className="card-title">รถต้องเติมน้ำมัน ({needsFuel.length} คัน)</div>
          {needsFuel.map(b => (
            <div key={b.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: '1px solid #f3f4f6',
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>{b.license_plate}</div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>{b.brand} {b.model}</div>
              </div>
              <button
                onClick={() => markRefueled(b.id)}
                disabled={refueling[b.id]}
                style={{
                  background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px',
                  padding: '8px 14px', fontSize: '12px', fontWeight: 700,
                  cursor: refueling[b.id] ? 'not-allowed' : 'pointer', opacity: refueling[b.id] ? 0.6 : 1,
                }}
              >
                {refueling[b.id] ? '...' : 'เติมน้ำมันแล้ว'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-title">ภาพรวมน้ำมันรถว่าง</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {bikes.map(b => (
            <div key={b.id} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: isFull(b.id) ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${isFull(b.id) ? '#bbf7d0' : '#fecaca'}`,
              borderRadius: '20px', padding: '4px 10px', fontSize: '12px', color: '#374151',
            }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: isFull(b.id) ? '#16a34a' : '#dc2626', flexShrink: 0,
              }} />
              {b.license_plate}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
