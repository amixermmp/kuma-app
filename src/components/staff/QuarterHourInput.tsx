'use client'

// เลือกนาทีได้แค่ 00/15/30/45 — เลื่อนหาทีละนาทีเสียเวลา (ใช้ pattern เดียวกับหน้าส่งรถ)
export default function QuarterHourInput({ value, onChange, min }: {
  value: string
  onChange: (value: string) => void
  min?: string
}) {
  const [datePart, timePart] = value.split('T')
  const [hourPart, minutePart] = (timePart ?? '08:00').split(':')

  const combine = (d: string, h: string, m: string) => `${d}T${h}:${m}`

  return (
    <div>
      <input className="field-input" type="date" style={{ marginBottom: '8px' }}
        value={datePart ?? ''} min={min?.split('T')[0]}
        onChange={e => onChange(combine(e.target.value, hourPart ?? '08', minutePart ?? '00'))} />
      <div style={{ display: 'flex', gap: '8px' }}>
        <select className="field-input" style={{ flex: 1 }}
          value={hourPart ?? '08'}
          onChange={e => onChange(combine(datePart ?? '', e.target.value, minutePart ?? '00'))}
        >
          {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map(h => (
            <option key={h} value={h}>{h} น.</option>
          ))}
        </select>
        <select className="field-input" style={{ flex: 1 }}
          value={minutePart ?? '00'}
          onChange={e => onChange(combine(datePart ?? '', hourPart ?? '08', e.target.value))}
        >
          {['00', '15', '30', '45'].map(m => (
            <option key={m} value={m}>{m} นาที</option>
          ))}
        </select>
      </div>
    </div>
  )
}
