'use client'

import { useState, useRef } from 'react'

type FileItem = {
  file: File
  docType: 'tax' | 'pob' | 'registration' | null
  plate: string | null
  preview: string
  error?: string
}

const PREFIX_MAP: Record<string, string> = {
  tax: 'ภาษี',
  pob: 'พรบ',
  book: 'หน้าเล่ม',
}

const DOC_TYPE_LABEL: Record<string, string> = {
  tax: 'ภาษี',
  pob: 'พรบ',
  registration: 'หน้าเล่ม',
}

function normalizePlate(p: string) {
  return p.replace(/[\s\-]/g, '')
}

function parseFilename(filename: string): { prefix: string; plate: string } | null {
  const base = filename.replace(/\.[^.]+$/, '').toLowerCase()
  for (const prefix of Object.keys(PREFIX_MAP)) {
    if (base.startsWith(prefix + '_')) {
      return { prefix, plate: base.slice(prefix.length + 1) }
    }
  }
  return null
}

export default function DocUploadSection() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: { filename: string; reason: string }[] } | null>(null)
  const [error, setError] = useState('')

  const handleFiles = (files: FileList) => {
    setResult(null)
    setError('')
    const newItems: FileItem[] = Array.from(files).map(file => {
      const parsed = parseFilename(file.name)
      const preview = URL.createObjectURL(file)

      if (!parsed) {
        return { file, docType: null, plate: null, preview, error: 'ชื่อไฟล์ไม่ตรง format' }
      }

      const docTypeMap: Record<string, 'tax' | 'pob' | 'registration'> = {
        tax: 'tax', pob: 'pob', book: 'registration',
      }

      return {
        file,
        docType: docTypeMap[parsed.prefix] ?? null,
        plate: normalizePlate(parsed.plate),
        preview,
      }
    })
    setItems(newItems)
  }

  const validItems = items.filter(i => !i.error)
  const errorItems = items.filter(i => i.error)

  const handleUpload = async () => {
    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      validItems.forEach(i => fd.append('files', i.file))

      const res = await fetch('/api/owner/import/docs', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'เกิดข้อผิดพลาด')
      } else {
        setResult({ imported: data.imported, skipped: data.skipped ?? [] })
        setItems([])
        if (inputRef.current) inputRef.current.value = ''
      }
    } catch {
      setError('เชื่อมต่อ server ไม่ได้')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: '8px' }}>
      {/* Header */}
      <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '12px', padding: '14px', marginBottom: '16px', fontSize: '13px' }}>
        <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '6px' }}>📂 ตั้งชื่อไฟล์ให้ตรง format</div>
        <div style={{ color: '#78350f', lineHeight: 1.8 }}>
          <div><code style={{ background: '#fef3c7', padding: '1px 6px', borderRadius: '4px' }}>tax_กขค1234.jpg</code> → ภาษี</div>
          <div><code style={{ background: '#fef3c7', padding: '1px 6px', borderRadius: '4px' }}>pob_กขค1234.jpg</code> → พรบ</div>
          <div><code style={{ background: '#fef3c7', padding: '1px 6px', borderRadius: '4px' }}>book_กขค1234.jpg</code> → หน้าเล่ม</div>
        </div>
      </div>

      {/* Upload zone */}
      {items.length === 0 && !result && (
        <label style={{
          background: '#f9fafb', border: '2px dashed #d1d5db', borderRadius: '16px',
          padding: '28px 16px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: '10px', cursor: 'pointer',
        }}>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.length) handleFiles(e.target.files) }}
          />
          <div style={{ fontSize: '36px' }}>🖼️</div>
          <div style={{ fontWeight: 700, fontSize: '15px', color: '#374151' }}>เลือกรูปเอกสาร (หลายไฟล์พร้อมกัน)</div>
          <div style={{ fontSize: '12px', color: '#9ca3af' }}>รองรับ JPG, PNG</div>
        </label>
      )}

      {/* Error items */}
      {errorItems.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px 14px', marginBottom: '12px' }}>
          <div style={{ fontWeight: 700, color: '#dc2626', fontSize: '13px', marginBottom: '6px' }}>❌ ไฟล์ที่ชื่อไม่ตรง format (จะไม่ถูก upload)</div>
          {errorItems.map((item, i) => (
            <div key={i} style={{ fontSize: '12px', color: '#991b1b' }}>• {item.file.name}</div>
          ))}
        </div>
      )}

      {/* Preview grid */}
      {validItems.length > 0 && !result && (
        <>
          <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827', marginBottom: '10px' }}>
            พร้อม upload {validItems.length} ไฟล์
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
            {validItems.map((item, i) => (
              <div key={i} style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #e5e7eb', background: '#f9fafb' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.preview} alt={item.file.name} style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' }} />
                <div style={{ padding: '6px 8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e40af' }}>
                    {item.docType ? DOC_TYPE_LABEL[item.docType] : '?'}
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>{item.plate}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => { setItems([]); if (inputRef.current) inputRef.current.value = '' }}
              style={{ flex: 1, background: '#f3f4f6', border: 'none', borderRadius: '12px', padding: '14px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', color: '#374151' }}
            >
              ยกเลิก
            </button>
            <button
              onClick={handleUpload}
              disabled={loading}
              style={{
                flex: 2, background: loading ? '#93c5fd' : '#1e40af', border: 'none',
                borderRadius: '12px', padding: '14px', fontWeight: 700, fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer', color: '#fff',
              }}
            >
              {loading ? '⏳ กำลัง upload...' : `📤 Upload ${validItems.length} ไฟล์`}
            </button>
          </div>
        </>
      )}

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px', color: '#dc2626', fontSize: '13px', marginTop: '12px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: '16px', color: '#15803d' }}>
            Upload สำเร็จ {result.imported} ไฟล์
          </div>
          {result.skipped.length > 0 && (
            <div style={{ marginTop: '10px', textAlign: 'left', background: '#fef2f2', borderRadius: '10px', padding: '10px 12px' }}>
              <div style={{ fontWeight: 600, fontSize: '12px', color: '#dc2626', marginBottom: '4px' }}>ข้าม {result.skipped.length} ไฟล์:</div>
              {result.skipped.map((s, i) => (
                <div key={i} style={{ fontSize: '11px', color: '#991b1b' }}>• {s.filename}: {s.reason}</div>
              ))}
            </div>
          )}
          <button
            onClick={() => setResult(null)}
            style={{ marginTop: '14px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 24px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
          >
            Upload เพิ่ม
          </button>
        </div>
      )}
    </div>
  )
}
