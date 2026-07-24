'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

// ── date helpers ─────────────────────────────────────────────
export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric',
  })
}
export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}
export function hoursUntil(iso: string) {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 3_600_000)
}
export function bkkDateStr(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
}
export function isTodayBkk(iso: string) {
  return bkkDateStr(iso) === bkkDateStr(new Date().toISOString())
}

// จับคู่ชื่อสีไทย → hex สำหรับจุดสีในการ์ด
const BIKE_COLOR_HEX: Record<string, string> = {
  'ขาว': '#e5e7eb', 'ดำ': '#111827', 'แดง': '#dc2626', 'น้ำเงิน': '#1d4ed8',
  'ฟ้า': '#38bdf8', 'เขียว': '#16a34a', 'เหลือง': '#eab308', 'ส้ม': '#ea580c',
  'ชมพู': '#ec4899', 'เทา': '#6b7280', 'ม่วง': '#7c3aed', 'น้ำตาล': '#92400e',
  'ทอง': '#d4af37', 'เงิน': '#cbd5e1',
}
export function bikeColorHex(name?: string | null): string {
  if (!name) return '#9ca3af'
  for (const key in BIKE_COLOR_HEX) if (name.includes(key)) return BIKE_COLOR_HEX[key]
  return '#9ca3af'
}

export function JobCard({
  dotColor, title, badge, badgeBg, badgeColor,
  meta1, meta2, meta3, meta4, statusLabel, statusBg, statusColor,
  href, btnColor, btnLabel, contractHref, extendHref, swapHref, cardHref, onCancel, cancelDisabled,
  photoUrl, bikeColor, isLocked, onToggleLock, lockLoading,
}: {
  dotColor: string; title: string
  badge: string; badgeBg: string; badgeColor: string
  meta1: string; meta2?: string; meta3?: string; meta4?: string
  statusLabel?: string; statusBg?: string; statusColor?: string
  href: string; btnColor?: string; btnLabel?: string
  contractHref?: string
  extendHref?: string
  swapHref?: string
  cardHref?: string
  onCancel?: () => void
  cancelDisabled?: boolean
  photoUrl?: string | null
  bikeColor?: string | null
  isLocked?: boolean
  onToggleLock?: () => void
  lockLoading?: boolean
}) {
  const router = useRouter()
  const showThumb = photoUrl !== undefined || bikeColor !== undefined
  return (
    <div
      onClick={() => { if (cardHref) router.push(cardHref) }}
      style={{
        background: '#fff', borderRadius: '12px', marginBottom: '10px',
        boxShadow: '0 1px 3px rgba(0,0,0,.07)', overflow: 'hidden', display: 'flex',
        cursor: cardHref ? 'pointer' : 'default',
      }}
    >
      <div style={{ width: '5px', background: dotColor, flexShrink: 0 }} />
      {showThumb && (
        <div style={{ width: '58px', flexShrink: 0, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {photoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={photoUrl} alt="" loading="lazy" width={44} height={44} style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '8px' }} />
            : <span style={{ fontSize: '26px' }}>🛵</span>}
        </div>
      )}
      <div style={{ flex: 1, padding: '12px 12px 10px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
          <span style={{ fontWeight: 700, fontSize: '14px', color: '#111827', flex: 1 }}>{title}</span>
          <span style={{
            fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px',
            background: badgeBg, color: badgeColor, whiteSpace: 'nowrap', flexShrink: 0,
          }}>{badge}</span>
        </div>
        {bikeColor && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: bikeColorHex(bikeColor), border: '1px solid rgba(0,0,0,.15)', flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: '#374151', fontWeight: 600 }}>{bikeColor}</span>
          </div>
        )}
        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '3px' }}>{meta1}</div>
        {meta2 && <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: meta3 ? '3px' : '8px' }}>{meta2}</div>}
        {meta3 && (
          <div style={{ fontSize: '12px', color: '#0369a1', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '4px 8px', marginBottom: '8px', display: 'inline-block' }}>
            {meta3}
          </div>
        )}
        {meta4 && (
          <div style={{ fontSize: '12px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '4px 8px', marginBottom: '8px', display: 'block' }}>
            {meta4}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: statusLabel ? 'space-between' : 'flex-start', marginTop: '8px' }}>
          {statusLabel && (
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
              background: statusBg, color: statusColor,
            }}>{statusLabel}</span>
          )}
          <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
            {onCancel && (
              <button onClick={onCancel} disabled={cancelDisabled} style={{
                fontSize: '12px', fontWeight: 700, padding: '6px 10px', borderRadius: '8px',
                background: cancelDisabled ? '#f9fafb' : '#fef2f2',
                color: cancelDisabled ? '#9ca3af' : '#dc2626',
                border: `1px solid ${cancelDisabled ? '#e5e7eb' : '#fecaca'}`,
                cursor: cancelDisabled ? 'not-allowed' : 'pointer',
              }}>
                {cancelDisabled ? '⏳' : '🚫 ยกเลิก'}
              </button>
            )}
            {contractHref && (
              <Link href={contractHref} style={{
                fontSize: '12px', fontWeight: 700, padding: '6px 10px', borderRadius: '8px',
                background: '#f3f4f6', color: '#374151', textDecoration: 'none',
              }}>
                📄 สัญญา
              </Link>
            )}
            {extendHref && (
              <Link href={extendHref} style={{
                fontSize: '12px', fontWeight: 700, padding: '6px 10px', borderRadius: '8px',
                background: '#fffbeb', color: '#d97706', textDecoration: 'none',
                border: '1px solid #fde68a',
              }}>
                ⏱ ต่อเวลา
              </Link>
            )}
            {swapHref && (
              <Link href={swapHref} style={{
                fontSize: '12px', fontWeight: 700, padding: '6px 10px', borderRadius: '8px',
                background: '#faf5ff', color: '#7c3aed', textDecoration: 'none',
                border: '1px solid #ddd6fe',
              }}>
                🔄 สลับรถ
              </Link>
            )}
            {onToggleLock && (
              <button onClick={onToggleLock} disabled={lockLoading} style={{
                fontSize: '12px', fontWeight: 700, padding: '6px 10px', borderRadius: '8px',
                background: isLocked ? '#fef2f2' : '#f3f4f6',
                color: isLocked ? '#dc2626' : '#374151',
                border: `1px solid ${isLocked ? '#fecaca' : '#e5e7eb'}`,
                cursor: lockLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}>
                {lockLoading ? '⏳' : isLocked ? '🔒 ล็อคอยู่' : '🔓 ล็อครถ'}
              </button>
            )}
            <Link href={href} style={{
              fontSize: '12px', fontWeight: 700, padding: '6px 14px', borderRadius: '8px',
              background: btnColor ?? '#111827', color: '#fff', textDecoration: 'none',
            }}>
              {btnLabel ?? 'เปิด →'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
