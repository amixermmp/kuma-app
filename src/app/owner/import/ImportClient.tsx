'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import DocUploadSection from './DocUploadSection'

type Branch = { id: string; name: string }

type ParsedRow = {
  branch_name: string
  license_plate: string
  last_oil_change_date: string
  brand: string
  model: string
  year: string
  color: string
  daily_rate: string
  monthly_rate: string
  tax_expiry: string
  pob_expiry: string
  oil_interval_km: string
  gear_oil_interval_km: string
  _error?: string
}

const REQUIRED_HEADERS = [
  'branch_name', 'license_plate', 'last_oil_change_date', 'brand', 'model',
  'year', 'color', 'daily_rate', 'monthly_rate',
  'tax_expiry', 'pob_expiry',
  'oil_interval_km', 'gear_oil_interval_km',
]

const TEMPLATE_CSV = [
  REQUIRED_HEADERS.join(','),
  ',กขค 1234,2025-01-15,Honda,PCX 160,2023,ขาว,250,4500,2026-12-31,2026-06-30,1000,3000',
].join('\n')

// Proper CSV line parser — handles quoted fields and embedded commas
function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ } // escaped quote
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      result.push(cur.trim()); cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur.trim())
  return result
}

// Normalize date: accepts YYYY-MM-DD, DD/MM/YYYY, DD/MM/YY (Thai short year)
function normalizeDate(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  // Already ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const y = parseInt(s.slice(0, 4))
    if (y > 2400) return `${y - 543}${s.slice(4)}` // BE → CE
    return s
  }
  // DD/MM/YYYY or D/M/YYYY (4-digit year)
  const m4 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m4) {
    let year = parseInt(m4[3])
    if (year > 2400) year -= 543 // Buddhist Era
    return `${year}-${m4[2].padStart(2, '0')}-${m4[1].padStart(2, '0')}`
  }
  // DD/MM/YY (2-digit year — Thai short form เช่น 70 = พ.ศ. 2570 = ค.ศ. 2027)
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
  if (m2) {
    const year = parseInt(m2[3]) + 2500 - 543 // e.g. 70 → 2570 BE → 2027 CE
    return `${year}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`
  }
  return s
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const headers = splitCsvLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'))

  const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h))
  if (missing.length > 0) {
    return [{ ...Object.fromEntries(REQUIRED_HEADERS.map(h => [h, ''])) as ParsedRow, _error: `หัวตาราง CSV ไม่ครบ: ${missing.join(', ')}` }]
  }

  return lines.slice(1).map(line => {
    const values = splitCsvLine(line)
    const row: ParsedRow = {
      branch_name: '',
      license_plate: '',
      last_oil_change_date: '',
      brand: '',
      model: '',
      year: '',
      color: '',
      daily_rate: '',
      monthly_rate: '',
      tax_expiry: '',
      pob_expiry: '',
      oil_interval_km: '',
      gear_oil_interval_km: '',
    }
    headers.forEach((h, i) => {
      if (h in row) {
        const v = values[i] ?? ''
        const isDateField = h === 'tax_expiry' || h === 'pob_expiry' || h === 'last_oil_change_date'
        ;(row as Record<string, string>)[h] = isDateField ? normalizeDate(v) : v
      }
    })

    const errors: string[] = []
    if (!row.license_plate) errors.push('ไม่มีเลขทะเบียน')
    if (!row.brand) errors.push('ไม่มียี่ห้อ')
    if (!row.model) errors.push('ไม่มีรุ่น')
    if (!row.daily_rate || isNaN(Number(row.daily_rate))) errors.push('ราคาต่อวันไม่ถูกต้อง')

    if (errors.length > 0) row._error = errors.join(', ')
    return row
  })
}

export default function ImportClient({ branches }: { branches: Branch[] }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: string[] } | null>(null)
  const [globalError, setGlobalError] = useState('')

  const handleFile = (file: File) => {
    setFileName(file.name)
    setResult(null)
    setGlobalError('')
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const parsed = parseCsv(text)
      setRows(parsed)
    }
    reader.readAsText(file, 'utf-8')
  }

  const validRows = rows.filter(r => !r._error)
  const errorRows = rows.filter(r => r._error)

  const handleImport = async () => {
    setLoading(true)
    setGlobalError('')
    try {
      const res = await fetch('/api/owner/import/bikes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: validRows }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGlobalError(data.error ?? 'เกิดข้อผิดพลาด')
      } else {
        setResult({ imported: data.imported, skipped: data.skipped ?? [] })
        setRows([])
        setFileName('')
      }
    } catch {
      setGlobalError('เชื่อมต่อ server ไม่ได้')
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'kuma_import_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: '#111827' }}>
        <Link href="/owner/bikes" className="app-header-back">←</Link>
        <div>
          <h1>นำเข้าข้อมูลรถ</h1>
          <div className="sub">Import จาก CSV</div>
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* สาขาในระบบ */}
        <div style={{ background: '#f1f5f9', borderRadius: '12px', padding: '14px', fontSize: '13px' }}>
          <div style={{ fontWeight: 700, color: '#374151', marginBottom: '8px' }}>📋 สาขาในระบบ (ใส่ชื่อให้ตรง)</div>
          {branches.map(b => (
            <div key={b.id} style={{ color: '#374151', padding: '2px 0' }}>• {b.name}</div>
          ))}
        </div>

        {/* Download template */}
        <button
          onClick={downloadTemplate}
          style={{
            background: '#f0fdf4', border: '1.5px dashed #16a34a', borderRadius: '12px',
            padding: '14px', color: '#15803d', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          ⬇️ ดาวน์โหลด Template CSV
        </button>

        {/* Upload zone */}
        {!fileName && (
          <label
            style={{
              background: '#f9fafb', border: '2px dashed #d1d5db', borderRadius: '16px',
              padding: '32px 16px', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '12px', cursor: 'pointer',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            <div style={{ fontSize: '40px' }}>📂</div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#374151' }}>เลือกไฟล์ CSV</div>
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>รองรับเฉพาะไฟล์ .csv</div>
          </label>
        )}

        {/* File loaded indicator */}
        {fileName && rows.length > 0 && !result && (
          <div style={{ background: '#f1f5f9', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>📄</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#374151' }}>{fileName}</div>
              <div style={{ fontSize: '12px', color: '#374151' }}>
                พบ {rows.length} แถว — ✅ {validRows.length} พร้อม import, ❌ {errorRows.length} มีข้อผิดพลาด
              </div>
            </div>
            <button
              onClick={() => { setRows([]); setFileName(''); if (fileInputRef.current) fileInputRef.current.value = '' }}
              style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}
            >✕</button>
          </div>
        )}

        {/* Error rows */}
        {errorRows.length > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: '8px', fontSize: '13px' }}>
              ❌ แถวที่มีปัญหา ({errorRows.length} แถว) — จะไม่ถูก import
            </div>
            {errorRows.map((r, i) => (
              <div key={i} style={{ fontSize: '12px', color: '#991b1b', padding: '2px 0' }}>
                • {r.license_plate || `แถว ${i + 1}`}: {r._error}
              </div>
            ))}
          </div>
        )}

        {/* Preview table */}
        {validRows.length > 0 && !result && (
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827', marginBottom: '10px' }}>
              ตัวอย่างข้อมูล ({Math.min(validRows.length, 5)} จาก {validRows.length} คัน)
            </div>
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['สาขา', 'ทะเบียน', 'ยี่ห้อ', 'รุ่น', 'ปี', 'สี', 'ราคา/วัน', 'ราคา/เดือน'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {validRows.slice(0, 5).map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 10px', color: '#374151' }}>{r.branch_name}</td>
                      <td style={{ padding: '8px 10px', color: '#374151', fontWeight: 600 }}>{r.license_plate}</td>
                      <td style={{ padding: '8px 10px', color: '#374151' }}>{r.brand}</td>
                      <td style={{ padding: '8px 10px', color: '#374151' }}>{r.model}</td>
                      <td style={{ padding: '8px 10px', color: '#374151' }}>{r.year}</td>
                      <td style={{ padding: '8px 10px', color: '#374151' }}>{r.color}</td>
                      <td style={{ padding: '8px 10px', color: '#374151' }}>฿{Number(r.daily_rate).toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', color: '#374151' }}>{r.monthly_rate ? `฿${Number(r.monthly_rate).toLocaleString()}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {validRows.length > 5 && (
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px', textAlign: 'center' }}>
                ...และอีก {validRows.length - 5} คัน
              </div>
            )}
          </div>
        )}

        {/* Error banner */}
        {globalError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '14px', color: '#dc2626', fontSize: '13px' }}>
            ⚠️ {globalError}
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: '#15803d', marginBottom: '6px' }}>
              Import สำเร็จ {result.imported} คัน
            </div>
            {result.skipped.length > 0 && (
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                ข้าม {result.skipped.length} คัน (ทะเบียนซ้ำ): {result.skipped.join(', ')}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'center' }}>
              <Link href="/owner/bikes" style={{
                background: '#111827', color: '#fff', borderRadius: '10px',
                padding: '10px 20px', textDecoration: 'none', fontWeight: 600, fontSize: '14px',
              }}>
                ดูรายการรถ →
              </Link>
              <button
                onClick={() => setResult(null)}
                style={{
                  background: '#f3f4f6', color: '#374151', border: 'none',
                  borderRadius: '10px', padding: '10px 20px', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
                }}
              >
                Import เพิ่ม
              </button>
            </div>
          </div>
        )}

        {/* Import button */}
        {validRows.length > 0 && !result && (
          <button
            onClick={handleImport}
            disabled={loading}
            style={{
              background: loading ? '#d1d5db' : '#111827',
              color: '#fff', border: 'none', borderRadius: '14px',
              padding: '16px', fontWeight: 700, fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {loading ? '⏳ กำลัง import...' : `📥 Import รถ ${validRows.length} คัน`}
          </button>
        )}

        {/* Divider */}
        <div style={{ borderTop: '2px dashed #e5e7eb', paddingTop: '16px' }}>
          <div style={{ fontWeight: 700, fontSize: '15px', color: '#111827', marginBottom: '12px' }}>
            📄 อัพโหลดรูปเอกสาร (ภาษี / พรบ / หน้าเล่ม)
          </div>
          <DocUploadSection />
        </div>

      </div>
    </div>
  )
}
