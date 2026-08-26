'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BranchFilter } from '@/components/BranchFilter'

export type SlipRow = {
  source: 'rental' | 'monthly'
  id: string
  time: string
  branchId: string
  branch: string
  typeLabel: string
  customer: string
  plate: string
  amount: number
  photoUrl: string | null
  slipName: string | null
  nameMismatch: boolean
}

function fmtMoney(n: number) {
  return '฿' + n.toLocaleString('th-TH')
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })
}
function fmtDateLabel(dateStr: string) {
  return new Date(`${dateStr}T12:00:00+07:00`).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric',
  })
}
function shiftDate(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T12:00:00+07:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export default function SlipsClient({ rows, branches, date, branch }: {
  rows: SlipRow[]
  branches: { id: string; name: string }[]
  date: string
  branch: string
}) {
  const router = useRouter()
  const total = rows.reduce((s, r) => s + r.amount, 0)
  const noPhotoCount = rows.filter(r => !r.photoUrl).length
  const mismatchCount = rows.filter(r => r.nameMismatch).length

  const goDate = (d: string) => router.push(`/owner/statement/slips?date=${d}${branch ? `&branch=${branch}` : ''}`)

  return (
    <div className="app-wrap">

      {/* Header */}
      <div className="app-header" style={{ background: '#111827', alignItems: 'center' }}>
        <Link href="/owner/statement" className="app-header-back">←</Link>
        <div style={{ flex: 1 }}>
          <h1>📷 ตรวจสลิปประจำวัน</h1>
          <div className="sub">{fmtDateLabel(date)}</div>
        </div>
      </div>

      {/* Date nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px 0' }}>
        <button onClick={() => goDate(shiftDate(date, -1))} style={{
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px',
          padding: '8px 12px', fontSize: '14px', cursor: 'pointer',
        }}>◀</button>
        <input type="date" className="field-input" value={date}
          onChange={e => e.target.value && goDate(e.target.value)}
          style={{ flex: 1 }} />
        <button onClick={() => goDate(shiftDate(date, 1))} style={{
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px',
          padding: '8px 12px', fontSize: '14px', cursor: 'pointer',
        }}>▶</button>
      </div>

      <BranchFilter branches={branches} current={branch} basePath="/owner/statement/slips" theme="light" extraParams={{ date }} />

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', padding: '12px 16px' }}>
        <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>ยอดเข้ารวม</div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#16a34a' }}>{fmtMoney(total)}</div>
        </div>
        <div style={{ background: noPhotoCount > 0 ? '#fffbeb' : '#f8fafc', borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>ไม่มีรูปแนบ</div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: noPhotoCount > 0 ? '#d97706' : '#9ca3af' }}>{noPhotoCount}</div>
        </div>
        <div style={{ background: mismatchCount > 0 ? '#fef2f2' : '#f8fafc', borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>ชื่อไม่ตรง</div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: mismatchCount > 0 ? '#dc2626' : '#9ca3af' }}>{mismatchCount}</div>
        </div>
      </div>

      {/* List */}
      <div style={{ margin: '0 16px 80px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {rows.length === 0 ? (
          <div style={{
            background: '#fff', borderRadius: '14px', boxShadow: '0 1px 4px rgba(0,0,0,.07)',
            padding: '24px', textAlign: 'center', fontSize: '13px', color: '#9ca3af',
          }}>
            ไม่มีรายการรับเงินวันนี้
          </div>
        ) : rows.map(r => (
          <div key={`${r.source}-${r.id}`} style={{
            background: '#fff', borderRadius: '14px', boxShadow: '0 1px 4px rgba(0,0,0,.07)',
            overflow: 'hidden', display: 'flex',
            borderLeft: `4px solid ${r.nameMismatch ? '#dc2626' : !r.photoUrl ? '#d97706' : '#16a34a'}`,
          }}>
            {r.photoUrl ? (
              <a href={r.photoUrl} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.photoUrl} alt="สลิป" style={{ width: '76px', height: '100%', minHeight: '76px', objectFit: 'cover', display: 'block' }} />
              </a>
            ) : (
              <div style={{
                width: '76px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#fffbeb', color: '#d97706', fontSize: '11px', textAlign: 'center', padding: '4px',
              }}>
                ไม่มีรูป
              </div>
            )}
            <div style={{ flex: 1, padding: '10px 12px', minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{r.typeLabel}</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#16a34a' }}>{fmtMoney(r.amount)}</div>
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                {[r.plate, r.customer].filter(Boolean).join(' • ')}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                {fmtTime(r.time)} • {r.branch}
              </div>
              {r.nameMismatch && (
                <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700, marginTop: '4px' }}>
                  ⚠️ ชื่อผู้โอน &quot;{r.slipName}&quot; ไม่ตรงกับ &quot;{r.customer}&quot;
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
