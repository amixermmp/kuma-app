type Slice = { label: string; value: number; color: string }

export function Donut({ data, size = 120, thickness = 16 }: { data: Slice[]; size?: number; thickness?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  let cumulative = 0

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {total === 0 ? (
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#334155" strokeWidth={thickness} />
        ) : data.filter(d => d.value > 0).map((d, i) => {
          const frac = d.value / total
          const dash = frac * circumference
          const offset = -cumulative * circumference
          cumulative += frac
          return (
            <circle
              key={i} cx={size / 2} cy={size / 2} r={radius} fill="none"
              stroke={d.color} strokeWidth={thickness}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={offset}
            />
          )
        })}
      </g>
    </svg>
  )
}

export function DonutLegend({ data, fmtValue }: { data: Slice[]; fmtValue: (n: number) => string }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {data.map((d, i) => {
        const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: d.color, flexShrink: 0 }} />
            <div style={{ fontSize: '12px', color: '#cbd5e1', flex: 1 }}>{d.label}</div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9' }}>{fmtValue(d.value)}</div>
            <div style={{ fontSize: '11px', color: '#64748b', width: '32px', textAlign: 'right' }}>{pct}%</div>
          </div>
        )
      })}
    </div>
  )
}
