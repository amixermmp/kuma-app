'use client'

import { useState } from 'react'
import Link from 'next/link'

type DailyRental = {
  id: string
  start_datetime: string
  actual_end_datetime: string | null
  total_amount: number | null
  send_odometer: number | null
  return_odometer: number | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bikes: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customers: any
}

type MonthlyRental = {
  id: string
  start_date: string
  end_date: string | null
  monthly_rate: number
  send_odometer: number | null
  return_odometer: number | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bikes: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customers: any
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatMoney(n: number | null) {
  if (!n) return '฿0'
  return `฿${n.toLocaleString()}`
}

// จำนวนวันที่ใช้จริง — ปัดขึ้นอย่างน้อย 1 วัน กันเช่า/คืนวันเดียวกันโชว์เป็น 0
function daysBetween(startIso: string, endIso: string | null): number | null {
  if (!endIso) return null
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  if (ms <= 0) return 1
  return Math.max(1, Math.round(ms / 86_400_000))
}

// กิโลรวม — คำนวณได้เฉพาะสัญญาที่มีข้อมูลไมล์ครบทั้งตอนส่งและตอนคืน (สัญญาเก่าก่อนฟีเจอร์นี้จะไม่มี)
function kmDriven(sendOdo: number | null, returnOdo: number | null): number | null {
  if (sendOdo == null || returnOdo == null) return null
  const km = returnOdo - sendOdo
  return km >= 0 ? km : null
}

function KmStats({ days, km }: { days: number | null; km: number | null }) {
  if (days == null) return null
  return (
    <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap' }}>
      <Info label="ใช้ไป" value={`${days} วัน`} />
      <Info label="กิโลรวม" value={km != null ? `${km.toLocaleString()} กม.` : '—'} />
      <Info label="เฉลี่ย/วัน" value={km != null ? `${Math.round(km / days).toLocaleString()} กม.` : '—'} />
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 600, marginBottom: '1px' }}>{label}</div>
      <div style={{ fontSize: '12px', color: '#374151' }}>{value}</div>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af', fontSize: '14px' }}>
      {label}
    </div>
  )
}

export default function HistoryClient({
  dailyRentals, monthlyRentals,
}: {
  dailyRentals: DailyRental[]
  monthlyRentals: MonthlyRental[]
}) {
  const [tab, setTab] = useState<'daily' | 'monthly'>('daily')
  const [query, setQuery] = useState('')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matches = (r: any) => {
    if (!query.trim()) return true
    const q = query.trim().toLowerCase()
    const bike = r.bikes ?? {}
    const customer = r.customers ?? {}
    return [bike.license_plate, customer.name, customer.phone]
      .some(v => typeof v === 'string' && v.toLowerCase().includes(q))
  }

  const dailyList = dailyRentals.filter(matches)
  const monthlyList = monthlyRentals.filter(matches)

  return (
    <div className="app-wrap">
      {/* Header */}
      <div className="app-header" style={{ background: '#111827' }}>
        <Link href="/owner/rentals" className="app-header-back">←</Link>
        <div style={{ flex: 1 }}>
          <h1>ประวัติรถที่คืนแล้ว</h1>
          <div className="sub">
            รายวัน {dailyList.length} | รายเดือน {monthlyList.length} (ล่าสุด 300 รายการ)
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        {(['daily', 'monthly'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '12px', border: 'none', cursor: 'pointer',
              background: 'transparent',
              borderBottom: tab === t ? '2px solid #111827' : '2px solid transparent',
              color: tab === t ? '#111827' : '#6b7280',
              fontWeight: tab === t ? 700 : 400, fontSize: '14px',
            }}
          >
            {t === 'daily' ? `🛵 รายวัน (${dailyList.length})` : `📅 รายเดือน (${monthlyList.length})`}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ padding: '12px 12px 0' }}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="🔍 ค้นหาทะเบียน / ชื่อ / เบอร์โทร..."
          style={{
            width: '100%', boxSizing: 'border-box', padding: '12px 14px',
            borderRadius: '12px', border: '1.5px solid #e5e7eb', fontSize: '14px',
            outline: 'none', background: '#fff', fontFamily: 'inherit',
          }}
        />
      </div>

      {/* List */}
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '80px' }}>

        {tab === 'daily' && (
          dailyList.length === 0
            ? <EmptyState label={query.trim() ? `ไม่พบ "${query}"` : 'ยังไม่มีประวัติการคืนรถรายวัน'} />
            : dailyList.map(r => {
              const bike = r.bikes ?? {}
              const customer = r.customers ?? {}
              const days = daysBetween(r.start_datetime, r.actual_end_datetime)
              const km = kmDriven(r.send_odometer, r.return_odometer)
              return (
                <div key={r.id} style={{
                  background: '#fff', borderRadius: '14px',
                  boxShadow: '0 1px 4px rgba(0,0,0,.07)',
                  border: '1.5px solid #e5e7eb', overflow: 'hidden',
                }}>
                  <div style={{
                    background: '#f8fafc', padding: '10px 14px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: '1px solid #e5e7eb',
                  }}>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: '#111827' }}>
                      {bike.license_plate ?? '—'}
                    </div>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                      borderRadius: '12px', background: '#f1f5f9', color: '#374151',
                    }}>คืนแล้ว</span>
                  </div>
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                      <strong>{customer.name ?? '—'}</strong>
                      {customer.phone ? ` • ${customer.phone}` : ''}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {bike.brand} {bike.model}{bike.color ? ` • ${bike.color}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap' }}>
                      <Info label="วันเช่า" value={formatDate(r.start_datetime)} />
                      <Info label="วันคืน" value={r.actual_end_datetime ? formatDate(r.actual_end_datetime) : '—'} />
                      <Info label="ยอดรวม" value={formatMoney(r.total_amount)} />
                    </div>
                    <KmStats days={days} km={km} />
                  </div>
                </div>
              )
            })
        )}

        {tab === 'monthly' && (
          monthlyList.length === 0
            ? <EmptyState label={query.trim() ? `ไม่พบ "${query}"` : 'ยังไม่มีประวัติการคืนรถรายเดือน'} />
            : monthlyList.map(r => {
              const bike = r.bikes ?? {}
              const customer = r.customers ?? {}
              const days = daysBetween(`${r.start_date}T00:00:00+07:00`, r.end_date ? `${r.end_date}T00:00:00+07:00` : null)
              const km = kmDriven(r.send_odometer, r.return_odometer)
              return (
                <div key={r.id} style={{
                  background: '#fff', borderRadius: '14px',
                  boxShadow: '0 1px 4px rgba(0,0,0,.07)',
                  border: '1.5px solid #e5e7eb', overflow: 'hidden',
                }}>
                  <div style={{
                    background: '#f8fafc', padding: '10px 14px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: '1px solid #e5e7eb',
                  }}>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: '#111827' }}>
                      {bike.license_plate ?? '—'}
                    </div>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                      borderRadius: '12px', background: '#f1f5f9', color: '#374151',
                    }}>สิ้นสุดแล้ว</span>
                  </div>
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                      <strong>{customer.name ?? '—'}</strong>
                      {customer.phone ? ` • ${customer.phone}` : ''}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {bike.brand} {bike.model}{bike.color ? ` • ${bike.color}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap' }}>
                      <Info label="เริ่มเช่า" value={formatDate(r.start_date)} />
                      <Info label="สิ้นสุด" value={r.end_date ? formatDate(r.end_date) : '—'} />
                      <Info label="ค่าเช่า/เดือน" value={formatMoney(r.monthly_rate)} />
                    </div>
                    <KmStats days={days} km={km} />
                  </div>
                </div>
              )
            })
        )}
      </div>
    </div>
  )
}
