'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PeriodSelector } from '../dashboard/PeriodSelector'

export type CloseShopRow = {
  id: string
  closedAt: string
  selfiePhotoUrl: string
  platePhotos: { url: string; detectedPlates: string[] }[]
  expectedPlates: string[]
  foundPlates: string[]
  missingPlates: string[]
  explanation: string | null
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

export default function CloseShopReportClient({ rows, branches, period, from, to, branch, periodLabel }: {
  rows: CloseShopRow[]
  branches: { id: string; name: string }[]
  period: string
  from?: string
  to?: string
  branch: string
  periodLabel: string
}) {
  const router = useRouter()
  const [zoomed, setZoomed] = useState<string | null>(null)

  const setBranchFilter = (b: string) => {
    const params = new URLSearchParams()
    params.set('period', period)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (b) params.set('branch', b)
    router.push(`/owner/closeshop?${params}`)
  }

  const groups: Record<string, CloseShopRow[]> = {}
  for (const r of rows) {
    const key = dateKey(r.closedAt)
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
          <h1>🔒 ปิดร้าน</h1>
          <div className="sub">สต็อกรถตอนปิดร้าน + รูปหลักฐาน — {periodLabel}</div>
        </div>
        <PeriodSelector current={period} currentFrom={from} currentTo={to} basePath="/owner/closeshop" />
      </div>

      {/* Branch filter */}
      <div style={{ display: 'flex', gap: '6px', padding: '12px 16px 0', flexWrap: 'wrap' }}>
        {[{ id: '', name: 'ทุกสาขา' }, ...branches].map(b => (
          <button key={b.id} onClick={() => setBranchFilter(b.id)} style={{
            padding: '6px 14px', borderRadius: '20px', border: '1.5px solid',
            fontSize: '13px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
            background: branch === b.id ? '#111827' : '#fff',
            color: branch === b.id ? '#fff' : '#6b7280',
            borderColor: branch === b.id ? '#111827' : '#e5e7eb',
          }}>
            {b.name}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ margin: '16px 16px 80px' }}>
        {rows.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', textAlign: 'center', fontSize: '13px', color: '#9ca3af', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
            ไม่มีรายการในช่วงนี้
          </div>
        ) : orderedKeys.map(key => (
          <div key={key} style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', marginBottom: '8px', paddingLeft: '2px' }}>
              {fmtDate(groups[key][0].closedAt)} ({groups[key].length} ครั้ง)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {groups[key].map(r => {
                const complete = r.missingPlates.length === 0
                return (
                  <div key={r.id} style={{
                    background: '#fff', borderRadius: '14px', boxShadow: '0 1px 4px rgba(0,0,0,.07)',
                    overflow: 'hidden', borderLeft: `4px solid ${complete ? '#16a34a' : '#dc2626'}`,
                  }}>
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.selfiePhotoUrl} alt={r.staffName} onClick={() => setZoomed(r.selfiePhotoUrl)}
                        style={{ width: '44px', height: '44px', borderRadius: '10px', objectFit: 'cover', cursor: 'pointer', flexShrink: 0 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{r.staffName}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>{r.branchName}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: '#111827' }}>{fmtTime(r.closedAt)}</div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: complete ? '#16a34a' : '#dc2626' }}>
                          {r.foundPlates.length}/{r.expectedPlates.length} คัน
                        </div>
                      </div>
                    </div>

                    {!complete && (
                      <div style={{ margin: '0 14px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 12px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#dc2626', marginBottom: '4px' }}>
                          ⚠️ ไม่พบ {r.missingPlates.length} คัน: {r.missingPlates.join(', ')}
                        </div>
                        {r.explanation && (
                          <div style={{ fontSize: '12px', color: '#7f1d1d' }}>เหตุผล: {r.explanation}</div>
                        )}
                      </div>
                    )}

                    {r.platePhotos.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '0 14px 12px' }}>
                        {r.platePhotos.map((p, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={p.url} alt="" onClick={() => setZoomed(p.url)}
                            style={{ width: '52px', height: '52px', borderRadius: '8px', objectFit: 'cover', cursor: 'pointer', flexShrink: 0 }} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
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
