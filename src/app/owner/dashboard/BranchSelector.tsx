'use client'

import { useRouter } from 'next/navigation'

type Props = {
  branches: { id: string; name: string }[]
  current: string
  period: string
  from?: string
  to?: string
}

export function BranchSelector({ branches, current, period, from, to }: Props) {
  const router = useRouter()

  const setBranch = (b: string) => {
    const params = new URLSearchParams()
    params.set('period', period)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (b) params.set('branch', b)
    router.push(`/owner/dashboard?${params}`)
  }

  return (
    <div style={{ display: 'flex', gap: '6px', padding: '12px 16px 0', flexWrap: 'wrap' }}>
      {[{ id: '', name: 'ทุกสาขา' }, ...branches].map(b => (
        <button key={b.id} onClick={() => setBranch(b.id)} style={{
          padding: '6px 14px', borderRadius: '20px', border: '1.5px solid',
          fontSize: '13px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
          background: current === b.id ? '#f1f5f9' : 'transparent',
          color: current === b.id ? '#0f172a' : '#94a3b8',
          borderColor: current === b.id ? '#f1f5f9' : '#334155',
        }}>
          {b.name}
        </button>
      ))}
    </div>
  )
}
