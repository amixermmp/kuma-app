'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PeriodSelector } from '../dashboard/PeriodSelector'

export type StatementRow = {
  source: 'rental' | 'monthly' | 'expense' | 'repair'
  id: string
  date: string
  branchId: string
  branch: string
  typeLabel: string
  detail: string
  amount: number // + รายรับ, - รายจ่าย
  voided: boolean
  voidReason: string | null
  waivable: boolean
}

function fmtMoney(n: number) {
  return (n < 0 ? '-฿' : '฿') + Math.abs(n).toLocaleString('th-TH')
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })
}

export default function StatementClient({ rows, branches, period, from, to, branch, periodLabel }: {
  rows: StatementRow[]
  branches: { id: string; name: string }[]
  period: string
  from?: string
  to?: string
  branch: string
  periodLabel: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  const income   = rows.filter(r => !r.voided && r.amount > 0).reduce((s, r) => s + r.amount, 0)
  const expense  = rows.filter(r => !r.voided && r.amount < 0).reduce((s, r) => s - r.amount, 0)
  const net      = income - expense
  const voidedCount = rows.filter(r => r.voided).length

  const waive = async (row: StatementRow) => {
    const reason = prompt(`Waive รายการ ${fmtMoney(row.amount)} (${row.detail})\nเหตุผล:`, 'บันทึกซ้ำ')
    if (reason === null) return
    setBusy(row.id)
    await fetch('/api/owner/statement/waive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: row.source, id: row.id, action: 'void', reason }),
    })
    setBusy(null)
    router.refresh()
  }

  const restore = async (row: StatementRow) => {
    if (!confirm(`คืนรายการ ${fmtMoney(row.amount)} (${row.detail}) กลับเข้าบัญชี?`)) return
    setBusy(row.id)
    await fetch('/api/owner/statement/waive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: row.source, id: row.id, action: 'restore' }),
    })
    setBusy(null)
    router.refresh()
  }

  const setBranch = (b: string) => {
    const params = new URLSearchParams()
    params.set('period', period)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (b) params.set('branch', b)
    router.push(`/owner/statement?${params}`)
  }

  return (
    <div className="app-wrap">

      {/* Header */}
      <div className="app-header" style={{ background: '#111827', alignItems: 'center' }}>
        <Link href="/owner/dashboard" className="app-header-back">←</Link>
        <div style={{ flex: 1 }}>
          <h1>🧾 Statement</h1>
          <div className="sub">บัญชีรายรับรายจ่าย — {periodLabel}</div>
        </div>
        <PeriodSelector current={period} currentFrom={from} currentTo={to} basePath="/owner/statement" />
      </div>

      {/* Branch filter */}
      <div style={{ display: 'flex', gap: '6px', padding: '12px 16px 0', flexWrap: 'wrap' }}>
        {[{ id: '', name: 'ทุกสาขา' }, ...branches].map(b => (
          <button key={b.id} onClick={() => setBranch(b.id)} style={{
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

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', padding: '12px 16px' }}>
        {([
          { lbl: 'รายรับ', val: fmtMoney(income), color: '#16a34a', bg: '#f0fdf4' },
          { lbl: 'รายจ่าย', val: fmtMoney(expense), color: '#dc2626', bg: '#fef2f2' },
          { lbl: 'สุทธิ', val: fmtMoney(net), color: net >= 0 ? '#16a34a' : '#dc2626', bg: '#f8fafc' },
        ] as const).map(({ lbl, val, color, bg }) => (
          <div key={lbl} style={{ background: bg, borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>{lbl}</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ margin: '0 16px 80px', background: '#fff', borderRadius: '14px', boxShadow: '0 1px 4px rgba(0,0,0,.07)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#374151', borderBottom: '1px solid #f3f4f6' }}>
          {rows.length} รายการ{voidedCount > 0 ? ` (waive แล้ว ${voidedCount})` : ''}
        </div>
        {rows.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>ไม่มีรายการในช่วงนี้</div>
        ) : rows.map((r, i) => (
          <div key={`${r.source}-${r.id}`} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 16px',
            borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
            opacity: r.voided ? 0.5 : 1,
            background: r.voided ? '#fafafa' : '#fff',
          }}>
            <div style={{ flex: 1, minWidth: 0, textDecoration: r.voided ? 'line-through' : 'none' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.typeLabel} — {r.detail || '—'}
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>
                {fmtDate(r.date)} • {r.branch}
                {r.voided && r.voidReason ? ` • waive: ${r.voidReason}` : ''}
              </div>
            </div>
            <div style={{
              fontWeight: 800, fontSize: '14px', whiteSpace: 'nowrap',
              color: r.amount >= 0 ? '#16a34a' : '#dc2626',
              textDecoration: r.voided ? 'line-through' : 'none',
            }}>
              {r.amount >= 0 ? '+' : ''}{fmtMoney(r.amount)}
            </div>
            {r.waivable && (
              r.voided ? (
                <button onClick={() => restore(r)} disabled={busy === r.id} style={{
                  border: '1px solid #e5e7eb', background: '#fff', borderRadius: '8px',
                  padding: '4px 8px', fontSize: '11px', color: '#374151', cursor: 'pointer', flexShrink: 0,
                }}>คืน</button>
              ) : (
                <button onClick={() => waive(r)} disabled={busy === r.id} style={{
                  border: '1px solid #fecaca', background: '#fef2f2', borderRadius: '8px',
                  padding: '4px 8px', fontSize: '11px', color: '#dc2626', cursor: 'pointer', flexShrink: 0,
                }}>waive</button>
              )
            )}
          </div>
        ))}
      </div>

    </div>
  )
}
