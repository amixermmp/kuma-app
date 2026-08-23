'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { compressImage } from '@/lib/compressImage'
import { normalizePlate } from '@/lib/plate'

type PlatePhoto = {
  id: string
  preview: string
  url: string
  detectedPlates: string[]
  ocrLoading: boolean
}

type Props = { staffName: string; branchName: string; expectedPlates: string[] }

export default function CloseShopClient({ staffName, branchName, expectedPlates }: Props) {
  const router = useRouter()
  const selfieInputRef = useRef<HTMLInputElement>(null)
  const plateInputRef = useRef<HTMLInputElement>(null)
  const submittingRef = useRef(false)

  const [step, setStep] = useState<'selfie' | 'plates'>('selfie')
  const [selfieFile, setSelfieFile] = useState<Blob | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [selfieUploaded, setSelfieUploaded] = useState<{ url: string } | null>(null)
  const [selfieError, setSelfieError] = useState('')
  const [selfieUploading, setSelfieUploading] = useState(false)

  const [platePhotos, setPlatePhotos] = useState<PlatePhoto[]>([])
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map())
  const [explanation, setExplanation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const ocrFoundSet = useMemo(() => {
    const set = new Set<string>()
    for (const photo of platePhotos) {
      for (const detected of photo.detectedPlates) {
        const nd = normalizePlate(detected)
        const match = expectedPlates.find(p => normalizePlate(p) === nd)
        if (match) set.add(normalizePlate(match))
      }
    }
    return set
  }, [platePhotos, expectedPlates])

  const isFound = (plate: string) => {
    const np = normalizePlate(plate)
    if (overrides.has(np)) return overrides.get(np)!
    return ocrFoundSet.has(np)
  }
  const toggle = (plate: string) => {
    const np = normalizePlate(plate)
    setOverrides(prev => { const m = new Map(prev); m.set(np, !isFound(plate)); return m })
  }

  const foundPlates = expectedPlates.filter(isFound)
  const missingPlates = expectedPlates.filter(p => !isFound(p))
  const needsExplanation = missingPlates.length > 0
  const canSubmit = !submitting && (!needsExplanation || explanation.trim().length > 0) && platePhotos.every(p => !p.ocrLoading)

  // ── selfie ──
  const handleSelfie = async (f: File) => {
    setSelfieError('')
    const compressed = await compressImage(f, 300)
    setSelfieFile(compressed)
    setSelfiePreview(URL.createObjectURL(compressed))
  }
  const retakeSelfie = () => {
    setSelfiePreview(null)
    setSelfieFile(null)
    if (selfieInputRef.current) selfieInputRef.current.value = ''
  }
  const confirmSelfie = async () => {
    if (!selfieFile) return
    setSelfieUploading(true)
    setSelfieError('')
    try {
      const fd = new FormData()
      fd.append('file', new File([selfieFile], 'closeshop-selfie.jpg', { type: 'image/jpeg' }))
      fd.append('folder', 'closeshops')
      const res = await fetch('/api/staff/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'อัพโหลดรูปไม่สำเร็จ')
      setSelfieUploaded({ url: data.url })
      setStep('plates')
    } catch (e) {
      setSelfieError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSelfieUploading(false)
    }
  }

  // ── plate photos ──
  const handlePlatePhoto = async (f: File) => {
    const compressed = await compressImage(f, 300)
    const preview = URL.createObjectURL(compressed)
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
    setPlatePhotos(prev => [...prev, { id, preview, url: '', detectedPlates: [], ocrLoading: true }])
    try {
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
      setPlatePhotos(prev => prev.map(p => p.id === id ? { ...p, url: uploadData.url, detectedPlates: detected, ocrLoading: false } : p))
    } catch {
      setPlatePhotos(prev => prev.map(p => p.id === id ? { ...p, ocrLoading: false } : p))
    }
  }

  const submit = async () => {
    if (!canSubmit || submittingRef.current || !selfieUploaded) return
    submittingRef.current = true
    setSubmitting(true)
    setError('')
    try {
      const manuallyFoundPlates = expectedPlates
        .filter(p => isFound(p) && !ocrFoundSet.has(normalizePlate(p)))
      const res = await fetch('/api/staff/closeshop/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selfiePhotoUrl: selfieUploaded.url,
          platePhotos: platePhotos.map(p => ({ url: p.url, detectedPlates: p.detectedPlates })),
          manuallyFoundPlates,
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
              {selfieError && (
                <div style={{ color: '#fca5a5', fontSize: '13px', textAlign: 'center', marginBottom: '12px' }}>{selfieError}</div>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={retakeSelfie} disabled={selfieUploading} style={{
                  flex: 1, padding: '15px', borderRadius: '14px', border: '1.5px solid rgba(255,255,255,.25)',
                  background: 'transparent', color: '#fff', fontSize: '15px', fontWeight: 700,
                  fontFamily: 'inherit', cursor: 'pointer',
                }}>ถ่ายใหม่</button>
                <button onClick={confirmSelfie} disabled={selfieUploading} style={{
                  flex: 2, padding: '15px', borderRadius: '14px', border: 'none',
                  background: '#e11d48', color: '#fff', fontSize: '15px', fontWeight: 800,
                  fontFamily: 'inherit', cursor: selfieUploading ? 'default' : 'pointer', opacity: selfieUploading ? 0.6 : 1,
                }}>{selfieUploading ? 'กำลังอัพโหลด...' : 'ถ่ายป้ายทะเบียนต่อ →'}</button>
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

      <div style={{ padding: '16px 12px 100px' }}>
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

        {/* photo capture */}
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
          background: '#111', color: '#fff', borderRadius: '14px', padding: '16px',
          marginBottom: '14px', cursor: 'pointer', fontWeight: 700, fontSize: '14px',
        }}>
          <input
            ref={plateInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) handlePlatePhoto(f)
              if (plateInputRef.current) plateInputRef.current.value = ''
            }}
          />
          📷 ถ่ายรูปป้ายทะเบียน ({platePhotos.length} รูป)
        </label>

        {platePhotos.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '14px' }}>
            {platePhotos.map(p => (
              <div key={p.id} style={{ position: 'relative', flexShrink: 0, width: '72px', height: '72px', borderRadius: '10px', overflow: 'hidden', background: '#f1f5f9' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {p.ocrLoading && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px' }}>
                    ⏳
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* checklist */}
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          รายการรถที่ควรอยู่ร้าน ({expectedPlates.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
          {expectedPlates.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: '13px' }}>ไม่มีรถที่ควรอยู่ร้านตอนนี้</div>
          )}
          {expectedPlates.map(plate => {
            const found = isFound(plate)
            return (
              <button key={plate} onClick={() => toggle(plate)} style={{
                display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left',
                background: found ? '#f0fdf4' : '#f9fafb', border: `1.5px solid ${found ? '#bbf7d0' : '#e5e7eb'}`,
                borderRadius: '10px', padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <span style={{
                  width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0,
                  border: `2px solid ${found ? '#16a34a' : '#d1d5db'}`, background: found ? '#16a34a' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {found && <span style={{ color: '#fff', fontSize: '12px', fontWeight: 900 }}>✓</span>}
                </span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: found ? '#16a34a' : '#374151' }}>{plate}</span>
              </button>
            )
          })}
        </div>

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

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px',
            padding: '12px', color: '#dc2626', fontSize: '14px', marginBottom: '12px',
          }}>⚠️ {error}</div>
        )}

        <button onClick={submit} disabled={!canSubmit} style={{
          width: '100%', padding: '15px', borderRadius: '14px', border: 'none',
          background: canSubmit ? '#111827' : '#e2e8f0', color: canSubmit ? '#fff' : '#94a3b8',
          fontSize: '15px', fontWeight: 800, fontFamily: 'inherit',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
        }}>
          {submitting ? 'กำลังบันทึก...' : '✓ ยืนยันปิดร้าน'}
        </button>
      </div>
    </div>
  )
}
