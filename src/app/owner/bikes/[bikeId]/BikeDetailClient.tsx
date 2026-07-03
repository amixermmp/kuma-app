'use client'

import { useState, useRef } from 'react'
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
  odometer: number
  notes: string | null
  status: string
  branch_id: string
  branch_name: string
}

type DocRecord = { doc_type: string; doc_photo_url: string | null; expiry_date: string | null }
type Branch = { id: string; name: string }
type Stats = { totalRevenue: number; rentalCount: number; lastRental: string | null }
type Routine = {
  id: string
  task_name: string
  interval_km: number | null
  interval_days: number | null
  last_done_date: string | null
  last_done_km: number | null
  next_due_km: number | null
  next_due_date: string | null
}

type RepairRecord = {
  id: string
  title: string
  description: string
  status: string
  created_at: string
  resolved_at: string | null
  repair_shop: string | null
  repair_cost: number | null
}

const STATUS_LABEL: Record<string, string> = {
  available: '🟢 ว่าง',
  rented: '🔵 กำลังถูกเช่า',
  repair: '🔧 ซ่อม',
  maintenance: '🔧 ซ่อม',
  inactive: '⚫ เลิกใช้งาน',
}
const STATUS_COLOR: Record<string, string> = {
  available: '#16a34a',
  rented: '#374151',
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
  // ถ้ามีวันหมดอายุ → แสดง expiry status เสมอ (ไม่สนว่ามีรูปไหม)
  // ถ้าไม่มีวันหมดอายุ → ดูจาก hasPhoto
  const badge = expiry
    ? days == null
      ? { bg: '#dcfce7', color: '#16a34a', label: '✅ ปกติ' }
      : days < 0
        ? { bg: '#fee2e2', color: '#dc2626', label: `🚨 หมดแล้ว` }
        : days <= 30
          ? { bg: '#fef9c3', color: '#ca8a04', label: `⚠️ ${days} วัน` }
          : { bg: '#dcfce7', color: '#16a34a', label: `✅ ปกติ` }
    : !hasPhoto
      ? { bg: '#f3f4f6', color: '#9ca3af', label: '— ไม่มี' }
      : { bg: '#dcfce7', color: '#16a34a', label: '✅ มีแล้ว' }

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

export default function BikeDetailClient({ bike, docMap, branches, stats, routines, repairs }: {
  bike: Bike
  docMap: Record<string, DocRecord>
  branches: Branch[]
  stats: Stats
  routines: Routine[]
  repairs: RepairRecord[]
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

  // Doc expiry editor
  const [editingDocs, setEditingDocs] = useState(false)
  const [pobExpiry, setPobExpiry] = useState(docMap['pob']?.expiry_date ?? '')
  const [taxExpiry, setTaxExpiry] = useState(docMap['tax']?.expiry_date ?? '')
  const [docSaving, setDocSaving] = useState(false)
  const [docMsg, setDocMsg] = useState('')

  const saveDocs = async () => {
    setDocSaving(true)
    setDocMsg('')
    const res = await fetch(`/api/owner/bikes/${bike.id}/docs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pob_expiry: pobExpiry || null, tax_expiry: taxExpiry || null }),
    })
    setDocSaving(false)
    if (res.ok) {
      setDocMsg('✅ บันทึกแล้ว')
      setEditingDocs(false)
      router.refresh()
    } else {
      const d = await res.json()
      setDocMsg('❌ ' + (d.error ?? 'เกิดข้อผิดพลาด'))
    }
    setTimeout(() => setDocMsg(''), 3000)
  }

  // Branch transfer
  const [branchId, setBranchId] = useState(bike.branch_id)
  const [transferRate, setTransferRate] = useState(String(bike.daily_rate))
  const [branchSaving, setBranchSaving] = useState(false)
  const [branchMsg, setBranchMsg] = useState('')

  // Routine editor
  const [routineList, setRoutineList] = useState<Routine[]>(routines)
  const [editingRoutine, setEditingRoutine] = useState<string | null>(null)
  const [routineForm, setRoutineForm] = useState<{ last_done_date: string; interval_days: string; interval_km: string }>({ last_done_date: '', interval_days: '', interval_km: '' })
  const [routineSaving, setRoutineSaving] = useState(false)
  const [routineMsg, setRoutineMsg] = useState('')

  const openRoutineEdit = (r: Routine) => {
    setEditingRoutine(r.id)
    setRoutineForm({
      last_done_date: r.last_done_date ?? '',
      interval_days: String(r.interval_days ?? ''),
      interval_km: String(r.interval_km ?? ''),
    })
    setRoutineMsg('')
  }

  const saveRoutine = async (r: Routine) => {
    setRoutineSaving(true)
    setRoutineMsg('')
    const res = await fetch(`/api/owner/bikes/${bike.id}/routine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_name: r.task_name,
        last_done_date: routineForm.last_done_date || null,
        interval_days: routineForm.interval_days ? parseInt(routineForm.interval_days) : null,
        interval_km: routineForm.interval_km ? parseInt(routineForm.interval_km) : null,
      }),
    })
    const data = await res.json()
    setRoutineSaving(false)
    if (res.ok) {
      setRoutineMsg('✅ บันทึกแล้ว')
      setEditingRoutine(null)
      // อัปเดต local state
      setRoutineList(prev => prev.map(x => x.id === r.id ? {
        ...x,
        last_done_date: routineForm.last_done_date || null,
        interval_days: routineForm.interval_days ? parseInt(routineForm.interval_days) : null,
        interval_km: routineForm.interval_km ? parseInt(routineForm.interval_km) : null,
        next_due_date: data.next_due_date ?? x.next_due_date,
      } : x))
      setTimeout(() => setRoutineMsg(''), 3000)
    } else {
      setRoutineMsg('❌ ' + (data.error ?? 'เกิดข้อผิดพลาด'))
    }
  }

  // Photo upload
  const [photoUrl, setPhotoUrl] = useState(bike.photo_url)
  const [photoUploading, setPhotoUploading] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoUpload = async (file: File) => {
    setPhotoUploading(true)
    try {
      const { compressImage } = await import('@/lib/compressImage')
      const compressed = await compressImage(file, 200)
      const fd = new FormData()
      fd.append('file', new File([compressed], 'photo.jpg', { type: 'image/jpeg' }))
      fd.append('folder', 'bikes')
      const uploadRes = await fetch('/api/staff/upload', { method: 'POST', body: fd })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadData.error)

      const saveRes = await fetch(`/api/owner/bikes/${bike.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_url: uploadData.url }),
      })
      if (!saveRes.ok) throw new Error('save failed')
      setPhotoUrl(uploadData.url)
    } catch (err) {
      console.error('Photo upload failed:', err)
    } finally {
      setPhotoUploading(false)
    }
  }

  // Delete
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

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
      body: JSON.stringify({ branch_id: branchId, daily_rate: parseFloat(transferRate) || bike.daily_rate }),
    })
    setBranchSaving(false)
    setBranchMsg(res.ok ? '✅ ย้ายสาขาแล้ว' : '❌ เกิดข้อผิดพลาด')
    if (res.ok) router.refresh()
    setTimeout(() => setBranchMsg(''), 3000)
  }

  const deleteBike = async () => {
    setDeleting(true)
    setDeleteError('')
    const res = await fetch(`/api/owner/bikes/${bike.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      router.push('/owner/bikes')
    } else {
      const d = await res.json()
      setDeleteError(d.error ?? 'เกิดข้อผิดพลาด')
    }
  }

  return (
    <div style={{ paddingBottom: '80px' }}>

      {/* Hero */}
      <div style={{ background: '#111827', position: 'relative' }}>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={bike.brand} style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px', color: 'rgba(255,255,255,.3)' }}>🛵</div>
        )}

        {/* Upload photo button */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }}
        />
        <button
          onClick={() => photoInputRef.current?.click()}
          disabled={photoUploading}
          style={{
            position: 'absolute', top: '10px', right: '10px',
            background: 'rgba(0,0,0,0.55)', color: '#fff',
            border: 'none', borderRadius: '20px',
            padding: '6px 12px', fontSize: '12px', fontWeight: 700,
            cursor: photoUploading ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '5px',
          }}
        >
          {photoUploading ? '⏳' : '📷'} {photoUploading ? 'กำลังอัปโหลด...' : photoUrl ? 'เปลี่ยนรูป' : 'เพิ่มรูป'}
        </button>
        <div style={{ padding: '16px', color: '#fff' }}>
          <div style={{ fontSize: '24px', fontWeight: 900 }}>{bike.license_plate}</div>
          <div style={{ fontSize: '14px', opacity: .8, marginTop: '2px' }}>
            {bike.brand} {bike.model}{bike.year ? ` • ปี ${bike.year}` : ''}{bike.color ? ` • ${bike.color}` : ''}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <span style={{ background: `${statusColor}33`, color: statusColor === '#16a34a' ? '#86efac' : statusColor === '#374151' ? '#d1d5db' : '#fca5a5', border: `1px solid ${statusColor}55`, borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
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

        {/* ── ข้อมูลรถ ── */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div className="card-title" style={{ margin: 0 }}>ข้อมูลรถ</div>
            {!editing ? (
              <button onClick={() => setEditing(true)} style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                ✏️ แก้ไข
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {saveMsg && <span style={{ fontSize: '12px', color: saveMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{saveMsg}</span>}
                <button onClick={() => setEditing(false)} style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer' }}>ยกเลิก</button>
                <button onClick={saveEdit} disabled={saving} style={{ background: '#e11d48', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: saving ? .7 : 1 }}>
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
                  <span style={{ fontSize: '13px', fontWeight: 600, color: k.startsWith('ราคา') ? '#374151' : '#1e293b' }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── ย้ายสาขา ── */}
        <div className="card" style={{ borderTop: '3px solid #374151' }}>
          <div className="card-title" style={{ color: '#374151' }}>🏢 สาขา</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>สาขาปัจจุบัน</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>{bike.branch_name}</span>
          </div>
          <label className="field-label">ย้ายไปสาขา</label>
          <select className="field-input" value={branchId} onChange={e => setBranchId(e.target.value)} style={{ marginBottom: '12px' }}>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}{b.id === bike.branch_id ? ' (ปัจจุบัน)' : ''}</option>
            ))}
          </select>
          <label className="field-label">ราคาเช่า/วัน ที่สาขาใหม่ (บาท)</label>
          <input className="field-input" type="number" value={transferRate} onChange={e => setTransferRate(e.target.value)} style={{ marginBottom: '12px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={saveBranch} disabled={branchSaving || branchId === bike.branch_id} style={{
              background: branchId !== bike.branch_id ? '#e11d48' : '#e5e7eb',
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div className="card-title" style={{ margin: 0 }}>📄 สถานะเอกสาร</div>
            {!editingDocs ? (
              <button onClick={() => setEditingDocs(true)} style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                ✏️ แก้ไข
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {docMsg && <span style={{ fontSize: '12px', color: docMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{docMsg}</span>}
                <button onClick={() => setEditingDocs(false)} style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer' }}>ยกเลิก</button>
                <button onClick={saveDocs} disabled={docSaving} style={{ background: '#e11d48', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: docSaving ? .7 : 1 }}>
                  {docSaving ? '⏳' : '💾 บันทึก'}
                </button>
              </div>
            )}
          </div>
          <DocStatusRow icon="🛡️" name="พ.ร.บ. รถจักรยานยนต์" expiry={docMap['pob']?.expiry_date} hasPhoto={!!docMap['pob']?.doc_photo_url} />
          {editingDocs && (
            <div className="field-row" style={{ marginLeft: '40px', marginBottom: '12px' }}>
              <label className="field-label" style={{ fontSize: '11px' }}>วันหมดอายุ พ.ร.บ.</label>
              <input className="field-input" type="date" value={pobExpiry} onChange={e => setPobExpiry(e.target.value)} style={{ fontSize: '13px', padding: '8px' }} />
            </div>
          )}
          <DocStatusRow icon="💰" name="ภาษีประจำปี" expiry={docMap['tax']?.expiry_date} hasPhoto={!!docMap['tax']?.doc_photo_url} />
          {editingDocs && (
            <div className="field-row" style={{ marginLeft: '40px', marginBottom: '12px' }}>
              <label className="field-label" style={{ fontSize: '11px' }}>วันหมดอายุภาษี</label>
              <input className="field-input" type="date" value={taxExpiry} onChange={e => setTaxExpiry(e.target.value)} style={{ fontSize: '13px', padding: '8px' }} />
            </div>
          )}
          <DocStatusRow icon="📘" name="สำเนาหน้าเล่มทะเบียน" hasPhoto={!!docMap['registration']?.doc_photo_url} />
        </div>

        {/* ── งานรูทีน ── */}
        {routineList.length > 0 && (
          <div className="card" style={{ borderTop: '3px solid #b45309' }}>
            <div className="card-title" style={{ color: '#b45309' }}>🛢️ งานรูทีน</div>
            {routineMsg && (
              <div style={{ fontSize: '12px', marginBottom: '10px', color: routineMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{routineMsg}</div>
            )}
            {routineList.map(r => {
              const daysLeft = r.next_due_date ? daysUntil(r.next_due_date) : null
              const kmLeft = r.next_due_km != null ? r.next_due_km - bike.odometer : null
              const overdue = (daysLeft != null && daysLeft <= 0) || (kmLeft != null && kmLeft <= 0)
              const warning = !overdue && ((daysLeft != null && daysLeft <= 14) || (kmLeft != null && kmLeft <= 500))
              const urgencyColor = overdue ? '#dc2626' : warning ? '#ca8a04' : '#16a34a'
              const urgencyBg = overdue ? '#fee2e2' : warning ? '#fef9c3' : '#dcfce7'
              const isEditing = editingRoutine === r.id

              return (
                <div key={r.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '14px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{r.task_name}</div>
                    <button onClick={() => isEditing ? setEditingRoutine(null) : openRoutineEdit(r)}
                      style={{ background: isEditing ? '#f3f4f6' : '#fef3c7', color: isEditing ? '#374151' : '#b45309', border: 'none', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                      {isEditing ? 'ยกเลิก' : '✏️ แก้ไข'}
                    </button>
                  </div>

                  {/* สถานะ urgency */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {daysLeft != null && (
                      <span style={{ background: urgencyBg, color: urgencyColor, fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px' }}>
                        {overdue && daysLeft != null && daysLeft <= 0 ? `🚨 เลยกำหนด ${Math.abs(daysLeft)} วัน` : `📅 ${daysLeft} วัน`}
                      </span>
                    )}
                    {kmLeft != null && (
                      <span style={{ background: urgencyBg, color: urgencyColor, fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px' }}>
                        {kmLeft <= 0 ? `🚨 เลยกำหนด ${Math.abs(kmLeft).toLocaleString()} กม.` : `🛣️ อีก ${kmLeft.toLocaleString()} กม.`}
                      </span>
                    )}
                    {daysLeft == null && kmLeft == null && (
                      <span style={{ background: '#f3f4f6', color: '#9ca3af', fontSize: '11px', padding: '3px 8px', borderRadius: '20px' }}>— ยังไม่ตั้งค่า</span>
                    )}
                  </div>

                  {/* ข้อมูล */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
                    {r.interval_km && <span>ทุก {r.interval_km.toLocaleString()} กม.</span>}
                    {r.interval_days && <span>ทุก {r.interval_days} วัน</span>}
                    {r.last_done_date && <span>ทำล่าสุด: {new Date(r.last_done_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                    {r.last_done_km && <span>ไมล์ล่าสุด: {r.last_done_km.toLocaleString()} กม.</span>}
                    {r.next_due_date && <span>ครบกำหนด: {new Date(r.next_due_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                    {r.next_due_km && <span>ครบที่: {r.next_due_km.toLocaleString()} กม.</span>}
                  </div>

                  {/* Form แก้ไข */}
                  {isEditing && (
                    <div style={{ background: '#fffbeb', borderRadius: '10px', padding: '12px', marginTop: '10px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>ทุกกี่กิโลเมตร</div>
                          <input className="field-input" type="number" placeholder="เช่น 1000"
                            value={routineForm.interval_km}
                            onChange={e => setRoutineForm(f => ({ ...f, interval_km: e.target.value }))}
                            style={{ fontSize: '13px', padding: '8px' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>ทุกกี่วัน</div>
                          <input className="field-input" type="number" placeholder="เช่น 90"
                            value={routineForm.interval_days}
                            onChange={e => setRoutineForm(f => ({ ...f, interval_days: e.target.value }))}
                            style={{ fontSize: '13px', padding: '8px' }} />
                        </div>
                      </div>
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>วันที่ทำล่าสุด</div>
                        <input className="field-input" type="date"
                          value={routineForm.last_done_date}
                          onChange={e => setRoutineForm(f => ({ ...f, last_done_date: e.target.value }))}
                          style={{ fontSize: '13px', padding: '8px' }} />
                      </div>
                      <button onClick={() => saveRoutine(r)} disabled={routineSaving}
                        style={{ background: '#b45309', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: routineSaving ? .7 : 1, width: '100%' }}>
                        {routineSaving ? '⏳ กำลังบันทึก...' : '💾 บันทึกการตั้งค่า'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

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
              background: '#111827', color: '#fff', textDecoration: 'none',
              borderRadius: '10px', padding: '10px 24px', fontSize: '14px', fontWeight: 700,
            }}
          >
            ⬇️ เปิดรูป QR ขนาดใหญ่
          </a>
        </div>

        {/* ── ประวัติการซ่อม ── */}
        <div className="card" style={{ borderTop: '3px solid #dc2626' }}>
          <div className="card-title" style={{ color: '#dc2626' }}>🔧 ประวัติการซ่อม</div>
          {repairs.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>ยังไม่มีประวัติการซ่อม</div>
          ) : (
            repairs.map((r, i) => (
              <div key={r.id} style={{ borderBottom: i < repairs.length - 1 ? '1px solid #f1f5f9' : 'none', padding: '12px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', flex: 1, marginRight: '8px' }}>{r.description}</div>
                  <span style={{
                    background: r.status === 'done' ? '#dcfce7' : '#fee2e2',
                    color: r.status === 'done' ? '#16a34a' : '#dc2626',
                    fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', whiteSpace: 'nowrap',
                  }}>
                    {r.status === 'done' ? '✅ ซ่อมแล้ว' : '🔴 กำลังซ่อม'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: '12px', color: '#64748b' }}>
                  <span>📅 แจ้ง: {new Date(r.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  {r.resolved_at && <span>✅ เสร็จ: {new Date(r.resolved_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                  {r.repair_shop && <span>🏪 {r.repair_shop}</span>}
                  {!!r.repair_cost && <span>💰 ฿{Number(r.repair_cost).toLocaleString()}</span>}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Danger Zone ── */}
        <div className="card" style={{ border: '1.5px solid #dc2626' }}>
          <div className="card-title" style={{ color: '#dc2626' }}>⚠️ Danger Zone</div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '14px' }}>
            การลบรถจะ<strong style={{ color: '#dc2626' }}>ลบข้อมูลออกจากระบบถาวร</strong> ไม่สามารถกู้คืนได้
          </div>
          {!showDelete ? (
            <button onClick={() => { setShowDelete(true); setDeleteConfirm(''); setDeleteError('') }}
              style={{ background: '#fff', color: '#dc2626', border: '2px solid #dc2626', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', width: '100%' }}>
              🗑️ ลบรถคันนี้ออกจากระบบ
            </button>
          ) : (
            <div style={{ background: '#fef2f2', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#dc2626', marginBottom: '6px' }}>ยืนยันการลบ?</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
                รถ <strong>{bike.license_plate}</strong> จะถูกลบถาวร — พิมพ์ <strong>DELETE</strong> เพื่อยืนยัน
              </div>
              <input
                type="text"
                placeholder="พิมพ์ DELETE"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                style={{ width: '100%', padding: '10px', border: '1.5px solid #fca5a5', borderRadius: '8px', fontSize: '14px', fontWeight: 700, letterSpacing: '2px', marginBottom: '10px', boxSizing: 'border-box', outline: 'none', background: '#fff' }}
              />
              {deleteError && <div style={{ fontSize: '12px', color: '#dc2626', marginBottom: '10px' }}>❌ {deleteError}</div>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowDelete(false)}
                  style={{ flex: 1, padding: '10px', background: '#f3f4f6', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  ยกเลิก
                </button>
                <button
                  onClick={deleteBike}
                  disabled={deleteConfirm !== 'DELETE' || deleting}
                  style={{ flex: 1, padding: '10px', background: deleteConfirm === 'DELETE' ? '#dc2626' : '#fca5a5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: deleteConfirm === 'DELETE' ? 'pointer' : 'not-allowed', opacity: deleting ? .7 : 1 }}>
                  {deleting ? '⏳ กำลังลบ...' : '🗑️ ลบถาวร'}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
