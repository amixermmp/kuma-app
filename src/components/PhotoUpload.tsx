'use client'

import { useState, useRef } from 'react'
import { compressImage } from '@/lib/compressImage'

type Props = {
  icon: string
  hint: string
  folder: string
  onUpload: (url: string, path: string) => void
  onRemove?: () => void
  uploadEndpoint?: string
}

export default function PhotoUpload({ icon, hint, folder, onUpload, onRemove, uploadEndpoint = '/api/staff/upload' }: Props) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setStatus('uploading')
    try {
      const compressed = await compressImage(file, 200)
      const localPreview = URL.createObjectURL(compressed)
      setPreview(localPreview)

      const fd = new FormData()
      fd.append('file', new File([compressed], 'photo.jpg', { type: 'image/jpeg' }))
      fd.append('folder', folder)

      const res = await fetch(uploadEndpoint, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      onUpload(data.url, data.path)
      setStatus('done')
    } catch (err) {
      console.error('Upload failed:', err)
      setStatus('idle')
      setPreview(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  if (status === 'uploading') {
    return (
      <div className="upload-box" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '20px', height: '20px', flexShrink: 0,
          border: '2px solid #e5e7eb', borderTopColor: '#e11d48',
          borderRadius: '50%', animation: 'spin 0.7s linear infinite',
        }} />
        <span style={{ fontSize: '13px', color: '#6b7280' }}>บีบอัดและอัพโหลด…</span>
      </div>
    )
  }

  if (status === 'done' && preview) {
    return (
      <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="uploaded" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', display: 'block' }} />
        <button
          onClick={() => {
            setStatus('idle')
            setPreview(null)
            if (inputRef.current) inputRef.current.value = ''
            onRemove?.()
          }}
          style={{
            position: 'absolute', top: '8px', right: '8px',
            background: 'rgba(0,0,0,0.55)', color: '#fff',
            border: 'none', borderRadius: '50%',
            width: '28px', height: '28px', cursor: 'pointer',
            fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>
        <div style={{
          position: 'absolute', bottom: '8px', left: '8px',
          background: 'rgba(22,163,74,0.9)', color: '#fff',
          fontSize: '11px', fontWeight: 700, padding: '3px 8px',
          borderRadius: '20px',
        }}>✓ อัพโหลดแล้ว</div>
      </div>
    )
  }

  return (
    <label className="upload-box" style={{ cursor: 'pointer', display: 'block' }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
      <div className="icon">{icon}</div>
      {hint}
    </label>
  )
}
