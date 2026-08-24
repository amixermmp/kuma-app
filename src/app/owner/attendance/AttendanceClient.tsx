'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PeriodSelector } from '../dashboard/PeriodSelector'
import { BranchFilter } from '@/components/BranchFilter'

export type CheckinRow = {
  id: string
  checkedInAt: string
  photoUrl: string
  staffName: string
  branchName: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', weekday: 'short', day: 'numeric', month: 'short' })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })
}
function dateKey(iso: string) {
  return new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0]
}

export default function AttendanceClient({ rows, branches, period, from, to, branch, periodLabel }: {
  rows: CheckinRow[]
  branches: { id: string; name: string }[]
  period: string
  from?: string
  to?: string
  branch: string
  periodLabel: string
}) {
  const [zoomed, setZoomed] = useState<string | null>(null)

  const groups: Record<string, CheckinRow[]> = {}
  for (const r of rows) {
    const key = dateKey(r.checkedInAt)
    if (!groups[key]) groups[key] = []
    groups[key].push(r)
  }
  const orderedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a))

  return (
    <div className="app-wrap">

      {/* Header */}
      <div className="app-header" style={{ background: '#111827', alignItems: 'center' }}>
        <Link href="/owner/dashboard" className="app-header-back">←</Link>
        <div style={{ flex: 1 }}>
          <h1>📸 การเข้างาน</h1>
          <div className="sub">รายงานเวลาเข้างานพนักงาน — {periodLabel}</div>
        </div>
        <PeriodSelector current={period} currentFrom={from} currentTo={to} basePath="/owner/attendance" />
      </div>

      <BranchFilter branches={branches} current={branch} basePath="/owner/attendance" theme="light" extraParams={{ period, from, to }} />

      {/* List */}
      <div style={{ margin: '16px 16px 80px' }}>
        {rows.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', textAlign: 'center', fontSize: '13px', color: '#9ca3af', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
            ไม่มีรายการในช่วงนี้
          </div>
        ) : orderedKeys.map(key => (
          <div key={key} style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', marginBottom: '8px', paddingLeft: '2px' }}>
              {fmtDate(groups[key][0].checkedInAt)} ({groups[key].length} คน)
            </div>
            <div style={{ background: '#fff', borderRadius: '14px', boxShadow: '0 1px 4px rgba(0,0,0,.07)', overflow: 'hidden' }}>
              {groups[key].map((r, i) => (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
                  borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.photoUrl} alt={r.staffName} onClick={() => setZoomed(r.photoUrl)}
                    style={{ width: '44px', height: '44px', borderRadius: '10px', objectFit: 'cover', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{r.staffName}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>{r.branchName}</div>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#111827' }}>{fmtTime(r.checkedInAt)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Zoom overlay */}
      {zoomed && (
        <div onClick={() => setZoomed(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', cursor: 'pointer',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomed} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '12px' }} />
        </div>
      )}

    </div>
  )
}
