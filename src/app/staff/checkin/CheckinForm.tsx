'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { compressImage } from '@/lib/compressImage'

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })
}

export default function CheckinForm({ staffName, branchName, redirectTo, alreadyCheckedInAt }: {
  staffName: string
  branchName: string
  redirectTo: string
  alreadyCheckedInAt: string | null
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const submittingRef = useRef(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<Blob | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [checkedInAt, setCheckedInAt] = useState<string | null>(alreadyCheckedInAt)

  // เช็คอินไปแล้ววันนี้ (เช่น เข้าหน้านี้ซ้ำ) — แค่รีเฟรชคุกกี้ ไม่ต้องถ่ายรูปใหม่
  useEffect(() => {
    if (!alreadyCheckedInAt) return
    fetch('/api/staff/checkin/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFile = async (f: File) => {
    setError('')
    const compressed = await compressImage(f, 300)
    setFile(compressed)
    setPreview(URL.createObjectURL(compressed))
  }

  const retake = () => {
    setPreview(null)
    setFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const confirm = async () => {
    if (!file || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', new File([file], 'checkin.jpg', { type: 'image/jpeg' }))
      fd.append('folder', 'checkins')
      const uploadRes = await fetch('/api/staff/upload', { method: 'POST', body: fd })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadData.error ?? 'อัพโหลดรูปไม่สำเร็จ')

      const res = await fetch('/api/staff/checkin/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: uploadData.url, photoPath: uploadData.path }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'บันทึกไม่สำเร็จ')

      if (data.alreadyCheckedIn) {
        setCheckedInAt(data.checkedInAt)
        return
      }

      router.push(redirectTo)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่')
      setSubmitting(false)
      submittingRef.current = false
    }
  }

  return (
    <div className="app-wrap" style={{ background: '#111827', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '32px 24px 16px', textAlign: 'center', color: '#fff' }}>
        <div style={{ fontSize: '40px', marginBottom: '10px' }}>🐻</div>
        <div style={{ fontSize: '19px', fontWeight: 800 }}>ลงทะเบียนเข้างาน</div>
        <div style={{ fontSize: '13px', opacity: 0.7, marginTop: '4px' }}>{staffName} — {branchName}</div>
      </div>

      <div style={{ flex: 1, padding: '8px 24px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {checkedInAt ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '14px' }}>✅</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>เช็คอินไปแล้ววันนี้</div>
            <div style={{ color: 'rgba(255,255,255,.6)', fontSize: '13px', marginBottom: '24px' }}>เมื่อเวลา {fmtTime(checkedInAt)}</div>
            <button onClick={() => { router.push(redirectTo); router.refresh() }} style={{
              width: '100%', padding: '15px', borderRadius: '14px', border: 'none',
              background: '#e11d48', color: '#fff', fontSize: '15px', fontWeight: 800,
              fontFamily: 'inherit', cursor: 'pointer',
            }}>ไปต่อ →</button>
          </div>
        ) : !preview ? (
          <label style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '14px', background: 'rgba(255,255,255,.06)', border: '1.5px dashed rgba(255,255,255,.25)',
            borderRadius: '20px', padding: '48px 20px', cursor: 'pointer',
          }}>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="user"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            <div style={{ fontSize: '48px' }}>📸</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>แตะเพื่อถ่ายรูปคู่ป้ายร้าน</div>
            <div style={{ color: 'rgba(255,255,255,.5)', fontSize: '12px', textAlign: 'center' }}>ถ่ายสดเท่านั้น — ไม่สามารถแนบรูปเก่าได้</div>
          </label>
        ) : (
          <div>
            <div style={{ borderRadius: '20px', overflow: 'hidden', marginBottom: '16px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="เช็คอิน" style={{ width: '100%', display: 'block' }} />
            </div>
            {error && (
              <div style={{ color: '#fca5a5', fontSize: '13px', textAlign: 'center', marginBottom: '12px' }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={retake} disabled={submitting} style={{
                flex: 1, padding: '15px', borderRadius: '14px', border: '1.5px solid rgba(255,255,255,.25)',
                background: 'transparent', color: '#fff', fontSize: '15px', fontWeight: 700,
                fontFamily: 'inherit', cursor: 'pointer',
              }}>ถ่ายใหม่</button>
              <button onClick={confirm} disabled={submitting} style={{
                flex: 2, padding: '15px', borderRadius: '14px', border: 'none',
                background: '#e11d48', color: '#fff', fontSize: '15px', fontWeight: 800,
                fontFamily: 'inherit', cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1,
              }}>{submitting ? 'กำลังบันทึก...' : '✓ ยืนยันเข้างาน'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
