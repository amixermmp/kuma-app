'use client'

import { useState } from 'react'
import Link from 'next/link'

type Photo = { url: string; label?: string }

type DailyRental = {
  id: string
  start_datetime: string
  expected_end_datetime: string
  status: string
  daily_rate: number
  total_days: number | null
  total_amount: number | null
  deposit_amount: number
  payment_method: string | null
  send_photos: Photo[] | null
  notes: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bikes: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customers: any
}

type MonthlyRental = {
  id: string
  start_date: string
  payment_day: number
  monthly_rate: number
  deposit_amount: number
  status: string
  send_photos: Photo[] | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bikes: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customers: any
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
function formatMoney(n: number | null) {
  if (!n) return '฿0'
  return `฿${n.toLocaleString()}`
}

function PhotoViewer({ photos, onClose }: { photos: Photo[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0)
  const photo = photos[idx]
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.93)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '12px',
      }}
    >
      <div style={{ color: '#fff', fontSize: '13px', opacity: 0.6 }}>แตะพื้นหลังเพื่อปิด</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url} alt={photo.label ?? ''}
        style={{ maxWidth: '95vw', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px' }}
        onClick={e => e.stopPropagation()}
      />
      {photo.label && <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>{photo.label}</div>}
      {photos.length > 1 && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
        >
          <button
            onClick={() => setIdx(i => Math.max(0, i - 1))}
            disabled={idx === 0}
            style={{ background: '#fff3', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', opacity: idx === 0 ? 0.4 : 1 }}
          >‹</button>
          <span style={{ color: '#fff', fontSize: '12px' }}>{idx + 1} / {photos.length}</span>
          <button
            onClick={() => setIdx(i => Math.min(photos.length - 1, i + 1))}
            disabled={idx === photos.length - 1}
            style={{ background: '#fff3', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', opacity: idx === photos.length - 1 ? 0.4 : 1 }}
          >›</button>
        </div>
      )}
    </div>
  )
}

function ConfirmModal({
  label, onConfirm, onCancel, loading,
}: {
  label: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px 20px 0 0',
        padding: '24px', width: '100%', maxWidth: '440px',
      }}>
        <div style={{ fontSize: '18px', fontWeight: 800, color: '#111827', marginBottom: '8px' }}>
          ยืนยันคืนรถ?
        </div>
        <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>
          {label} — รูปภาพส่งรถทั้งหมดจะถูกลบออกจากระบบ ข้อมูลการเช่ายังคงเก็บไว้
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '14px', borderRadius: '12px',
              background: '#f3f4f6', color: '#374151',
              border: 'none', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1, padding: '14px', borderRadius: '12px',
              background: '#dc2626', color: '#fff',
              border: 'none', fontSize: '15px', fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'กำลังดำเนินการ...' : 'ยืนยันคืนรถ'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RentalsClient({
  dailyRentals, monthlyRentals,
}: {
  dailyRentals: DailyRental[]
  monthlyRentals: MonthlyRental[]
}) {
  const [tab, setTab] = useState<'daily' | 'monthly'>('daily')
  const [viewPhotos, setViewPhotos] = useState<Photo[] | null>(null)
  const [confirmEnd, setConfirmEnd] = useState<{ id: string; type: 'daily' | 'monthly'; label: string } | null>(null)
  const [endingId, setEndingId] = useState<string | null>(null)
  const [ended, setEnded] = useState<Set<string>>(new Set())

  const dailyList = dailyRentals.filter(r => !ended.has(r.id))
  const monthlyList = monthlyRentals.filter(r => !ended.has(r.id))

  async function handleEnd() {
    if (!confirmEnd) return
    setEndingId(confirmEnd.id)
    try {
      const res = await fetch('/api/owner/rental/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rentalId: confirmEnd.id, type: confirmEnd.type }),
      })
      if (res.ok) {
        setEnded(prev => new Set([...prev, confirmEnd.id]))
      } else {
        const d = await res.json()
        alert(d.error || 'เกิดข้อผิดพลาด')
      }
    } catch {
      alert('เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      setEndingId(null)
      setConfirmEnd(null)
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      active:   { label: 'กำลังเช่า', color: '#2563eb', bg: '#eff6ff' },
      extended: { label: 'ต่อเวลา',   color: '#7c3aed', bg: '#f5f3ff' },
      overdue:  { label: 'เกินกำหนด', color: '#dc2626', bg: '#fef2f2' },
    }
    const s = map[status] ?? { label: status, color: '#6b7280', bg: '#f3f4f6' }
    return (
      <span style={{
        fontSize: '11px', fontWeight: 700, padding: '2px 8px',
        borderRadius: '12px', background: s.bg, color: s.color,
      }}>{s.label}</span>
    )
  }

  return (
    <div className="app-wrap">
      {/* Header */}
      <div className="app-header" style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a8a)' }}>
        <Link href="/owner/home" className="app-header-back">←</Link>
        <div style={{ flex: 1 }}>
          <h1>ประวัติการเช่า</h1>
          <div className="sub">
            รายวัน {dailyList.length} | รายเดือน {monthlyList.length}
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
              borderBottom: tab === t ? '2px solid #1e3a8a' : '2px solid transparent',
              color: tab === t ? '#1e3a8a' : '#6b7280',
              fontWeight: tab === t ? 700 : 400, fontSize: '14px',
            }}
          >
            {t === 'daily' ? `🛵 รายวัน (${dailyList.length})` : `📅 รายเดือน (${monthlyList.length})`}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '80px' }}>

        {tab === 'daily' && (
          dailyList.length === 0
            ? <EmptyState label="ไม่มีการเช่ารายวันที่ active อยู่" />
            : dailyList.map(r => {
              const bike = r.bikes ?? {}
              const customer = r.customers ?? {}
              const photos = Array.isArray(r.send_photos) && r.send_photos.length > 0 ? r.send_photos : null
              const isOverdue = r.status === 'overdue' || new Date(r.expected_end_datetime) < new Date()
              return (
                <div key={r.id} style={{
                  background: '#fff', borderRadius: '14px',
                  boxShadow: '0 1px 4px rgba(0,0,0,.07)',
                  border: `1.5px solid ${isOverdue ? '#fecaca' : '#e5e7eb'}`,
                  overflow: 'hidden',
                }}>
                  {/* Header bar */}
                  <div style={{
                    background: isOverdue ? '#fef2f2' : '#f8fafc',
                    padding: '10px 14px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: '1px solid #e5e7eb',
                  }}>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: '#111827' }}>
                      {bike.license_plate ?? '—'}
                    </div>
                    {statusBadge(r.status)}
                  </div>

                  {/* Body */}
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
                      <Info
                        label="กำหนดคืน"
                        value={formatDateTime(r.expected_end_datetime)}
                        highlight={isOverdue ? '#dc2626' : undefined}
                      />
                      <Info label="ยอดรวม" value={formatMoney(r.total_amount)} />
                      <Info label="มัดจำ" value={formatMoney(r.deposit_amount)} />
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      {photos && (
                        <button
                          onClick={() => setViewPhotos(photos)}
                          style={{
                            flex: 1, padding: '9px', borderRadius: '10px',
                            background: '#eff6ff', color: '#2563eb',
                            border: '1px solid #bfdbfe', fontSize: '13px',
                            fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          📷 รูป ({photos.length})
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmEnd({
                          id: r.id, type: 'daily',
                          label: `${bike.license_plate} — ${customer.name}`,
                        })}
                        style={{
                          flex: 1, padding: '9px', borderRadius: '10px',
                          background: '#fef2f2', color: '#dc2626',
                          border: '1px solid #fecaca', fontSize: '13px',
                          fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        ✅ คืนรถ
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
        )}

        {tab === 'monthly' && (
          monthlyList.length === 0
            ? <EmptyState label="ไม่มีการเช่ารายเดือนที่ active อยู่" />
            : monthlyList.map(r => {
              const bike = r.bikes ?? {}
              const customer = r.customers ?? {}
              const photos = Array.isArray(r.send_photos) && r.send_photos.length > 0 ? r.send_photos : null
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
                      borderRadius: '12px', background: '#f0fdf4', color: '#16a34a',
                    }}>รายเดือน</span>
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
                      <Info label="ชำระทุกวันที่" value={`${r.payment_day} ของเดือน`} />
                      <Info label="ค่าเช่า/เดือน" value={formatMoney(r.monthly_rate)} />
                      <Info label="มัดจำ" value={formatMoney(r.deposit_amount)} />
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      {photos && (
                        <button
                          onClick={() => setViewPhotos(photos)}
                          style={{
                            flex: 1, padding: '9px', borderRadius: '10px',
                            background: '#eff6ff', color: '#2563eb',
                            border: '1px solid #bfdbfe', fontSize: '13px',
                            fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          📷 รูป ({photos.length})
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmEnd({
                          id: r.id, type: 'monthly',
                          label: `${bike.license_plate} — ${customer.name}`,
                        })}
                        style={{
                          flex: 1, padding: '9px', borderRadius: '10px',
                          background: '#fef2f2', color: '#dc2626',
                          border: '1px solid #fecaca', fontSize: '13px',
                          fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        ✅ คืนรถ
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
        )}
      </div>

      {/* Photo viewer */}
      {viewPhotos && (
        <PhotoViewer photos={viewPhotos} onClose={() => setViewPhotos(null)} />
      )}

      {/* Confirm modal */}
      {confirmEnd && (
        <ConfirmModal
          label={confirmEnd.label}
          onConfirm={handleEnd}
          onCancel={() => setConfirmEnd(null)}
          loading={endingId === confirmEnd.id}
        />
      )}
    </div>
  )
}

function Info({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 600, marginBottom: '1px' }}>{label}</div>
      <div style={{ fontSize: '12px', color: highlight ?? '#374151', fontWeight: highlight ? 700 : 400 }}>{value}</div>
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
