'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Bike, Zap, CalendarPlus } from 'lucide-react'
import { bangkokToUTC } from '@/lib/time'
import { calcRentQuote } from '@/lib/pricing'
import QuarterHourInput from '@/components/staff/QuarterHourInput'

type BikeResult = {
  id: string
  license_plate: string
  brand: string
  model: string
  color: string | null
  year: number | null
  daily_rate: number
  monthly_rate: number | null
  promo_pay_days: number
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
  monthly_rate: number | null
  promoPayDays: number
  availableCount: number
  totalCount: number
  bikes: BikeResult[]
}

// ปัดนาทีขึ้นเป็นช่วง 15 นาที (00/15/30/45) เสมอ — ให้ตรงกับตัวเลือกนาทีในหน้าส่งรถ
// (เดิมปล่อยนาทีดิบ เช่น 19 ผ่านไป พอถึงหน้าส่งรถ dropdown ไม่มีตัวเลือก 19 เลยเด้งไปโชว์ 00 แทนแบบเงียบๆ)
function nowLocal(offsetMs = 0) {
  const d = new Date(Date.now() + offsetMs)
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function daysBetween(from: string, to: string) {
  return Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000))
}

function groupByModel(bikes: BikeResult[]): ModelGroup[] {
  const map = new Map<string, ModelGroup>()
  for (const bike of bikes) {
    const key = `${bike.brand}__${bike.model}__${bike.daily_rate}__${bike.monthly_rate ?? ''}`
    if (!map.has(key)) {
      map.set(key, { key, brand: bike.brand, model: bike.model, daily_rate: bike.daily_rate, monthly_rate: bike.monthly_rate, promoPayDays: bike.promo_pay_days, availableCount: 0, totalCount: 0, bikes: [] })
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
  const [fBrand, setFBrand] = useState('')
  const [fModel, setFModel] = useState('')

  const handleSearch = async () => {
    if (!from || !to || new Date(to) <= new Date(from)) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/staff/search/bikes?from=${encodeURIComponent(bangkokToUTC(from))}&to=${encodeURIComponent(bangkokToUTC(to))}`
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
  // ตัวเลือกกรอง — ดึงจากผลค้นหาจริง
  const brandChoices = Array.from(new Set(groups.map(g => g.brand))).sort()
  const modelChoices = Array.from(new Set(groups.filter(g => !fBrand || g.brand === fBrand).map(g => g.model))).sort()
  // กรองตามยี่ห้อ/รุ่นที่เลือก (ลูกค้ารีเควสรุ่นเจาะจง)
  const shownGroups = groups.filter(g => (!fBrand || g.brand === fBrand) && (!fModel || g.model === fModel))
  const availableGroups = shownGroups.filter(g => g.availableCount > 0)
  const unavailableGroups = shownGroups.filter(g => g.availableCount === 0)

  return (
    <div className="app-wrap" style={{ background: '#111111', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ padding: '18px 16px 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Link href="/staff/home" style={{ display: 'flex', color: '#fff' }}>
          <ArrowLeft size={20} strokeWidth={1.75} />
        </Link>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>จองรถ</div>
          <div style={{ color: 'rgba(255,255,255,.55)', fontSize: '11px' }}>เลือกช่วงเวลาแล้วเลือกรุ่น</div>
        </div>
      </div>

      {/* Search form */}
      <div style={{ margin: '12px 16px', background: '#1e1e1e', borderRadius: '18px', padding: '14px' }}>
        <div style={{ color: 'rgba(255,255,255,.55)', fontSize: '11px', fontWeight: 600, marginBottom: '10px' }}>ช่วงเวลาที่ต้องการ</div>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ color: 'rgba(255,255,255,.7)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>วันเริ่มเช่า</label>
          <QuarterHourInput
            value={from} min={nowLocal()}
            onChange={v => { setFrom(v); if (v >= to) setTo(nowLocal(24 * 60 * 60 * 1000)) }} />
        </div>
        <div>
          <label style={{ color: 'rgba(255,255,255,.7)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>วันที่คืนรถ</label>
          <QuarterHourInput
            value={to} min={from || nowLocal()}
            onChange={setTo} />
        </div>
      </div>

      <div style={{ padding: '0 16px 14px' }}>
        <button
          style={{
            background: '#e5231b', color: '#fff', width: '100%', border: 'none',
            borderRadius: '14px', padding: '13px', fontSize: '14px', fontWeight: 700,
            fontFamily: 'inherit', cursor: 'pointer', opacity: loading ? 0.7 : 1,
          }}
          onClick={handleSearch}
          disabled={loading || !from || !to}
        >
          {loading ? 'กำลังค้นหา...' : 'ค้นหารถว่าง'}
        </button>
      </div>

      {/* Results — white sheet, fills remaining height */}
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '16px', flex: 1 }}>
        {!searched ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: '13px' }}>
            เลือกช่วงเวลาแล้วกดค้นหา
          </div>
        ) : (
          <>
            {/* กรองรุ่น — ลูกค้ารีเควสรุ่นเจาะจง เลือกแล้วเจอเลย */}
            {groups.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <select className="field-input" style={{ flex: 1 }} value={fBrand}
                  onChange={e => { setFBrand(e.target.value); setFModel('') }}>
                  <option value="">ทุกยี่ห้อ</option>
                  {brandChoices.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <select className="field-input" style={{ flex: 1 }} value={fModel}
                  onChange={e => setFModel(e.target.value)}>
                  <option value="">ทุกรุ่น</option>
                  {modelChoices.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#4b5563' }}>
                ผลการค้นหา — <span style={{ color: '#e5231b' }}>{days} วัน</span>
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>
                ว่าง {availableGroups.length} รุ่น
              </div>
            </div>

            {availableGroups.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '24px', background: '#f9fafb',
                borderRadius: '12px', color: '#9ca3af', fontSize: '13px', marginBottom: '12px',
              }}>
                ไม่มีรถว่างในช่วงเวลานี้
              </div>
            )}

            {/* Available model groups */}
            {availableGroups.map(group => {
              const mcr = group.monthly_rate ?? group.daily_rate * 30
              const quote = days > 0 ? calcRentQuote(new Date(from), days, group.daily_rate, mcr, group.promoPayDays) : null
              const total = quote?.total ?? group.daily_rate * days
              const calcDays = quote?.shortResult?.calcDays ?? days
              const hasDiscount = quote && !quote.isLong && calcDays < days
              return (
              <div key={group.key} style={{
                background: '#fff', borderRadius: '16px', marginBottom: '10px',
                border: '0.5px solid #e5e7eb', overflow: 'hidden',
              }}>
                <div style={{ padding: '14px 14px 10px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
                    background: 'rgba(229,35,27,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Bike size={22} color="#e5231b" strokeWidth={1.75} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#111827' }}>
                      {group.brand} {group.model}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                      ฿{group.daily_rate.toLocaleString()}/วัน
                      {group.monthly_rate != null && ` • ฿${group.monthly_rate.toLocaleString()}/เดือน`}
                    </div>
                    <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        background: '#f0fdf4', color: '#16a34a',
                        borderRadius: '20px', padding: '2px 10px', fontSize: '11px', fontWeight: 700,
                      }}>
                        ว่าง {group.availableCount} คัน
                      </span>
                      <span style={{
                        background: '#f9fafb', color: '#6b7280',
                        borderRadius: '20px', padding: '2px 10px', fontSize: '11px',
                      }}>
                        รวม {group.totalCount} คัน
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{
                  borderTop: '0.5px solid #e5e7eb', padding: '10px 14px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: '17px', fontWeight: 700, color: '#111827' }}>
                      ฿{total.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>
                      {hasDiscount ? `฿${group.daily_rate.toLocaleString()} × ${calcDays} วัน (โปร 7 วัน จ่าย ${group.promoPayDays})` : `฿${group.daily_rate.toLocaleString()} × ${days} วัน`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Link
                      href={`/staff/walkin/model?brand=${encodeURIComponent(group.brand)}&model=${encodeURIComponent(group.model)}&rate=${group.daily_rate}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}
                      style={{
                        background: '#16a34a', color: '#fff', textDecoration: 'none',
                        padding: '10px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                      }}
                    >
                      <Bike size={14} strokeWidth={2} /> ส่งรถเลย
                    </Link>
                    <Link
                      href={`/staff/booking/model?brand=${encodeURIComponent(group.brand)}&model=${encodeURIComponent(group.model)}&rate=${group.daily_rate}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}
                      style={{
                        background: '#e5231b', color: '#fff', textDecoration: 'none',
                        padding: '10px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                      }}
                    >
                      <CalendarPlus size={14} strokeWidth={2} /> จองคิว
                    </Link>
                  </div>
                </div>
              </div>
              )
            })}

            {/* Unavailable groups */}
            {unavailableGroups.length > 0 && (
              <>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', padding: '8px 2px 6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  ไม่ว่างในช่วงเวลานี้
                </div>
                {unavailableGroups.map(group => (
                  <div key={group.key} style={{
                    background: '#f9fafb', borderRadius: '16px', marginBottom: '8px',
                    border: '0.5px solid #e5e7eb', overflow: 'hidden',
                  }}>
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                        background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Bike size={18} color="#9ca3af" strokeWidth={1.75} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: '#374151' }}>
                          {group.brand} {group.model}
                        </div>
                        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                          ฿{group.daily_rate.toLocaleString()}/วัน • ไม่ว่างทุกคัน ({group.totalCount} คัน)
                        </div>
                      </div>
                      <span style={{
                        background: '#fef2f2', color: '#dc2626',
                        borderRadius: '20px', padding: '3px 10px', fontSize: '10px', fontWeight: 700,
                      }}>
                        ไม่ว่าง
                      </span>
                    </div>
                    <div style={{
                      borderTop: '0.5px solid #e5e7eb', padding: '10px 14px',
                      display: 'flex', justifyContent: 'flex-end', gap: '8px',
                    }}>
                      <Link
                        href={`/staff/walkin/model?brand=${encodeURIComponent(group.brand)}&model=${encodeURIComponent(group.model)}&rate=${group.daily_rate}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}
                        style={{
                          background: '#eff6ff', color: '#2563eb', textDecoration: 'none',
                          padding: '9px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 700,
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                        }}
                      >
                        <Zap size={13} strokeWidth={2} /> ส่งรถเลย (Fast lane)
                      </Link>
                      <Link
                        href={`/staff/booking/model?brand=${encodeURIComponent(group.brand)}&model=${encodeURIComponent(group.model)}&rate=${group.daily_rate}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&fastLane=1`}
                        style={{
                          background: '#eff6ff', color: '#2563eb', textDecoration: 'none',
                          padding: '9px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 700,
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                        }}
                      >
                        <Zap size={13} strokeWidth={2} /> จองคิว (Fast lane)
                      </Link>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
