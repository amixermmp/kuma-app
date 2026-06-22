'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/AppLayout'

const BRANDS = ['Honda', 'Yamaha', 'Kawasaki', 'Suzuki', 'Ducati', 'BMW', 'KTM', 'Royal Enfield']

export default function NewBikePage() {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')

  const [form, setForm] = useState({
    license_plate: '',
    brand: 'Honda',
    model: '',
    color: '',
    year: '',
    branch_id: '',
    daily_rate: '',
    monthly_rate: '',
    status: 'available',
    odometer: '',
    oil_change_km: '3000',
    oil_change_days: '90',
    last_oil_change_km: '0',
    compulsory_expiry: '',
    insurance_expiry: '',
    tax_expiry: '',
  })

  useEffect(() => {
    supabase.from('branches').select('id, name').order('name').then(({ data }) => {
      if (data && data.length > 0) {
        setBranches(data)
        setForm(f => ({ ...f, branch_id: data[0].id }))
      }
    })
  }, [])

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.license_plate || !form.brand || !form.model || !form.daily_rate) {
      setError('กรุณากรอก: ทะเบียน, ยี่ห้อ, รุ่น, ราคา/วัน')
      return
    }
    setLoading(true)
    setError('')

    let photo_url: string | null = null
    if (photoFile) {
      const ext = photoFile.name.split('.').pop()
      const path = `bikes/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('bike-photos').upload(path, photoFile)
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('bike-photos').getPublicUrl(path)
        photo_url = urlData.publicUrl
      }
    }

    const { data, error: err } = await supabase.from('bikes').insert({
      license_plate: form.license_plate.trim().toUpperCase(),
      brand: form.brand,
      model: form.model.trim(),
      color: form.color.trim() || null,
      year: form.year ? parseInt(form.year) : null,
      branch_id: form.branch_id || null,
      daily_rate: parseFloat(form.daily_rate),
      monthly_rate: form.monthly_rate ? parseFloat(form.monthly_rate) : null,
      status: form.status,
      odometer: form.odometer ? parseInt(form.odometer) : 0,
      oil_change_km: parseInt(form.oil_change_km) || 3000,
      oil_change_days: parseInt(form.oil_change_days) || 90,
      last_oil_change_km: parseInt(form.last_oil_change_km) || 0,
      compulsory_expiry: form.compulsory_expiry || null,
      insurance_expiry: form.insurance_expiry || null,
      tax_expiry: form.tax_expiry || null,
      photo_url,
    }).select('id').single()

    if (err) {
      if (err.code === '23505') setError('ทะเบียนนี้มีในระบบแล้ว')
      else setError(err.message)
      setLoading(false)
    } else {
      router.push(`/bikes/${data.id}`)
      router.refresh()
    }
  }

  return (
    <AppLayout title="เพิ่มรถใหม่" subtitle="กรอกข้อมูลรถที่ต้องการเพิ่มเข้าระบบ" backHref="/bikes" headerStyle="dark">
      <form onSubmit={handleSubmit} style={{ padding: '12px' }}>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', marginBottom: '12px', color: '#dc2626', fontSize: '13px' }}>
            ⚠️ {error}
          </div>
        )}

        {/* รูปภาพรถ */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '12px', border: '1px solid #e5e7eb' }}>
          <div style={sectionTitle}>รูปภาพรถ</div>
          {photoPreview ? (
            <div>
              <img src={photoPreview} alt="รูปรถ" style={{ width: '100%', borderRadius: '10px', maxHeight: '200px', objectFit: 'cover' }} />
              <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview('') }}
                style={{ marginTop: '8px', background: 'none', border: 'none', color: '#dc2626', fontSize: '13px', cursor: 'pointer' }}>
                ✕ ลบรูป
              </button>
            </div>
          ) : (
            <label style={{ cursor: 'pointer' }}>
              <div style={uploadBox}>
                <div style={{ fontSize: '32px', marginBottom: '6px' }}>📷</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>แตะเพื่อถ่ายรูปหรืออัพโหลดรูปรถ</div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
            </label>
          )}
        </div>

        {/* ข้อมูลรถ */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '12px', border: '1px solid #e5e7eb' }}>
          <div style={sectionTitle}>ข้อมูลรถ</div>

          <Field label="เลขทะเบียน *">
            <input style={inputStyle} placeholder="กข 1234" value={form.license_plate} onChange={e => set('license_plate', e.target.value)} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="ยี่ห้อ *">
              <select style={inputStyle} value={form.brand} onChange={e => set('brand', e.target.value)}>
                {BRANDS.map(b => <option key={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="รุ่น *">
              <input style={inputStyle} placeholder="PCX 160" value={form.model} onChange={e => set('model', e.target.value)} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="ปีรถ">
              <input style={inputStyle} type="number" placeholder="2023" value={form.year} onChange={e => set('year', e.target.value)} />
            </Field>
            <Field label="สี">
              <input style={inputStyle} placeholder="ขาว" value={form.color} onChange={e => set('color', e.target.value)} />
            </Field>
          </div>

          {branches.length > 0 && (
            <Field label="สาขา *">
              <select style={inputStyle} value={form.branch_id} onChange={e => set('branch_id', e.target.value)}>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
          )}

          <Field label="สถานะ" style={{ marginBottom: 0 }}>
            <select style={inputStyle} value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="available">ว่าง (พร้อมเช่า)</option>
              <option value="maintenance">ซ่อม</option>
            </select>
          </Field>
        </div>

        {/* ราคาเช่า */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '12px', border: '1px solid #e5e7eb' }}>
          <div style={sectionTitle}>💰 ราคาเช่า</div>
          <Field label="ราคาเช่าต่อวัน (บาท) *">
            <input style={inputStyle} type="number" placeholder="200" value={form.daily_rate} onChange={e => set('daily_rate', e.target.value)} />
          </Field>
          <Field label="ราคาเช่าต่อเดือน (บาท)" style={{ marginBottom: 0 }}>
            <input style={inputStyle} type="number" placeholder="3500" value={form.monthly_rate} onChange={e => set('monthly_rate', e.target.value)} />
          </Field>
        </div>

        {/* วงรอบซ่อมบำรุง */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '12px', border: '1px solid #e5e7eb' }}>
          <div style={sectionTitle}>🛢️ วงรอบซ่อมบำรุง</div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>ระบบจะแจ้งเตือนเมื่อถึงกำหนด</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="เปลี่ยนน้ำมัน (กม.)">
              <input style={inputStyle} type="number" placeholder="3000" value={form.oil_change_km} onChange={e => set('oil_change_km', e.target.value)} />
            </Field>
            <Field label="หรือทุก (วัน)">
              <input style={inputStyle} type="number" placeholder="90" value={form.oil_change_days} onChange={e => set('oil_change_days', e.target.value)} />
            </Field>
          </div>
          <Field label="เลขไมล์ปัจจุบัน" style={{ marginBottom: 0 }}>
            <input style={inputStyle} type="number" placeholder="5000" value={form.odometer} onChange={e => set('odometer', e.target.value)} />
          </Field>
        </div>

        {/* เอกสารประจำรถ */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '16px', border: '1px solid #e5e7eb' }}>
          <div style={sectionTitle}>📄 เอกสารประจำรถ</div>
          <Field label="🛡️ พ.ร.บ. — วันหมดอายุ">
            <input style={inputStyle} type="date" value={form.compulsory_expiry} onChange={e => set('compulsory_expiry', e.target.value)} />
          </Field>
          <Field label="📋 ประกันภัย — วันหมดอายุ">
            <input style={inputStyle} type="date" value={form.insurance_expiry} onChange={e => set('insurance_expiry', e.target.value)} />
          </Field>
          <Field label="💰 ภาษีประจำปี — วันหมดอายุ" style={{ marginBottom: 0 }}>
            <input style={inputStyle} type="date" value={form.tax_expiry} onChange={e => set('tax_expiry', e.target.value)} />
          </Field>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', padding: '14px', borderRadius: '10px',
            border: 'none', background: loading ? '#93c5fd' : '#2563eb',
            color: '#fff', fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '⏳ กำลังบันทึก...' : '💾 บันทึกรถใหม่'}
        </button>
      </form>
    </AppLayout>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px',
  padding: '10px 12px', fontSize: '14px', color: '#111827',
  background: '#fff', outline: 'none', boxSizing: 'border-box',
}

const sectionTitle: React.CSSProperties = {
  fontSize: '12px', fontWeight: 700, color: '#6b7280',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px',
}

const uploadBox: React.CSSProperties = {
  border: '2px dashed #d1d5db', borderRadius: '10px',
  padding: '24px', textAlign: 'center', background: '#f9fafb',
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ marginBottom: '12px', ...style }}>
      <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '5px' }}>{label}</label>
      {children}
    </div>
  )
}
