'use client'

import { useState } from 'react'
import Link from 'next/link'

type BikeResult = {
  id: string
  license_plate: string
  brand: string
  model: string
  color: string | null
  year: number | null
  daily_rate: number
  odometer: number
  status: string
  available: boolean
  conflict_type?: string | null
  conflict_reason?: string
}

function nowLocal(offsetMs = 0) {
  const d = new Date(Date.now() + offsetMs)
  d.setSeconds(0, 0)
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function daysBetween(from: string, to: string) {
  return Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000))
}

export default function SearchPage() {
  const [from, setFrom] = useState(nowLocal())
  const [to, setTo] = useState(nowLocal(3 * 24 * 60 * 60 * 1000))
  const [priceFilter, setPriceFilter] = useState('ทุกราคา')
  const [modelFilter, setModelFilter] = useState('ทุกรุ่น')
  const [results, setResults] = useState<BikeResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = async () => {
    if (!from || !to || new Date(to) <= new Date(from)) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/staff/search/bikes?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      )
      const data = await res.json()
      setResults(data.bikes ?? [])
      setModelFilter('ทุกรุ่น')
      setSearched(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const days = from && to ? daysBetween(from, to) : 0

  const uniqueModels = results
    ? Array.from(new Set(results.map(b => `${b.brand} ${b.model}`)))
    : []

  const filteredResults = results?.filter(b => {
    if (priceFilter === '≤ 200' && b.daily_rate > 200) return false
    if (priceFilter === '201–350' && (b.daily_rate < 201 || b.daily_rate > 350)) return false
    if (priceFilter === '> 350' && b.daily_rate <= 350) return false
    if (modelFilter !== 'ทุกรุ่น' && `${b.brand} ${b.model}` !== modelFilter) return false
    return true
  })

  const available = filteredResults?.filter(b => b.available) ?? []
  const unavailable = filteredResults?.filter(b => !b.available) ?? []

  return (
    <div className="app-wrap">

      {/* Header */}
      <div className="app-header" style={{ background: '#0891b2' }}>
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div>
          <h1>ค้นหารถว่าง</h1>
          <div className="sub">เลือกวันเวลาที่ต้องการเช่า</div>
        </div>
      </div>

      {/* Search form */}
      <div className="card" style={{ margin: '12px' }}>
        <div className="card-title">ช่วงเวลาที่ต้องการ</div>
        <div className="field-row">
          <label className="field-label">📅 วันเริ่มเช่า</label>
          <input className="field-input" type="datetime-local"
            value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="field-row" style={{ marginBottom: 0 }}>
          <label className="field-label">📅 วันที่คืนรถ</label>
          <input className="field-input" type="datetime-local"
            value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding: '0 12px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
          <div style={{ flex: 1 }}>
            <label className="field-label">ราคา (บาท/วัน)</label>
            <select className="field-input"
              value={priceFilter}
              onChange={e => setPriceFilter(e.target.value)}>
              <option>ทุกราคา</option>
              <option>≤ 200</option>
              <option>201–350</option>
              <option>{'> 350'}</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="field-label">รุ่นรถ</label>
            <select className="field-input"
              value={modelFilter}
              onChange={e => setModelFilter(e.target.value)}>
              <option>ทุกรุ่น</option>
              {uniqueModels.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Search button */}
      <div style={{ padding: '10px 12px 12px' }}>
        <button
          className="btn"
          style={{ background: '#0891b2', color: '#fff', width: '100%', opacity: loading ? 0.7 : 1 }}
          onClick={handleSearch}
          disabled={loading || !from || !to}
        >
          {loading ? '⏳ กำลังค้นหา...' : '🔍 ค้นหารถว่าง'}
        </button>
      </div>

      {/* Results */}
      {searched && filteredResults && (
        <>
          <div className="divider" />
          <div style={{ padding: '12px 12px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#4b5563' }}>
              ผลการค้นหา — <span style={{ color: '#0891b2' }}>{days} วัน</span>
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>ว่าง {available.length} คัน</div>
          </div>

          <div style={{ padding: '0 12px 80px' }}>

            {/* Available bikes */}
            {available.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '24px', background: '#f9fafb',
                borderRadius: '12px', color: '#9ca3af', fontSize: '14px', marginBottom: '12px',
              }}>
                😔 ไม่มีรถว่างในช่วงเวลานี้
              </div>
            )}
            {available.map(bike => (
              <div key={bike.id} className="bike-result-card">
                <div className="bike-result-img">🛵</div>
                <div className="bike-result-info">
                  <div className="bike-result-top">
                    <div>
                      <div className="bike-result-name">{bike.brand} {bike.model}</div>
                      <div className="bike-result-plate">ทะเบียน {bike.license_plate}</div>
                    </div>
                    <span className="badge badge-green">ว่าง</span>
                  </div>
                  <div className="bike-result-meta">
                    {(bike.color || bike.year) && (
                      <span>🎨 {[bike.color, bike.year ? `ปี ${bike.year}` : null].filter(Boolean).join(' • ')}</span>
                    )}
                    <span>📍 {bike.odometer.toLocaleString()} กม.</span>
                  </div>
                  <div className="bike-result-footer">
                    <div className="bike-result-price">
                      ฿{bike.daily_rate.toLocaleString()}
                      <span style={{ fontSize: '12px', fontWeight: 400, color: '#6b7280' }}>/วัน</span>
                    </div>
                    <div className="bike-result-total">
                      รวม {days} วัน = <strong style={{ color: '#0891b2' }}>฿{(bike.daily_rate * days).toLocaleString()}</strong>
                    </div>
                    <Link
                      href={`/staff/booking/${bike.id}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}
                      style={{ background: '#0891b2', textDecoration: 'none', padding: '5px 12px', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: 700 }}
                    >
                      จอง →
                    </Link>
                  </div>
                </div>
              </div>
            ))}

            {/* Unavailable bikes */}
            {unavailable.length > 0 && (
              <>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', padding: '8px 2px 6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  ไม่ว่างในช่วงเวลานี้
                </div>
                {unavailable.map(bike => (
                  <div key={bike.id} className="bike-result-card" style={{ opacity: 0.55, pointerEvents: 'none' }}>
                    <div className="bike-result-img" style={{ filter: 'grayscale(1)' }}>🛵</div>
                    <div className="bike-result-info">
                      <div className="bike-result-top">
                        <div>
                          <div className="bike-result-name">{bike.brand} {bike.model}</div>
                          <div className="bike-result-plate">ทะเบียน {bike.license_plate}</div>
                        </div>
                        <span className="badge" style={{
                          background: bike.conflict_type === 'booked' ? '#faf5ff' : '#fef2f2',
                          color: bike.conflict_type === 'booked' ? '#7c3aed' : '#dc2626',
                          border: `1px solid ${bike.conflict_type === 'booked' ? '#ddd6fe' : '#fecaca'}`,
                          borderRadius: '20px', padding: '2px 10px', fontSize: '11px', fontWeight: 700,
                        }}>
                          {bike.conflict_type === 'repair' ? '🔧 ซ่อม' : bike.conflict_type === 'booked' ? '📅 ติดจอง' : '🔴 ถูกเช่า'}
                        </span>
                      </div>
                      {(bike.color || bike.year) && (
                        <div className="bike-result-meta">
                          <span>🎨 {[bike.color, bike.year ? `ปี ${bike.year}` : null].filter(Boolean).join(' • ')}</span>
                        </div>
                      )}
                      <div style={{ fontSize: '12px', color: bike.conflict_type === 'booked' ? '#7c3aed' : '#dc2626', marginTop: '6px' }}>
                        {bike.status === 'repair'
                          ? '🔧 อยู่ระหว่างซ่อม'
                          : `🔴 ${bike.conflict_reason ?? 'มีการเช่าในช่วงเวลานี้'}`}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
