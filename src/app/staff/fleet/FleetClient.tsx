'use client'

import { useState } from 'react'
import Link from 'next/link'

type Bike = {
  id: string
  license_plate: string
  brand: string
  model: string
  color: string | null
  year: number | null
  status: string
  daily_rate: number
  photo_url: string | null
}

const STATUS_LABEL: Record<string, string> = {
  available: 'ว่าง',
  rented:    'เช่าอยู่',
  repair:    'ซ่อม',
  retired:   'เลิกใช้',
}
const STATUS_COLOR: Record<string, string> = {
  available: '#16a34a',
  rented:    '#374151',
  repair:    '#dc2626',
  retired:   '#9ca3af',
}

export default function FleetClient({ bikes }: { bikes: Bike[] }) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? bikes.filter(b => b.license_plate.toLowerCase().includes(query.trim().toLowerCase()))
    : bikes

  return (
    <>
      {/* Search box */}
      <div style={{ padding: '14px 12px 0', marginTop: '-14px' }}>
        <input
          type="text"
          placeholder="🔍 ค้นหาเลขทะเบียน..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '12px 14px', borderRadius: '12px',
            border: '1.5px solid #fff', fontSize: '15px',
            outline: 'none', background: '#fff',
            boxShadow: '0 4px 14px rgba(225,29,72,.15)',
          }}
          onFocus={e => { e.target.style.border = '1.5px solid var(--red)' }}
          onBlur={e => { e.target.style.border = '1.5px solid #fff' }}
        />
      </div>

      <div style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '80px' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af', fontSize: '14px' }}>
            {query ? `ไม่พบรถทะเบียน "${query}"` : 'ไม่มีรถในสาขานี้'}
          </div>
        )}
        {filtered.map(bike => {
          const color = STATUS_COLOR[bike.status] ?? '#6b7280'
          const label = STATUS_LABEL[bike.status] ?? bike.status
          return (
            <Link key={bike.id} href={`/bike/${bike.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: '#fff', borderRadius: '14px', padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: '14px',
                boxShadow: '0 1px 4px rgba(0,0,0,.07)',
                border: '1px solid #f3f4f6', borderLeftWidth: '4px', borderLeftColor: color,
              }}>
                {bike.photo_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={bike.photo_url} alt="" style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0 }} />
                  : <div style={{
                      width: '52px', height: '52px', borderRadius: '10px', flexShrink: 0,
                      background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px',
                    }}>🛵</div>
                }

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '15px', color: '#111827' }}>
                    {bike.license_plate}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
                    {bike.brand} {bike.model}
                    {bike.color ? ` • ${bike.color}` : ''}
                    {bike.year ? ` • ปี ${bike.year + 543}` : ''}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    display: 'inline-block', fontSize: '11px', fontWeight: 700,
                    padding: '3px 10px', borderRadius: '20px',
                    background: `${color}15`, color,
                    marginBottom: '4px',
                  }}>
                    {label}
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>฿{bike.daily_rate}/วัน</div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
