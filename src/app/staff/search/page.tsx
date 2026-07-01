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

type ModelGroup = {
  key: string
  brand: string
  model: string
  daily_rate: number
  availableCount: number
  totalCount: number
  bikes: BikeResult[]
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

function groupByModel(bikes: BikeResult[]): ModelGroup[] {
  const map = new Map<string, ModelGroup>()
  for (const bike of bikes) {
    const key = `${bike.brand}__${bike.model}__${bike.daily_rate}`
    if (!map.has(key)) {
      map.set(key, { key, brand: bike.brand, model: bike.model, daily_rate: bike.daily_rate, availableCount: 0, totalCount: 0, bikes: [] })
    }
    const g = map.get(key)!
    g.totalCount++
    g.bikes.push(bike)
    if (bike.available) g.availableCount++
  }
  // Sort: available first, then by daily_rate
  return Array.from(map.values()).sort((a, b) => {
    if (a.availableCount > 0 && b.availableCount === 0) return -1
    if (a.availableCount === 0 && b.availableCount > 0) return 1
    return a.daily_rate - b.daily_rate
  })
}

export default function SearchPage() {
  const [from, setFrom] = useState(nowLocal())
  const [to, setTo] = useState(nowLocal(1 * 24 * 60 * 60 * 1000))
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
      setSearched(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const days = from && to ? daysBetween(from, to) : 0
  const groups = results ? groupByModel(results) : []
  const availableGroups = groups.filter(g => g.availableCount > 0)
  const unavailableGroups = groups.filter(g => g.availableCount === 0)

  return (
    <div className="app-wrap">

      {/* Header */}
      <div className="app-header">
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div>
          <h1>จองรถ</h1>
          <div className="sub">เลือกช่วงเวลาแล้วเลือกรุ่น</div>
        </div>
      </div>

      {/* Search form */}
      <div className="card" style={{ margin: '12px' }}>
        <div className="card-title">ช่วงเวลาที่ต้องการ</div>
        <div className="field-row">
          <label className="field-label">📅 วันเริ่มเช่า</label>
          <input className="field-input" type="datetime-local"
            value={from} min={nowLocal()}
            onChange={e => { setFrom(e.target.value); if (e.target.value >= to) setTo(nowLocal(24 * 60 * 60 * 1000)) }} />
        </div>
        <div className="field-row" style={{ marginBottom: 0 }}>
          <label className="field-label">📅 วันที่คืนรถ</label>
          <input className="field-input" type="datetime-local"
            value={to} min={from || nowLocal()}
            onChange={e => setTo(e.target.value)} />
        </div>
      </div>

      <div style={{ padding: '0 12px 12px' }}>
        <button
          className="btn"
          style={{ background: '#e11d48', color: '#fff', width: '100%', opacity: loading ? 0.7 : 1 }}
          onClick={handleSearch}
          disabled={loading || !from || !to}
        >
          {loading ? '⏳ กำลังค้นหา...' : '🔍 ค้นหารถว่าง'}
        </button>
      </div>

      {/* Results */}
      {searched && (
        <>
          <div className="divider" />
          <div style={{ padding: '12px 12px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#4b5563' }}>
              ผลการค้นหา — <span style={{ color: '#e11d48' }}>{days} วัน</span>
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              ว่าง {availableGroups.length} รุ่น
            </div>
          </div>

          <div style={{ padding: '0 12px 80px' }}>

            {availableGroups.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '24px', background: '#f9fafb',
                borderRadius: '12px', color: '#9ca3af', fontSize: '14px', marginBottom: '12px',
              }}>
                😔 ไม่มีรถว่างในช่วงเวลานี้
              </div>
            )}

            {/* Available model groups */}
            {availableGroups.map(group => (
              <div key={group.key} style={{
                background: '#fff', borderRadius: '14px', marginBottom: '10px',
                boxShadow: '0 1px 4px rgba(0,0,0,.08)', overflow: 'hidden',
                border: '1px solid #e5e7eb',
              }}>
                <div style={{ padding: '14px 14px 10px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '12px',
                    background: '#f1f5f9', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '28px', flexShrink: 0,
                  }}>🛵</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '16px', color: '#111827' }}>
                      {group.brand} {group.model}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                      ฿{group.daily_rate.toLocaleString()}/วัน
                    </div>
                    <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
                        borderRadius: '20px', padding: '2px 10px', fontSize: '12px', fontWeight: 700,
                      }}>
                        ✅ ว่าง {group.availableCount} คัน
                      </span>
                      <span style={{
                        background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb',
                        borderRadius: '20px', padding: '2px 10px', fontSize: '12px',
                      }}>
                        รวม {group.totalCount} คัน
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{
                  borderTop: '1px solid #e5e7eb', padding: '10px 14px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>
                      ฿{(group.daily_rate * days).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>
                      ฿{group.daily_rate.toLocaleString()} × {days} วัน
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Link
                      href={`/staff/walkin/model?brand=${encodeURIComponent(group.brand)}&model=${encodeURIComponent(group.model)}&rate=${group.daily_rate}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}
                      style={{
                        background: '#16a34a', color: '#fff', textDecoration: 'none',
                        padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
                      }}
                    >
                      🛵 ส่งรถเลย
                    </Link>
                    <Link
                      href={`/staff/booking/model?brand=${encodeURIComponent(group.brand)}&model=${encodeURIComponent(group.model)}&rate=${group.daily_rate}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}
                      style={{
                        background: '#e11d48', color: '#fff', textDecoration: 'none',
                        padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
                      }}
                    >
                      📅 จองคิว
                    </Link>
                  </div>
                </div>
              </div>
            ))}

            {/* Unavailable groups */}
            {unavailableGroups.length > 0 && (
              <>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', padding: '8px 2px 6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  ไม่ว่างในช่วงเวลานี้
                </div>
                {unavailableGroups.map(group => (
                  <div key={group.key} style={{
                    background: '#f9fafb', borderRadius: '14px', marginBottom: '8px',
                    border: '1px solid #e5e7eb', overflow: 'hidden', opacity: 0.6,
                  }}>
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ fontSize: '28px', filter: 'grayscale(1)' }}>🛵</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#374151' }}>
                          {group.brand} {group.model}
                        </div>
                        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                          ฿{group.daily_rate.toLocaleString()}/วัน • ไม่ว่างทุกคัน ({group.totalCount} คัน)
                        </div>
                      </div>
                      <span style={{
                        background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                        borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: 700,
                      }}>
                        🔴 ไม่ว่าง
                      </span>
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
