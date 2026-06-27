'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { OwnerBike } from './page'

type Branch = { id: string; name: string }

const STATUS_ORDER = ['available', 'rented', 'repair', 'retired']
const STATUS_LABEL: Record<string, string> = {
  available: '🟢 ว่าง',
  rented:    '🔵 เช่าอยู่',
  repair:    '🔴 ซ่อม',
  retired:   '⚫ เลิกใช้',
}
const DOT_COLOR: Record<string, string> = {
  available: '#16a34a',
  rented:    '#2563eb',
  repair:    '#dc2626',
  retired:   '#9ca3af',
}

function docAlert(days: number | null): { label: string; color: string; bg: string } | null {
  if (days === null) return null
  if (days < 0)   return { label: `หมดอายุแล้ว`, color: '#b91c1c', bg: '#fee2e2' }
  if (days <= 14) return { label: `${days} วัน`, color: '#dc2626', bg: '#fef2f2' }
  if (days <= 30) return { label: `${days} วัน`, color: '#d97706', bg: '#fffbeb' }
  return null
}

export default function BikeListClient({ bikes, branches }: { bikes: OwnerBike[]; branches: Branch[] }) {
  const [search, setSearch]     = useState('')
  const [branchId, setBranchId] = useState('all')
  const [view, setView]         = useState<'list' | 'grid'>('list')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return bikes.filter(b => {
      if (branchId !== 'all' && b.branch_id !== branchId) return false
      if (q && !b.license_plate.toLowerCase().includes(q) &&
               !b.model.toLowerCase().includes(q) &&
               !b.brand.toLowerCase().includes(q)) return false
      return true
    })
  }, [bikes, search, branchId])

  const counts = {
    available: filtered.filter(b => b.status === 'available').length,
    rented:    filtered.filter(b => b.status === 'rented').length,
    repair:    filtered.filter(b => b.status === 'repair').length,
    retired:   filtered.filter(b => b.status === 'retired').length,
  }

  const grouped = STATUS_ORDER.map(s => ({
    status: s,
    label: STATUS_LABEL[s],
    bikes: filtered.filter(b => b.status === s),
  })).filter(g => g.bikes.length > 0)

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '8px', padding: '10px 14px', background: '#fff', borderBottom: '1px solid #e5e7eb', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 ค้นหาทะเบียน, รุ่น..."
          style={{ flex: 1, border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', outline: 'none' }}
        />
        <select
          value={branchId}
          onChange={e => setBranchId(e.target.value)}
          style={{ border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '8px', fontSize: '12px', color: '#6b7280', outline: 'none' }}
        >
          <option value="all">ทุกสาขา</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div style={{ display: 'flex', border: '1.5px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
          {(['list', 'grid'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '7px 10px', border: 'none', cursor: 'pointer', fontSize: '14px',
              background: view === v ? '#1e3a8a' : '#fff',
              color: view === v ? '#fff' : '#9ca3af',
            }}>{v === 'list' ? '☰' : '⊞'}</button>
          ))}
        </div>
      </div>

      {/* Status strip */}
      <div style={{ background: '#fff', display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
        {[
          { key: 'available', label: 'ว่าง',     color: '#16a34a' },
          { key: 'rented',    label: 'เช่าอยู่',  color: '#2563eb' },
          { key: 'repair',    label: 'ซ่อม',      color: '#dc2626' },
          { key: 'retired',   label: 'เลิกใช้',   color: '#9ca3af' },
        ].map(({ key, label, color }, i, arr) => (
          <div key={key} style={{
            flex: 1, textAlign: 'center', padding: '10px',
            borderRight: i < arr.length - 1 ? '1px solid #e5e7eb' : 'none',
          }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color }}>{counts[key as keyof typeof counts]}</div>
            <div style={{ fontSize: '10px', color: '#9ca3af' }}>{label}</div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: '#9ca3af', fontSize: '14px' }}>
          ไม่พบรถที่ตรงกับการค้นหา
        </div>
      )}

      {/* Grid view */}
      {view === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '12px', paddingBottom: '80px' }}>
          {filtered.map(bike => (
            <Link key={bike.id} href={`/owner/bikes/${bike.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: '#fff', borderRadius: '14px', padding: '12px',
                boxShadow: '0 1px 4px rgba(0,0,0,.07)',
                border: `2px solid ${DOT_COLOR[bike.status]}22`,
              }}>
                {bike.photo_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={bike.photo_url} alt="" style={{ width: '100%', height: '70px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px', filter: bike.status === 'repair' || bike.status === 'retired' ? 'grayscale(.6)' : 'none' }} />
                  : <div style={{ fontSize: '28px', textAlign: 'center', marginBottom: '8px', filter: bike.status === 'repair' || bike.status === 'retired' ? 'grayscale(.6)' : 'none' }}>🛵</div>
                }
                <div style={{ fontWeight: 800, fontSize: '14px', textAlign: 'center' }}>{bike.license_plate}</div>
                <div style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center', marginBottom: '6px' }}>
                  {bike.brand} {bike.model}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block', fontSize: '11px', fontWeight: 600,
                    padding: '2px 8px', borderRadius: '20px',
                    background: `${DOT_COLOR[bike.status]}15`, color: DOT_COLOR[bike.status],
                  }}>{STATUS_LABEL[bike.status]}</span>
                </div>
                {bike.return_date && (
                  <div style={{ fontSize: '10px', color: '#2563eb', textAlign: 'center', marginTop: '4px' }}>
                    คืน {new Date(bike.return_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                  </div>
                )}
                <div style={{ fontSize: '10px', color: '#9ca3af', textAlign: 'center', marginTop: '4px' }}>
                  {bike.branch_name} • ฿{bike.daily_rate}/วัน
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <div style={{ paddingBottom: '80px' }}>
          {grouped.map(group => (
            <div key={group.status}>
              <div style={{
                padding: '8px 14px 4px',
                fontSize: '11px', fontWeight: 700, color: '#6b7280',
                textTransform: 'uppercase', letterSpacing: '.5px',
                background: '#f9fafb', borderBottom: '1px solid #f3f4f6',
              }}>
                {group.label} ({group.bikes.length})
              </div>
              {group.bikes.map(bike => {
                const taxAlert = docAlert(bike.days_until_tax)
                const pobAlert = docAlert(bike.days_until_pob)
                const isGray = bike.status === 'repair' || bike.status === 'retired'
                return (
                  <Link key={bike.id} href={`/owner/bikes/${bike.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '12px 14px', background: '#fff',
                      borderBottom: '1px solid #f3f4f6',
                    }}>
                      {/* Status dot */}
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                        background: DOT_COLOR[bike.status],
                      }} />

                      {/* Icon */}
                      {bike.photo_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={bike.photo_url} alt="" style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0, filter: isGray ? 'grayscale(.5)' : 'none' }} />
                        : <div style={{ fontSize: '22px', filter: isGray ? 'grayscale(.5)' : 'none', flexShrink: 0 }}>🛵</div>
                      }

                      {/* Main info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: '#111827' }}>
                          {bike.license_plate}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          {bike.brand} {bike.model}{bike.year ? ` • ปี ${bike.year + 543}` : ''}{bike.color ? ` • ${bike.color}` : ''}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                          <span style={{ fontSize: '10px', background: '#f3f4f6', color: '#374151', borderRadius: '4px', padding: '2px 6px' }}>
                            {bike.branch_name}
                          </span>
                          {bike.return_date && (
                            <span style={{ fontSize: '10px', background: '#eff6ff', color: '#2563eb', borderRadius: '4px', padding: '2px 6px' }}>
                              คืน {new Date(bike.return_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                          {taxAlert && (
                            <span style={{ fontSize: '10px', background: taxAlert.bg, color: taxAlert.color, borderRadius: '4px', padding: '2px 6px', fontWeight: 600 }}>
                              ⚠️ ภาษี {taxAlert.label}
                            </span>
                          )}
                          {pobAlert && (
                            <span style={{ fontSize: '10px', background: pobAlert.bg, color: pobAlert.color, borderRadius: '4px', padding: '2px 6px', fontWeight: 600 }}>
                              ⚠️ พรบ. {pobAlert.label}
                            </span>
                          )}
                          {bike.last_oil_date && (
                            <span style={{ fontSize: '10px', background: '#fefce8', color: '#854d0e', borderRadius: '4px', padding: '2px 6px' }}>
                              🛢️ น้ำมัน {new Date(bike.last_oil_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                            </span>
                          )}
                          {bike.last_gear_date && (
                            <span style={{ fontSize: '10px', background: '#f0fdf4', color: '#166534', borderRadius: '4px', padding: '2px 6px' }}>
                              ⚙️ เฟือง {new Date(bike.last_gear_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                            </span>
                          )}
                          {bike.notes && (
                            <span style={{ fontSize: '10px', background: '#fef2f2', color: '#dc2626', borderRadius: '4px', padding: '2px 6px' }}>
                              🔧 {bike.notes}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>฿{bike.daily_rate}/วัน</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>{(bike.odometer ?? 0).toLocaleString()} กม.</div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
