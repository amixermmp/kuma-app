'use client'

import { useRouter } from 'next/navigation'

type Props = {
  branches: { id: string; name: string }[]
  current: string
  basePath: string
  extraParams?: Record<string, string | undefined>
  theme?: 'light' | 'dark'
  includeAll?: boolean
}

// Branch-scope chip selector ใช้ร่วมกันทุกหน้าฝั่งโอนเนอ — กด chip แล้ว navigate ไป basePath พร้อม query param ?branch=
// theme 'dark' สำหรับหน้าพื้นหลังเข้ม (dashboard/overview), 'light' สำหรับหน้าการ์ดขาว (ที่เหลือ)
// includeAll=false สำหรับหน้าที่เป็นฟอร์มแก้ไข ไม่ใช่รายงาน (เช่น bikes/pricing) — ต้องเลือกสาขาใดสาขาหนึ่งเสมอ ไม่มีตัวเลือก "ทุกสาขา"
export function BranchFilter({ branches, current, basePath, extraParams, theme = 'light', includeAll = true }: Props) {
  const router = useRouter()

  const setBranch = (b: string) => {
    const params = new URLSearchParams()
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        if (v) params.set(k, v)
      }
    }
    if (b) params.set('branch', b)
    router.push(`${basePath}?${params}`)
  }

  const options = includeAll ? [{ id: '', name: 'ทุกสาขา' }, ...branches] : branches
  const selectedBg = theme === 'dark' ? '#f1f5f9' : '#111827'
  const selectedColor = theme === 'dark' ? '#0f172a' : '#fff'
  const unselectedBg = theme === 'dark' ? 'transparent' : '#fff'
  const unselectedColor = theme === 'dark' ? '#94a3b8' : '#6b7280'
  const unselectedBorder = theme === 'dark' ? '#334155' : '#e5e7eb'

  return (
    <div style={{ display: 'flex', gap: '6px', padding: '12px 16px 0', flexWrap: 'wrap' }}>
      {options.map(b => (
        <button key={b.id} onClick={() => setBranch(b.id)} style={{
          padding: '6px 14px', borderRadius: '20px', border: '1.5px solid',
          fontSize: '13px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
          background: current === b.id ? selectedBg : unselectedBg,
          color: current === b.id ? selectedColor : unselectedColor,
          borderColor: current === b.id ? selectedBg : unselectedBorder,
        }}>
          {b.name}
        </button>
      ))}
    </div>
  )
}
