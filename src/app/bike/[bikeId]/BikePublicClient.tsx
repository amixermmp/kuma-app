'use client'

import { useState } from 'react'

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
}

type DocRecord = { doc_type: string; doc_photo_url: string | null; expiry_date: string | null }

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

function ViewOnlyImage({ url, label }: { url: string; label: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        style={{
          position: 'relative', borderRadius: '10px', overflow: 'hidden',
          cursor: 'pointer', background: '#f1f5f9', minHeight: '100px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url} alt={label}
          style={{ width: '100%', display: 'block', userSelect: 'none', pointerEvents: 'none' }}
          draggable={false}
        />
        {/* Block right-click/drag overlay */}
        <div
          style={{ position: 'absolute', inset: 0, zIndex: 1 }}
          onContextMenu={e => e.preventDefault()}
        />
        <div style={{
          position: 'absolute', bottom: '8px', right: '8px', zIndex: 2,
          background: 'rgba(0,0,0,0.5)', color: '#fff', borderRadius: '6px',
          padding: '3px 8px', fontSize: '11px',
        }}>
          แตะเพื่อขยาย
        </div>
      </div>

      {/* Full-screen viewer */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: '12px',
          }}
          onContextMenu={e => e.preventDefault()}
        >
          <div style={{ color: '#fff', fontSize: '13px', opacity: 0.7 }}>แตะที่ใดก็ได้เพื่อปิด</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url} alt={label}
            style={{
              maxWidth: '95vw', maxHeight: '80vh', objectFit: 'contain',
              userSelect: 'none', pointerEvents: 'none', borderRadius: '8px',
            }}
            draggable={false}
          />
          <div style={{ color: '#fff', fontSize: '13px', fontWeight: 500 }}>{label}</div>
        </div>
      )}
    </>
  )
}

function DocCard({
  icon, title, doc,
}: {
  icon: string
  title: string
  doc: DocRecord | undefined
}) {
  const hasPhoto = !!doc?.doc_photo_url
  const expiry = doc?.expiry_date

  const expiryDays = expiry
    ? Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000)
    : null

  const expiryColor = expiryDays == null ? '#9ca3af'
    : expiryDays < 0 ? '#dc2626'
    : expiryDays <= 30 ? '#d97706'
    : '#16a34a'

  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '14px',
      border: '1px solid #e5e7eb', marginBottom: '10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{ fontSize: '20px' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>{title}</span>
      </div>

      {expiry && (
        <div style={{
          fontSize: '12px', color: expiryColor, fontWeight: 600,
          marginBottom: '10px',
          background: `${expiryColor}18`, borderRadius: '6px', padding: '4px 10px',
          display: 'inline-block',
        }}>
          {expiryDays != null && expiryDays < 0
            ? `⚠️ หมดอายุแล้ว`
            : `มีผลถึง ${new Date(expiry).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`
          }
        </div>
      )}

      {hasPhoto ? (
        <ViewOnlyImage url={doc!.doc_photo_url!} label={title} />
      ) : (
        <div style={{
          background: '#f8fafc', borderRadius: '10px', padding: '20px',
          textAlign: 'center', color: '#9ca3af', fontSize: '13px',
          border: '1px dashed #e2e8f0',
        }}>
          ยังไม่มีรูปเอกสาร
        </div>
      )}
    </div>
  )
}

export default function BikePublicClient({
  bike, docMap,
}: {
  bike: Bike
  docMap: Record<string, DocRecord>
}) {
  const statusColor = STATUS_COLOR[bike.status] ?? '#6b7280'
  const statusLabel = STATUS_LABEL[bike.status] ?? bike.status

  return (
    <div style={{ maxWidth: '440px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh', paddingBottom: '40px' }}>

      {/* Header */}
      <div style={{ background: '#1e293b', padding: '20px 16px 16px' }}>
        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px', letterSpacing: '1px' }}>
          KUMA — ระบบเช่ามอเตอร์ไซค์
        </div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', letterSpacing: '1px' }}>
          {bike.license_plate}
        </div>
        <div style={{ fontSize: '14px', color: '#cbd5e1', marginTop: '2px' }}>
          {bike.brand} {bike.model}{bike.year ? ` (${bike.year})` : ''}
          {bike.color ? ` • ${bike.color}` : ''}
        </div>
        <div style={{
          display: 'inline-block', marginTop: '10px',
          background: `${statusColor}22`, color: statusColor,
          border: `1px solid ${statusColor}55`,
          borderRadius: '20px', padding: '3px 12px', fontSize: '12px', fontWeight: 700,
        }}>
          {statusLabel}
        </div>
      </div>

      {/* รูปรถ */}
      {bike.photo_url && (
        <div style={{ position: 'relative', background: '#fff' }} onContextMenu={e => e.preventDefault()}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bike.photo_url} alt={`${bike.brand} ${bike.model}`}
            style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', display: 'block', userSelect: 'none', pointerEvents: 'none' }}
            draggable={false}
          />
          <div style={{ position: 'absolute', inset: 0 }} onContextMenu={e => e.preventDefault()} />
        </div>
      )}

      <div style={{ padding: '16px 14px 0' }}>

        {/* ราคา */}
        <div style={{
          background: '#fff', borderRadius: '12px', padding: '14px',
          border: '1px solid #e5e7eb', marginBottom: '12px',
        }}>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px', fontWeight: 600 }}>
            💰 ราคาเช่า
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '10px 12px' }}>
              <div style={{ fontSize: '11px', color: '#16a34a' }}>รายวัน</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#15803d' }}>
                ฿{Number(bike.daily_rate).toLocaleString()}
              </div>
            </div>
            {bike.monthly_rate && (
              <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', color: '#2563eb' }}>รายเดือน</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#1d4ed8' }}>
                  ฿{Number(bike.monthly_rate).toLocaleString()}
                </div>
              </div>
            )}
          </div>
          {bike.deposit_amount > 0 && (
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '10px' }}>
              💳 ค่ามัดจำ ฿{Number(bike.deposit_amount).toLocaleString()}
            </div>
          )}
        </div>

        {/* เอกสารรถ */}
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', margin: '16px 0 8px' }}>
          เอกสารรถ
        </div>
        <DocCard icon="📗" title="หน้าเล่มรถ" doc={docMap['registration']} />
        <DocCard icon="💰" title="ป้ายภาษีประจำปี" doc={docMap['tax']} />
        <DocCard icon="🛡️" title="พ.ร.บ. ประกันภัย" doc={docMap['pob']} />

      </div>

      <div style={{ textAlign: 'center', padding: '20px 0 0', fontSize: '11px', color: '#9ca3af' }}>
        Kuma — ระบบบริหารจัดการร้านเช่ามอเตอร์ไซค์
      </div>

    </div>
  )
}
