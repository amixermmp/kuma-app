'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Bike = {
  id: string
  license_plate: string
  brand: string
  model: string
  year: number | null
  color: string | null
  photo_url: string | null
  daily_rate: number
  monthly_rate: number | null
  deposit_amount: number
  status: string
  odometer: number
  notes: string | null
}

type DocRecord = { doc_type: string; doc_photo_url: string | null; expiry_date: string | null }

type BranchSettings = {
  terms_photo_url: string | null
  manual_photo_url: string | null
  contact_line: string | null
  contact_phone: string | null
}

const STATUS_LABEL: Record<string, string> = {
  available: 'ว่าง — พร้อมเช่า',
  rented: 'กำลังถูกเช่า',
  repair: 'อยู่ระหว่างซ่อม',
  maintenance: 'อยู่ระหว่างซ่อม',
}
const STATUS_COLOR: Record<string, string> = {
  available: '#16a34a',
  rented: '#2563eb',
  repair: '#dc2626',
  maintenance: '#dc2626',
}

function FullscreenViewer({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      onContextMenu={e => e.preventDefault()}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.93)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '12px',
      }}
    >
      <div style={{ color: '#fff', fontSize: '13px', opacity: 0.6 }}>แตะที่ใดก็ได้เพื่อปิด</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url} alt={label}
        style={{ maxWidth: '95vw', maxHeight: '80vh', objectFit: 'contain', userSelect: 'none', pointerEvents: 'none', borderRadius: '8px' }}
        draggable={false}
      />
      <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>{label}</div>
    </div>
  )
}

function DocRow({
  icon, title, photoUrl, expiryDate, onView,
}: {
  icon: string
  title: string
  photoUrl?: string | null
  expiryDate?: string | null
  onView: () => void
}) {
  const hasPhoto = !!photoUrl
  const expiryDays = expiryDate
    ? Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86_400_000)
    : null
  const expiryColor = expiryDays == null ? '#9ca3af'
    : expiryDays < 0 ? '#dc2626'
    : expiryDays <= 30 ? '#d97706'
    : '#16a34a'

  return (
    <div
      onClick={hasPhoto ? onView : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '14px 0', borderBottom: '1px solid #f1f5f9',
        cursor: hasPhoto ? 'pointer' : 'default',
      }}
    >
      <span style={{ fontSize: '22px', minWidth: '28px' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>{title}</div>
        {expiryDate && (
          <div style={{ fontSize: '11px', color: expiryColor, marginTop: '2px' }}>
            {expiryDays != null && expiryDays < 0
              ? '⚠️ หมดอายุแล้ว'
              : `หมดอายุ ${new Date(expiryDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`
            }
          </div>
        )}
        {!hasPhoto && (
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>ยังไม่มีเอกสาร</div>
        )}
      </div>
      {hasPhoto && <span style={{ fontSize: '18px', color: '#94a3b8' }}>›</span>}
    </div>
  )
}

export default function BikePublicClient({
  bike, docMap, settings,
}: {
  bike: Bike
  docMap: Record<string, DocRecord>
  settings: BranchSettings | null
}) {
  const [tab, setTab] = useState<'info' | 'rental' | 'docs'>('info')
  const [viewDoc, setViewDoc] = useState<{ url: string; label: string } | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [pin, setPin] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const router = useRouter()

  const statusColor = STATUS_COLOR[bike.status] ?? '#6b7280'
  const statusLabel = STATUS_LABEL[bike.status] ?? bike.status

  async function handleLogin() {
    if (pin.length !== 6 || loginLoading) return
    setLoginLoading(true)
    setLoginError('')
    const res = await fetch('/api/staff/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    const data = await res.json()
    if (res.ok && data.success) {
      window.location.href = `/staff/bikes/${bike.id}/menu`
    } else {
      setLoginError(data.error ?? 'PIN ไม่ถูกต้อง')
      setPin('')
      setLoginLoading(false)
    }
  }

  const tabs = [
    { key: 'info', label: 'ข้อมูลรถ' },
    { key: 'rental', label: 'การเช่า' },
    { key: 'docs', label: 'เอกสาร' },
  ] as const

  return (
    <div style={{ maxWidth: '440px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh', paddingBottom: '60px' }}>

      {/* Hero */}
      <div style={{ background: '#1e293b' }}>
        <div style={{ padding: '20px 16px 0' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px', letterSpacing: '1px' }}>
            KUMA — ระบบเช่ามอเตอร์ไซค์
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', letterSpacing: '1px' }}>
                {bike.license_plate}
              </div>
              <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '2px' }}>
                {bike.brand} {bike.model}
                {bike.year ? ` (${bike.year})` : ''}
                {bike.color ? ` • ${bike.color}` : ''}
              </div>
            </div>
            <div style={{
              background: `${statusColor}22`, color: statusColor,
              border: `1px solid ${statusColor}55`,
              borderRadius: '20px', padding: '4px 12px',
              fontSize: '12px', fontWeight: 700,
              whiteSpace: 'nowrap', marginTop: '4px', flexShrink: 0,
            }}>
              {statusLabel}
            </div>
          </div>
        </div>

        {/* Bike photo */}
        {bike.photo_url ? (
          <div style={{ position: 'relative' }} onContextMenu={e => e.preventDefault()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bike.photo_url} alt={`${bike.brand} ${bike.model}`}
              style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', display: 'block', userSelect: 'none', pointerEvents: 'none' }}
              draggable={false}
            />
            <div style={{ position: 'absolute', inset: 0 }} onContextMenu={e => e.preventDefault()} />
          </div>
        ) : (
          <div style={{ height: '110px', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '52px' }}>
            🛵
          </div>
        )}

        {/* Tab bar */}
        <div style={{ display: 'flex' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '12px 4px', fontSize: '12px', fontWeight: tab === t.key ? 700 : 400,
                color: tab === t.key ? '#fff' : '#94a3b8',
                background: 'none', border: 'none',
                borderBottom: tab === t.key ? '2px solid #3b82f6' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: ข้อมูลรถ */}
      {tab === 'info' && (
        <div style={{ padding: '14px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            {(
              [
                ['ยี่ห้อ/รุ่น', `${bike.brand} ${bike.model}`],
                bike.year ? ['ปีรถ', String(bike.year)] : null,
                bike.color ? ['สี', bike.color] : null,
                ['เลขไมล์', `${Number(bike.odometer).toLocaleString()} กม.`],
                ['ราคาเช่า/วัน', `฿${Number(bike.daily_rate).toLocaleString()}`],
                bike.monthly_rate ? ['ราคาเช่า/เดือน', `฿${Number(bike.monthly_rate).toLocaleString()}`] : null,
                bike.deposit_amount ? ['ค่ามัดจำ', `฿${Number(bike.deposit_amount).toLocaleString()}`] : null,
                ['สถานะ', statusLabel],
              ] as ([string, string] | null)[]
            ).filter((r): r is [string, string] => r !== null).map(([key, val], i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
              }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>{key}</span>
                <span style={{
                  fontSize: '13px', fontWeight: 600,
                  color: key === 'ราคาเช่า/วัน' || key === 'ราคาเช่า/เดือน' ? '#2563eb' : '#1e293b',
                }}>
                  {val}
                </span>
              </div>
            ))}
          </div>

          {bike.notes && (
            <div style={{
              background: '#fffbeb', border: '1px solid #fde68a',
              borderRadius: '10px', padding: '12px 14px',
              marginTop: '10px', fontSize: '13px', color: '#92400e',
            }}>
              📝 {bike.notes}
            </div>
          )}
        </div>
      )}

      {/* Tab: การเช่า */}
      {tab === 'rental' && (
        <div style={{ padding: '14px' }}>
          <div style={{
            background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb',
            padding: '32px 16px', textAlign: 'center',
          }}>
            {bike.status === 'available' ? (
              <>
                <div style={{ fontSize: '44px' }}>🟢</div>
                <div style={{ fontWeight: 700, fontSize: '16px', marginTop: '10px', color: '#1e293b' }}>รถว่าง</div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>ไม่มีการเช่าที่ใช้งานอยู่</div>
              </>
            ) : bike.status === 'rented' ? (
              <>
                <div style={{ fontSize: '44px' }}>🔵</div>
                <div style={{ fontWeight: 700, fontSize: '16px', marginTop: '10px', color: '#1e293b' }}>กำลังถูกเช่า</div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>รถคันนี้ถูกเช่าอยู่ในขณะนี้</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '44px' }}>🔧</div>
                <div style={{ fontWeight: 700, fontSize: '16px', marginTop: '10px', color: '#1e293b' }}>อยู่ระหว่างซ่อม</div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>รถคันนี้ยังไม่พร้อมให้บริการ</div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab: เอกสาร */}
      {tab === 'docs' && (
        <div style={{ padding: '14px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '0 16px' }}>
            <DocRow
              icon="📗" title="หน้าเล่มรถ"
              photoUrl={docMap['registration']?.doc_photo_url}
              onView={() => setViewDoc({ url: docMap['registration'].doc_photo_url!, label: 'หน้าเล่มรถ' })}
            />
            <DocRow
              icon="💰" title="ป้ายภาษีประจำปี"
              photoUrl={docMap['tax']?.doc_photo_url}
              expiryDate={docMap['tax']?.expiry_date}
              onView={() => setViewDoc({ url: docMap['tax'].doc_photo_url!, label: 'ป้ายภาษีประจำปี' })}
            />
            <DocRow
              icon="🛡️" title="พ.ร.บ. ประกันภัย"
              photoUrl={docMap['pob']?.doc_photo_url}
              expiryDate={docMap['pob']?.expiry_date}
              onView={() => setViewDoc({ url: docMap['pob'].doc_photo_url!, label: 'พ.ร.บ. ประกันภัย' })}
            />
            {settings?.terms_photo_url && (
              <DocRow
                icon="📋" title="เงื่อนไขการใช้งาน"
                photoUrl={settings.terms_photo_url}
                onView={() => setViewDoc({ url: settings!.terms_photo_url!, label: 'เงื่อนไขการใช้งาน' })}
              />
            )}
            {settings?.manual_photo_url && (
              <DocRow
                icon="📖" title="คู่มือการใช้งาน"
                photoUrl={settings.manual_photo_url}
                onView={() => setViewDoc({ url: settings!.manual_photo_url!, label: 'คู่มือการใช้งาน' })}
              />
            )}
          </div>
        </div>
      )}

      {/* Staff Login */}
      <div style={{ padding: '4px 14px 0' }}>
        {!showLogin ? (
          <button
            onClick={() => setShowLogin(true)}
            style={{
              width: '100%', padding: '13px',
              background: 'none', border: '1px solid #e2e8f0',
              borderRadius: '10px', color: '#94a3b8',
              fontSize: '13px', cursor: 'pointer',
            }}
          >
            🔐 เข้าระบบพนักงาน
          </button>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b', marginBottom: '12px' }}>
              🔐 เข้าระบบพนักงาน
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="รหัส PIN 6 หลัก"
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setLoginError('') }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              autoFocus
              style={{
                width: '100%', padding: '12px',
                border: `1px solid ${loginError ? '#fca5a5' : '#e2e8f0'}`,
                borderRadius: '8px', fontSize: '20px',
                letterSpacing: '10px', textAlign: 'center',
                boxSizing: 'border-box', outline: 'none',
              }}
            />
            {loginError && (
              <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '6px', textAlign: 'center' }}>
                {loginError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button
                onClick={() => { setShowLogin(false); setPin(''); setLoginError('') }}
                style={{
                  flex: 1, padding: '11px', background: '#f1f5f9',
                  border: 'none', borderRadius: '8px',
                  fontSize: '13px', color: '#64748b', cursor: 'pointer',
                }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleLogin}
                disabled={pin.length !== 6 || loginLoading}
                style={{
                  flex: 2, padding: '11px',
                  background: pin.length === 6 && !loginLoading ? '#1d4ed8' : '#e2e8f0',
                  color: pin.length === 6 && !loginLoading ? '#fff' : '#9ca3af',
                  border: 'none', borderRadius: '8px',
                  fontSize: '14px', fontWeight: 600,
                  cursor: pin.length === 6 && !loginLoading ? 'pointer' : 'default',
                }}
              >
                {loginLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: '24px 0 0', fontSize: '11px', color: '#9ca3af' }}>
        Kuma — ระบบบริหารจัดการร้านเช่ามอเตอร์ไซค์
      </div>

      {/* Fullscreen doc viewer */}
      {viewDoc && (
        <FullscreenViewer url={viewDoc.url} label={viewDoc.label} onClose={() => setViewDoc(null)} />
      )}

    </div>
  )
}
