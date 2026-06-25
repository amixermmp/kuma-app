'use client'

export function PeriodSelector({ current }: { current: string }) {
  return (
    <select
      value={current}
      onChange={e => { window.location.href = `/owner/dashboard?period=${e.target.value}` }}
      style={{
        background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff',
        borderRadius: '8px', padding: '6px 10px', fontSize: '13px', fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      <option value="month" style={{ color: '#111' }}>เดือนนี้</option>
      <option value="week"  style={{ color: '#111' }}>สัปดาห์นี้</option>
      <option value="today" style={{ color: '#111' }}>วันนี้</option>
    </select>
  )
}
