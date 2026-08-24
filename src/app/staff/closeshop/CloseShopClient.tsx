'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { compressImage } from '@/lib/compressImage'
import { normalizePlate } from '@/lib/plate'

type PlateEntryStatus =
  | { kind: 'empty' }
  | { kind: 'uploading'; preview: string }
  | { kind: 'matched'; preview: string; url: string; detectedPlates: string[] }
  | { kind: 'mismatch'; preview: string; url: string; detectedPlates: string[] }
  | { kind: 'manual'; preview: string; url: string; detectedPlates: string[] }

const BATCH_TARGET = '__batch__'

type Props = {
  staffName: string
  branchName: string
  shopPlates: string[]
  repairPlates: string[]
  alreadyClosedToday: { closedAt: string; staffName: string } | null
}

export default function CloseShopClient({ staffName, branchName, shopPlates, repairPlates, alreadyClosedToday }: Props) {
  const expectedPlates = [...shopPlates, ...repairPlates]
  const router = useRouter()
  const selfieInputRef = useRef<HTMLInputElement>(null)
  const activePlateRef = useRef<string | null>(null)
  const plateInputRef = useRef<HTMLInputElement>(null)
  const submittingRef = useRef(false)

  const [step, setStep] = useState<'plates' | 'selfie'>('plates')

  const [entries, setEntries] = useState<Map<string, PlateEntryStatus>>(new Map())
  const [explanation, setExplanation] = useState('')
  const [batchUploading, setBatchUploading] = useState(false)
  const [batchSummary, setBatchSummary] = useState('')

  const [selfieFile, setSelfieFile] = useState<Blob | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const statusOf = (plate: string): PlateEntryStatus =>
    entries.get(normalizePlate(plate)) ?? { kind: 'empty' }

  const foundPlates = expectedPlates.filter(p => {
    const k = statusOf(p).kind
    return k === 'matched' || k === 'manual'
  })
  const missingPlates = expectedPlates.filter(p => !foundPlates.includes(p))
  const needsExplanation = missingPlates.length > 0
  const canProceed = (!needsExplanation || explanation.trim().length > 0) && !batchUploading &&
    expectedPlates.every(p => statusOf(p).kind !== 'uploading')

  const confirmManually = (plate: string) => {
    const np = normalizePlate(plate)
    setEntries(prev => {
      const cur = prev.get(np)
      if (!cur || cur.kind !== 'mismatch') return prev
      const m = new Map(prev)
      m.set(np, { kind: 'manual', preview: cur.preview, url: cur.url, detectedPlates: cur.detectedPlates })
      return m
    })
  }

  // ── plate photos (one per checklist row, or one batch photo matched against several rows) ──
  const openCameraFor = (plate: string) => {
    activePlateRef.current = plate
    plateInputRef.current?.click()
  }
  const openBatchCamera = () => {
    activePlateRef.current = BATCH_TARGET
    plateInputRef.current?.click()
  }

  const uploadAndOcr = async (compressed: Blob) => {
    const fd = new FormData()
    fd.append('file', new File([compressed], 'plate.jpg', { type: 'image/jpeg' }))
    fd.append('folder', 'closeshop-plates')
    const uploadRes = await fetch('/api/staff/upload', { method: 'POST', body: fd })
    const uploadData = await uploadRes.json()
    if (!uploadRes.ok) throw new Error(uploadData.error ?? 'อัพโหลดรูปไม่สำเร็จ')

    const ocrRes = await fetch('/api/staff/ocr-plates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: uploadData.url }),
    })
    const ocrData = await ocrRes.json()
    const detected: string[] = Array.isArray(ocrData.plates) ? ocrData.plates : []
    return { url: uploadData.url as string, detected }
  }

  const handlePlatePhoto = async (f: File) => {
    const plate = activePlateRef.current
    if (!plate) return
    const np = normalizePlate(plate)
    setError('')
    const compressed = await compressImage(f, 300)
    const preview = URL.createObjectURL(compressed)
    setEntries(prev => { const m = new Map(prev); m.set(np, { kind: 'uploading', preview }); return m })
    try {
      const { url, detected } = await uploadAndOcr(compressed)
      const isMatch = detected.some(d => normalizePlate(d) === np)
      setEntries(prev => {
        const m = new Map(prev)
        m.set(np, { kind: isMatch ? 'matched' : 'mismatch', preview, url, detectedPlates: detected })
        return m
      })
    } catch {
      setEntries(prev => { const m = new Map(prev); m.set(np, { kind: 'empty' }); return m })
      setError('อัพโหลด/ตรวจรูปไม่สำเร็จ กรุณาลองใหม่')
    }
  }

  // ถ่ายรูปเดียวเห็นรถหลายคัน — บอทอ่านป้ายทั้งหมดในรูปแล้วจับคู่เข้าแถวที่ตรงกันอัตโนมัติ
  // ไม่แตะแถวที่ยืนยันแล้ว (matched/manual) — เติมเฉพาะแถวที่ยังว่างหรือยังไม่ตรง
  const handleBatchPhoto = async (f: File) => {
    setError('')
    setBatchSummary('')
    setBatchUploading(true)
    try {
      const compressed = await compressImage(f, 300)
      const preview = URL.createObjectURL(compressed)
      const { url, detected } = await uploadAndOcr(compressed)

      // คำนวณรายการที่จับคู่ได้ล่วงหน้าจาก state ปัจจุบัน (ไม่นับซ้ำแถวที่ยืนยันแล้ว)
      // แล้วค่อย setEntries/setBatchSummary พร้อมกันด้วยค่าที่คำนวณเสร็จแล้ว — กัน race condition
      // จากการอ่านตัวแปรนับใน closure ของ setEntries updater ซึ่ง React ไม่รับประกันว่าจะรันตรงจุดนี้ทันที
      const toMatch = expectedPlates.filter(plate => {
        const np = normalizePlate(plate)
        const cur = entries.get(np)
        if (cur && (cur.kind === 'matched' || cur.kind === 'manual')) return false
        return detected.some(d => normalizePlate(d) === np)
      })
      if (toMatch.length > 0) {
        setEntries(prev => {
          const m = new Map(prev)
          for (const plate of toMatch) {
            m.set(normalizePlate(plate), { kind: 'matched', preview, url, detectedPlates: detected })
          }
          return m
        })
      }
      setBatchSummary(toMatch.length > 0 ? `เจอ ${toMatch.length} คันจากรูปนี้` : 'ไม่เจอคันที่ตรงกับรายการจากรูปนี้ ลองถ่ายทีละคันแทน')
    } catch {
      setError('อัพโหลด/ตรวจรูปไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setBatchUploading(false)
    }
  }

  // ── selfie (ถ่ายท้ายสุด — ตอนตรวจรถครบ/อธิบายครบแล้วค่อยถ่ายรูปปิดร้านจริง) ──
  const handleSelfie = async (f: File) => {
    setError('')
    const compressed = await compressImage(f, 300)
    setSelfieFile(compressed)
    setSelfiePreview(URL.createObjectURL(compressed))
  }
  const retakeSelfie = () => {
    setSelfiePreview(null)
    setSelfieFile(null)
    if (selfieInputRef.current) selfieInputRef.current.value = ''
  }

  const submit = async () => {
    if (!selfieFile || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', new File([selfieFile], 'closeshop-selfie.jpg', { type: 'image/jpeg' }))
      fd.append('folder', 'closeshops')
      const uploadRes = await fetch('/api/staff/upload', { method: 'POST', body: fd })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadData.error ?? 'อัพโหลดรูปไม่สำเร็จ')

      const plateEntries: { plate: string; url: string; detectedPlates: string[] }[] = []
      const manuallyConfirmedPlates: string[] = []
      for (const plate of expectedPlates) {
        const status = statusOf(plate)
        if (status.kind === 'matched' || status.kind === 'mismatch' || status.kind === 'manual') {
          plateEntries.push({ plate, url: status.url, detectedPlates: status.detectedPlates })
        }
        if (status.kind === 'manual') manuallyConfirmedPlates.push(plate)
      }

      const res = await fetch('/api/staff/closeshop/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selfiePhotoUrl: uploadData.url,
          plateEntries,
          manuallyConfirmedPlates,
          explanation: explanation.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'บันทึกไม่สำเร็จ')
      router.push('/staff/home')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่')
      setSubmitting(false)
      submittingRef.current = false
    }
  }

  if (step === 'selfie') {
    return (
      <div className="app-wrap" style={{ background: '#111827', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '32px 24px 16px', textAlign: 'center', color: '#fff' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔒</div>
          <div style={{ fontSize: '19px', fontWeight: 800 }}>ปิดร้าน</div>
          <div style={{ fontSize: '13px', opacity: 0.7, marginTop: '4px' }}>{staffName} — {branchName}</div>
        </div>

        <div style={{ flex: 1, padding: '8px 24px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {!selfiePreview ? (
            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '14px', background: 'rgba(255,255,255,.06)', border: '1.5px dashed rgba(255,255,255,.25)',
              borderRadius: '20px', padding: '48px 20px', cursor: 'pointer',
            }}>
              <input
                ref={selfieInputRef}
                type="file"
                accept="image/*"
                capture="user"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleSelfie(f) }}
              />
              <div style={{ fontSize: '48px' }}>📸</div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>แตะเพื่อถ่ายรูปคู่ร้านตอนปิด</div>
              <div style={{ color: 'rgba(255,255,255,.5)', fontSize: '12px', textAlign: 'center' }}>ถ่ายสดเท่านั้น — ไม่สามารถแนบรูปเก่าได้</div>
            </label>
          ) : (
            <div>
              <div style={{ borderRadius: '20px', overflow: 'hidden', marginBottom: '16px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selfiePreview} alt="ปิดร้าน" style={{ width: '100%', display: 'block' }} />
              </div>
              {error && (
                <div style={{ color: '#fca5a5', fontSize: '13px', textAlign: 'center', marginBottom: '12px' }}>{error}</div>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={retakeSelfie} disabled={submitting} style={{
                  flex: 1, padding: '15px', borderRadius: '14px', border: '1.5px solid rgba(255,255,255,.25)',
                  background: 'transparent', color: '#fff', fontSize: '15px', fontWeight: 700,
                  fontFamily: 'inherit', cursor: 'pointer',
                }}>ถ่ายใหม่</button>
                <button onClick={submit} disabled={submitting} style={{
                  flex: 2, padding: '15px', borderRadius: '14px', border: 'none',
                  background: '#e11d48', color: '#fff', fontSize: '15px', fontWeight: 800,
                  fontFamily: 'inherit', cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1,
                }}>{submitting ? 'กำลังบันทึก...' : '✓ ยืนยันปิดร้าน'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="app-wrap">
      <div style={{ background: '#111', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Link href="/staff/home" style={{ display: 'flex', color: '#fff' }}>
          <ArrowLeft size={20} strokeWidth={1.75} />
        </Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>ปิดร้าน — ถ่ายรูปป้ายทะเบียน</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.55)' }}>{branchName}</div>
        </div>
      </div>

      {/* hidden shared camera input — retargeted per-row (or batch) via activePlateRef */}
      <input
        ref={plateInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) {
            if (activePlateRef.current === BATCH_TARGET) handleBatchPhoto(f)
            else handlePlatePhoto(f)
          }
          if (plateInputRef.current) plateInputRef.current.value = ''
        }}
      />

      <div style={{ padding: '16px 12px 100px' }}>
        {alreadyClosedToday && (
          <div style={{
            background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '12px',
            padding: '10px 12px', marginBottom: '14px', fontSize: '12px', color: '#92400e',
          }}>
            ⚠️ วันนี้ปิดร้านไปแล้วเมื่อ {new Date(alreadyClosedToday.closedAt).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })} น. โดย {alreadyClosedToday.staffName} — ยังปิดซ้ำได้ถ้าจำเป็น
          </div>
        )}

        {/* batch photo — fast path: ถ่ายรวมหลายคัน ให้บอทจับคู่อัตโนมัติ */}
        <button onClick={openBatchCamera} disabled={batchUploading} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          background: '#111', color: '#fff', border: 'none', borderRadius: '14px', padding: '14px',
          marginBottom: '6px', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit',
          cursor: batchUploading ? 'default' : 'pointer', opacity: batchUploading ? 0.6 : 1,
        }}>
          {batchUploading ? '⏳ กำลังตรวจรูป...' : '📸 ถ่ายรวมหลายคัน (บอทจับคู่ให้อัตโนมัติ)'}
        </button>
        {batchSummary && (
          <div style={{ textAlign: 'center', fontSize: '12px', color: '#6b7280', marginBottom: '10px' }}>{batchSummary}</div>
        )}
        <div style={{ textAlign: 'center', fontSize: '11px', color: '#9ca3af', marginBottom: '14px' }}>
          หรือถ่ายทีละคันด้านล่างก็ได้
        </div>

        {/* summary */}
        <div style={{
          background: missingPlates.length === 0 ? '#f0fdf4' : '#fef2f2',
          border: `1.5px solid ${missingPlates.length === 0 ? '#bbf7d0' : '#fecaca'}`,
          borderRadius: '14px', padding: '14px', marginBottom: '14px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '20px', fontWeight: 800, color: missingPlates.length === 0 ? '#16a34a' : '#dc2626' }}>
            {foundPlates.length} / {expectedPlates.length} คันพบแล้ว
          </div>
        </div>

        {/* checklist — each row is its own photo-attach point */}
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          รายการรถที่ควรอยู่ร้าน ({shopPlates.length}) — ถ่ายรูปแนบทีละคัน
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {shopPlates.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: '13px' }}>ไม่มีรถที่ควรอยู่ร้านตอนนี้</div>
          )}
          {shopPlates.map(plate => <PlateRow key={plate} plate={plate} status={statusOf(plate)} openCameraFor={openCameraFor} confirmManually={confirmManually} />)}
        </div>

        {repairPlates.length > 0 && (
          <>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#b45309', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🔧 รถเสียที่ร้าน ({repairPlates.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {repairPlates.map(plate => <PlateRow key={plate} plate={plate} status={statusOf(plate)} openCameraFor={openCameraFor} confirmManually={confirmManually} />)}
            </div>
          </>
        )}

        {error && (
          <div style={{ color: '#dc2626', fontSize: '13px', textAlign: 'center', marginBottom: '12px' }}>{error}</div>
        )}

        {/* explanation */}
        {needsExplanation && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#dc2626', display: 'block', marginBottom: '6px' }}>
              ⚠️ ยังหารถไม่ครบ — กรุณาอธิบาย *
            </label>
            <textarea
              className="field-input"
              rows={3}
              placeholder="เช่น คันนี้อยู่ระหว่างส่งลูกค้านอกเวลา, ลืมถ่ายรูป ฯลฯ"
              value={explanation}
              onChange={e => setExplanation(e.target.value)}
            />
          </div>
        )}

        <button onClick={() => setStep('selfie')} disabled={!canProceed} style={{
          width: '100%', padding: '15px', borderRadius: '14px', border: 'none',
          background: canProceed ? '#111827' : '#e2e8f0', color: canProceed ? '#fff' : '#94a3b8',
          fontSize: '15px', fontWeight: 800, fontFamily: 'inherit',
          cursor: canProceed ? 'pointer' : 'not-allowed',
        }}>
          ถ่ายรูปปิดร้าน →
        </button>
      </div>
    </div>
  )
}

function PlateRow({ plate, status, openCameraFor, confirmManually }: {
  plate: string
  status: PlateEntryStatus
  openCameraFor: (plate: string) => void
  confirmManually: (plate: string) => void
}) {
  const bg = status.kind === 'matched' || status.kind === 'manual' ? '#f0fdf4'
    : status.kind === 'mismatch' ? '#fef2f2' : '#f9fafb'
  const border = status.kind === 'matched' || status.kind === 'manual' ? '#bbf7d0'
    : status.kind === 'mismatch' ? '#fecaca' : '#e5e7eb'
  const textColor = status.kind === 'matched' || status.kind === 'manual' ? '#16a34a'
    : status.kind === 'mismatch' ? '#dc2626' : '#374151'

  return (
    <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: '12px', padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {(status.kind === 'uploading' || status.kind === 'matched' || status.kind === 'mismatch' || status.kind === 'manual') ? (
          <div style={{ position: 'relative', flexShrink: 0, width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', background: '#f1f5f9' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={status.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {status.kind === 'uploading' && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px' }}>⏳</div>
            )}
          </div>
        ) : (
          <span style={{
            width: '48px', height: '48px', borderRadius: '8px', flexShrink: 0,
            border: '1.5px dashed #d1d5db', background: '#fff',
          }} />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: textColor }}>{plate}</div>
          {status.kind === 'matched' && <div style={{ fontSize: '11px', color: '#16a34a' }}>✅ ตรง</div>}
          {status.kind === 'manual' && <div style={{ fontSize: '11px', color: '#16a34a' }}>✋ ยืนยันเอง</div>}
          {status.kind === 'mismatch' && (
            <div style={{ fontSize: '11px', color: '#dc2626' }}>
              ⚠️ ป้ายไม่ตรง{status.detectedPlates.length > 0 ? ` (บอทอ่านได้: ${status.detectedPlates.join(', ')})` : ' (บอทอ่านป้ายไม่ได้)'}
            </div>
          )}
        </div>

        {status.kind === 'empty' && (
          <button onClick={() => openCameraFor(plate)} style={{
            flexShrink: 0, padding: '8px 14px', borderRadius: '10px', border: 'none',
            background: '#111', color: '#fff', fontSize: '12px', fontWeight: 700,
            fontFamily: 'inherit', cursor: 'pointer',
          }}>📷 ถ่ายรูป</button>
        )}
        {status.kind === 'matched' && (
          <button onClick={() => openCameraFor(plate)} style={{
            flexShrink: 0, padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #bbf7d0',
            background: 'transparent', color: '#16a34a', fontSize: '12px', fontWeight: 700,
            fontFamily: 'inherit', cursor: 'pointer',
          }}>ถ่ายใหม่</button>
        )}
      </div>

      {status.kind === 'mismatch' && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <button onClick={() => openCameraFor(plate)} style={{
            flex: 1, padding: '9px', borderRadius: '10px', border: '1.5px solid #fecaca',
            background: '#fff', color: '#dc2626', fontSize: '12px', fontWeight: 700,
            fontFamily: 'inherit', cursor: 'pointer',
          }}>ถ่ายใหม่</button>
          <button onClick={() => confirmManually(plate)} style={{
            flex: 1, padding: '9px', borderRadius: '10px', border: 'none',
            background: '#111', color: '#fff', fontSize: '12px', fontWeight: 700,
            fontFamily: 'inherit', cursor: 'pointer',
          }}>ยืนยันว่าใช่คันนี้</button>
        </div>
      )}
    </div>
  )
}
