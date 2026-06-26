'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
  odometer: number
  notes: string | null
  status: string
  branch_id: string
  branch_name: string
}

type DocRecord = { doc_type: string; doc_photo_url: string | null; expiry_date: string | null }
type Branch = { id: string; name: string }
type Stats = { totalRevenue: number; rentalCount: number; lastRental: string | null }

const STATUS_LABEL: Record<string, string> = {
  available: '🟢 ว่าง',
  rented: '🔵 กำลังถูกเช่า',
  repair: '🔧 ซ่อม',
  maintenance: '🔧 ซ่อม',
  inactive: '⚫ เลิกใช้งาน',
}
const STATUS_COLOR: Record<string, string> = {
  available: '#16a34a',
  rented: '#2563eb',
  repair: '#dc2626',
  maintenance: '#dc2626',
  inactive: '#6b7280',
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

function DocStatusRow({ icon, name, expiry, hasPhoto }: { icon: string; name: string; expiry?: string | null; hasPhoto: boolean }) {
  const days = daysUntil(expiry)
  const badge = !hasPhoto
    ? { bg: '#f3f4f6', color: '#9ca3af', label: '— ไม่มี' }
    : days == null
      ? { bg: '#dcfce7', color: '#16a34a', label: '✅ มีแล้ว' }
      : days < 0
        ? { bg: '#fee2e2', color: '#dc2626', label: `🚨 หมดแล้ว` }
        : days <= 30
          ? { bg: '#fef9c3', color: '#ca8a04', label: `⚠️ ${days} วัน` }
          : { bg: '#dcfce7', color: '#16a34a', label: `✅ ปกติ` }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: '22px', minWidth: '28px' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{name}</div>
        {expiry && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>หมดอายุ {new Date(expiry).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
      </div>
      <span style={{ background: badge.bg, color: badge.color, fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px', whiteSpace: 'nowrap' }}>{badge.label}</span>
    </div>
  )
}

export default function BikeDetailClient({ bike, docMap, branches, stats, activeRentalId, activeMonthlyId }: {
  bike: Bike
  docMap: Record<string, DocRecord>
  branches: Branch[]
  stats: Stats
  activeRentalId: string | null
  activeMonthlyId: string | null
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Edit state
  const [brand, setBrand] = useState(bike.brand)
  const [model, setModel] = useState(bike.model)
  const [year, setYear] = useState(String(bike.year ?? ''))
  const [color, setColor] = useState(bike.color ?? '')
  const [dailyRate, setDailyRate] = useState(String(bike.daily_rate))
  const [monthlyRate, setMonthlyRate] = useState(String(bike.monthly_rate ?? ''))
  const [deposit, setDeposit] = useState(String(bike.deposit_amount))
  const [odometer, setOdometer] = useState(String(bike.odometer))
  const [notes, setNotes] = useState(bike.notes ?? '')
  const [licensePlate, setLicensePlate] = useState(bike.license_plate)

  // Branch transfer
  const [branchId, setBranchId] = useState(bike.branch_id)
  const [branchSaving, setBranchSaving] = useState(false)
  const [branchMsg, setBranchMsg] = useState('')

  // Deactivate
  const [showDeactivate, setShowDeactivate] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  const statusColor = STATUS_COLOR[bike.status] ?? '#6b7280'
  const statusLabel = STATUS_LABEL[bike.status] ?? bike.status

  const saveEdit = async () => {
    setSaving(true); setSaveMsg('')
    const res = await fetch(`/api/owner/bikes/${bike.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_plate: licensePlate.trim(),
        brand: brand.trim(),
        model: model.trim(),
        year: year ? parseInt(year) : null,
        color: color.trim() || null,
        daily_rate: parseFloat(dailyRate) || 0,
        monthly_rate: monthlyRate ? parseFloat(monthlyRate) : null,
        deposit_amount: parseFloat(deposit) || 0,
        odometer: parseInt(odometer) || 0,
        notes: notes.trim() || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setSaveMsg('✅ บันทึกแล้ว')
      setEditing(false)
      router.refresh()
    } else {
      const d = await res.json()
      setSaveMsg('❌ ' + (d.error ?? 'เกิดข้อผิดพลาด'))
    }
    setTimeout(() => setSaveMsg(''), 3000)
  }

  const saveBranch = async () => {
    if (branchId === bike.branch_id) return
    setBranchSaving(true)
    const res = await fetch(`/api/owner/bikes/${bike.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_id: branchId }),
    })
    setBranchSaving(false)
    setBranchMsg(res.ok ? '✅ ย้ายสาขาแล้ว' : '❌ เกิดข้อผิดพลาด')
    if (res.ok) router.refresh()
    setTimeout(() => setBranchMsg(''), 3000)
  }

  const deactivate = async () => {
    setDeactivating(true)
    await fetch(`/api/owner/bikes/${bike.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'inactive' }),
    })
    setDeactivating(false)
    router.push('/owner/bikes')
  }

  return (
    <div style={{ paddingBottom: '80px' }}>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(160deg,#0f172a,#1e3a8a)', position: 'relative' }}>
        {bike.photo_url ? (
          <img src={bike.photo_url} alt={bike.brand} style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px', color: 'rgba(255,255,255,.3)' }}>🛵</div>
        )}
        <div style={{ padding: '16px', color: '#fff' }}>
          <div style={{ fontSize: '24px', fontWeight: 900 }}>{bike.license_plate}</div>
          <div style={{ fontSize: '14px', opacity: .8, marginTop: '2px' }}>
            {bike.brand} {bike.model}{bike.year ? ` • ปี ${bike.year}` : ''}{bike.color ? ` • ${bike.color}` : ''}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <span style={{ background: `${statusColor}33`, color: statusColor === '#16a34a' ? '#86efac' : statusColor === '#2563eb' ? '#93c5fd' : '#fca5a5', border: `1px solid ${statusColor}55`, borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
              {statusLabel}
            </span>
            <span style={{ background: 'rgba(255,255,255,.15)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 600 }}>
              🏢 {bike.branch_name}
            </span>
            <span style={{ background: 'rgba(255,255,255,.15)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 600 }}>
              ฿{bike.daily_rate.toLocaleString()}/วัน
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 0 8px' }}>

        {/* ── เมนูการดำเนินการ ── */}
        <div className="card" style={{ borderTop: '3px solid #4f46e5' }}>
          <div className="card-title" style={{ color: '#4f46e5' }}>⚡ การดำเนินการ</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>

            {/* ส่งรถ — เฉพาะรถว่าง */}
            {bike.status === 'available' ? (
              <Link href={`/owner/bikes/${bike.id}/send`} style={{ textDecoration: 'none' }}>
                <div style={{ background: '#eff6ff', borderRadius: '12px', padding: '14px 12px', textAlign: 'center', border: '1.5px solid #bfdbfe' }}>
                  <div style={{ fontSize: '28px', marginBottom: '4px' }}>🛵</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1d4ed8' }}>ส่งรถ</div>
                  <div style={{ fontSize: '10px', color: '#60a5fa', marginTop: '2px' }}>สร้างการเช่าใหม่</div>
                </div>
              </Link>
            ) : (
              <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '14px 12px', textAlign: 'center', border: '1.5px solid #e5e7eb', opacity: 0.5 }}>
                <div style={{ fontSize: '28px', marginBottom: '4px' }}>🛵</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#9ca3af' }}>ส่งรถ</div>
                <div style={{ fontSize: '10px', color: '#d1d5db', marginTop: '2px' }}>รถไม่ว่าง</div>
              </div>
            )}

            {/* รับรถคืน — เฉพาะรถที่เช่าอยู่ */}
            {(activeRentalId || activeMonthlyId) ? (
              <Link href="/owner/rentals" style={{ textDecoration: 'none' }}>
                <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '14px 12px', textAlign: 'center', border: '1.5px solid #bbf7d0' }}>
                  <div style={{ fontSize: '28px', marginBottom: '4px' }}>⬅️</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#15803d' }}>รับรถคืน</div>
                  <div style={{ fontSize: '10px', color: '#4ade80', marginTop: '2px' }}>ไปหน้าประวัติการเช่า</div>
                </div>
              </Link>
            ) : (
              <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '14px 12px', textAlign: 'center', border: '1.5px solid #e5e7eb', opacity: 0.5 }}>
                <div style={{ fontSize: '28px', marginBottom: '4px' }}>⬅️</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#9ca3af' }}>รับรถคืน</div>
                <div style={{ fontSize: '10px', color: '#d1d5db', marginTop: '2px' }}>ไม่มีการเช่าอยู่</div>
              </div>
            )}

            {/* ทำงานรูทีน */}
            <a href="#docs" style={{ textDecoration: 'none' }}>
              <div style={{ background: '#fffbeb', borderRadius: '12px', padding: '14px 12px', textAlign: 'center', border: '1.5px solid #fde68a' }}>
                <div style={{ fontSize: '28px', marginBottom: '4px' }}>🔧</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#b45309' }}>ทำงานรูทีน</div>
                <div style={{ fontSize: '10px', color: '#fbbf24', marginTop: '2px' }}>ดูสถานะซ่อมบำรุง</div>
              </div>
            </a>

            {/* งานเอกสาร */}
            <a href="#docs" style={{ textDecoration: 'none' }}>
              <div style={{ background: '#f5f3ff', borderRadius: '12px', padding: '14px 12px', textAlign: 'center', border: '1.5px solid #ddd6fe' }}>
                <div style={{ fontSize: '28px', marginBottom: '4px' }}>📄</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#6d28d9' }}>งานเอกสาร</div>
                <div style={{ fontSize: '10px', color: '#a78bfa', marginTop: '2px' }}>เช็คเอกสารรถ</div>
              </div>
            </a>

          </div>
        </div>

        {/* ── ข้อมูลรถ ── */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div className="card-title" style={{ margin: 0 }}>ข้อมูลรถ</div>
            {!editing ? (
              <button onClick={() => setEditing(true)} style={{ background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                ✏️ แก้ไข
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {saveMsg && <span style={{ fontSize: '12px', color: saveMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{saveMsg}</span>}
                <button onClick={() => setEditing(false)} style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer' }}>ยกเลิก</button>
                <button onClick={saveEdit} disabled={saving} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: saving ? .7 : 1 }}>
                  {saving ? '⏳' : '💾 บันทึก'}
                </button>
              </div>
            )}
          </div>

          {editing ? (
            <div>
              {[
                { label: 'ทะเบียน *', val: licensePlate, set: setLicensePlate },
                { label: 'ยี่ห้อ *', val: brand, set: setBrand },
                { label: 'รุ่น *', val: model, set: setModel },
                { label: 'ปีรถ', val: year, set: setYear, type: 'number' },
                { label: 'สี', val: color, set: setColor },
                { label: 'ราคาเช่า/วัน (บาท) *', val: dailyRate, set: setDailyRate, type: 'number' },
                { label: 'ราคาเช่า/เดือน (บาท)', val: monthlyRate, set: setMonthlyRate, type: 'number' },
                { label: 'ค่ามัดจำ (บาท)', val: deposit, set: setDeposit, type: 'number' },
                { label: 'เลขไมล์ปัจจุบัน (กม.)', val: odometer, set: setOdometer, type: 'number' },
              ].map(({ label, val, set, type }) => (
                <div key={label} className="field-row">
                  <label className="field-label">{label}</label>
                  <input className="field-input" type={type ?? 'text'} value={val} onChange={e => set(e.target.value)} />
                </div>
              ))}
              <div className="field-row" style={{ marginBottom: 0 }}>
                <label className="field-label">หมายเหตุ</label>
                <textarea className="field-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'none' }} />
              </div>
            </div>
          ) : (
            <div>
              {[
                ['ทะเบียน', bike.license_plate],
                ['ยี่ห้อ/รุ่น', `${bike.brand} ${bike.model}`],
                bike.year ? ['ปีรถ', String(bike.year)] : null,
                bike.color ? ['สี', bike.color] : null,
                ['เลขไมล์', `${Number(bike.odometer).toLocaleString()} กม.`],
                ['ราคาเช่า/วัน', `฿${Number(bike.daily_rate).toLocaleString()}`],
                bike.monthly_rate ? ['ราคาเช่า/เดือน', `฿${Number(bike.monthly_rate).toLocaleString()}`] : null,
                ['ค่ามัดจำ', `฿${Number(bike.deposit_amount).toLocaleString()}`],
                bike.notes ? ['หมายเหตุ', bike.notes] : null,
              ].filter((r): r is [string, string] => r !== null).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>{k}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: k.startsWith('ราคา') ? '#2563eb' : '#1e293b' }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── ย้ายสาขา ── */}
        <div className="card" style={{ borderTop: '3px solid #0891b2' }}>
          <div className="card-title" style={{ color: '#0891b2' }}>🏢 สาขา</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>สาขาปัจจุบัน</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0891b2' }}>{bike.branch_name}</span>
          </div>
          <label className="field-label">ย้ายไปสาขา</label>
          <select className="field-input" value={branchId} onChange={e => setBranchId(e.target.value)} style={{ marginBottom: '12px' }}>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}{b.id === bike.branch_id ? ' (ปัจจุบัน)' : ''}</option>
            ))}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={saveBranch} disabled={branchSaving || branchId === bike.branch_id} style={{
              background: branchId !== bike.branch_id ? '#0891b2' : '#e5e7eb',
              color: branchId !== bike.branch_id ? '#fff' : '#9ca3af',
              border: 'none', borderRadius: '8px', padding: '10px 18px',
              fontSize: '13px', fontWeight: 700, cursor: branchId !== bike.branch_id ? 'pointer' : 'default',
            }}>
              {branchSaving ? '⏳' : '🔄 ยืนยันย้ายสาขา'}
            </button>
            {branchMsg && <span style={{ fontSize: '12px', color: branchMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{branchMsg}</span>}
          </div>
        </div>

        {/* ── สถานะเอกสาร ── */}
        <div className="card" id="docs">
          <div className="card-title">📄 สถานะเอกสาร</div>
          <DocStatusRow icon="🛡️" name="พ.ร.บ. รถจักรยานยนต์" expiry={docMap['pob']?.expiry_date} hasPhoto={!!docMap['pob']?.doc_photo_url} />
          <DocStatusRow icon="💰" name="ภาษีประจำปี" expiry={docMap['tax']?.expiry_date} hasPhoto={!!docMap['tax']?.doc_photo_url} />
          <DocStatusRow icon="📘" name="สำเนาหน้าเล่มทะเบียน" hasPhoto={!!docMap['registration']?.doc_photo_url} />
        </div>

        {/* ── สถิติ ── */}
        <div className="card">
          <div className="card-title">📊 สถิติการใช้งาน</div>
          {[
            ['รายได้รวมทั้งหมด', `฿${stats.totalRevenue.toLocaleString()}`, '#16a34a'],
            ['จำนวนครั้งที่เช่า', `${stats.rentalCount} ครั้ง`, '#1e293b'],
            ['เช่าครั้งล่าสุด', stats.lastRental ? new Date(stats.lastRental).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—', '#1e293b'],
          ].map(([k, v, c]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>{k}</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: c }}>{v}</span>
            </div>
          ))}
        </div>

        {/* ── QR Code ── */}
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="card-title" style={{ textAlign: 'left' }}>🔲 QR Code รถ</div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px', textAlign: 'left' }}>
            สแกนเพื่อเข้าหน้าข้อมูลรถ — กดค้างที่รูปเพื่อบันทึก
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(`https://kuma-app.vercel.app/bike/${bike.id}`)}`}
            alt="QR Code"
            style={{ width: '220px', height: '220px', borderRadius: '12px', border: '1px solid #e5e7eb' }}
          />
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '10px', wordBreak: 'break-all' }}>
            kuma-app.vercel.app/bike/{bike.id.slice(0, 8)}...
          </div>
          <a
            href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=20&data=${encodeURIComponent(`https://kuma-app.vercel.app/bike/${bike.id}`)}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-block', marginTop: '14px',
              background: '#1e40af', color: '#fff', textDecoration: 'none',
              borderRadius: '10px', padding: '10px 24px', fontSize: '14px', fontWeight: 700,
            }}
          >
            ⬇️ เปิดรูป QR ขนาดใหญ่
          </a>
        </div>

        {/* ── Danger Zone ── */}
        {bike.status !== 'inactive' && (
          <div className="card" style={{ border: '1.5px solid #dc2626' }}>
            <div className="card-title" style={{ color: '#dc2626' }}>⚠️ Danger Zone</div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '14px' }}>
              การเลิกใช้งานรถจะซ่อนรถจากระบบการเช่า แต่ยังเก็บประวัติและรายได้ไว้ครบถ้วน
            </div>
            {!showDeactivate ? (
              <button onClick={() => setShowDeactivate(true)} style={{ background: '#fff', color: '#dc2626', border: '2px solid #dc2626', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                🚫 เลิกใช้งานรถคันนี้
              </button>
            ) : (
              <div style={{ background: '#fef2f2', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#dc2626', marginBottom: '8px' }}>ยืนยันการเลิกใช้งาน?</div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '14px' }}>รถ {bike.license_plate} จะถูกซ่อนออกจากระบบ</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setShowDeactivate(false)} style={{ flex: 1, padding: '10px', background: '#f3f4f6', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>ยกเลิก</button>
                  <button onClick={deactivate} disabled={deactivating} style={{ flex: 1, padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: deactivating ? .7 : 1 }}>
                    {deactivating ? '⏳' : '🚫 ยืนยัน'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
