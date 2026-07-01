'use client'

import { useState } from 'react'
import Link from 'next/link'

type Bike = {
  id: string
  license_plate: string
  brand: string
  model: string
  status: string
}

const STATUS_LABEL: Record<string, string> = {
  available: 'ว่าง',
  rented: 'ถูกเช่า',
  repair: 'ซ่อมอยู่',
}
const STATUS_COLOR: Record<string, string> = {
  available: '#16a34a',
  rented: '#374151',
  repair: '#dc2626',
}

export default function BikeSelectClient({
  bikes,
  hrefTemplate,
}: {
  bikes: Bike[]
  // ใส่ {id} แล้วจะถูกแทนด้วย bike.id เช่น "/staff/routine?bikeId={id}"
  hrefTemplate: string
}) {
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()
  const filtered = term
    ? bikes.filter(b =>
        `${b.license_plate} ${b.brand} ${b.model}`.toLowerCase().includes(term)
      )
    : bikes

  return (
    <>
      {/* Search bar */}
      <div style={{
        padding: '10px 12px', background: '#fff',
        borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <input
          type="search"
          placeholder="🔍 ค้นหาทะเบียน / ยี่ห้อ / รุ่น"
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{
            width: '100%', padding: '10px 12px',
            border: '1.5px solid #e5e7eb', borderRadius: '10px',
            fontSize: '14px', fontFamily: 'inherit',
            boxSizing: 'border-box', outline: 'none',
            background: '#f9fafb',
          }}
        />
      </div>

      {/* Bike list */}
      <div style={{ padding: '12px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: '#9ca3af', fontSize: '14px' }}>
            ไม่พบรถที่ค้นหา
          </div>
        ) : filtered.map(bike => (
          <Link
            key={bike.id}
            href={hrefTemplate.replace('{id}', bike.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              background: '#fff', borderRadius: '12px', padding: '14px',
              marginBottom: '10px', textDecoration: 'none', color: 'inherit',
              border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,.06)',
            }}
          >
            <span style={{ fontSize: '26px' }}>🛵</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>
                {bike.license_plate}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                {bike.brand} {bike.model}
              </div>
            </div>
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
              background: `${STATUS_COLOR[bike.status] ?? '#374151'}20`,
              color: STATUS_COLOR[bike.status] ?? '#374151',
            }}>
              {STATUS_LABEL[bike.status] ?? bike.status}
            </span>
            <span style={{ color: '#9ca3af', fontSize: '20px' }}>›</span>
          </Link>
        ))}
      </div>
    </>
  )
}
