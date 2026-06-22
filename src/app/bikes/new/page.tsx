'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/AppLayout'

export default function NewBikePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    license_plate: '',
    brand: '',
    model: '',
    color: '',
    year: '',
    daily_rate: '',
    monthly_rate: '',
    status: 'available',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.license_plate || !form.brand || !form.model || !form.daily_rate) {
      setError('กรุณากรอกข้อมูลที่จำเป็น: ทะเบียน, ยี่ห้อ, รุ่น, ราคา/วัน')
      return
    }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.from('bikes').insert({
      license_plate: form.license_plate.trim().toUpperCase(),
      brand: form.brand.trim(),
      model: form.model.trim(),
      color: form.color.trim() || null,
      year: form.year ? parseInt(form.year) : null,
      daily_rate: parseFloat(form.daily_rate),
      monthly_rate: form.monthly_rate ? parseFloat(form.monthly_rate) : null,
      status: form.status,
    })
    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      router.push('/bikes')
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

        <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '12px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
            ข้อมูลรถ
          </div>

          <Field label="เลขทะเบียน *" required>
            <input style={inputStyle} placeholder="เช่น กข 1234" value={form.license_plate} onChange={e => set('license_plate', e.target.value)} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="ยี่ห้อ *" required>
              <input style={inputStyle} placeholder="Honda, Yamaha..." value={form.brand} onChange={e => set('brand', e.target.value)} />
            </Field>
            <Field label="รุ่น *" required>
              <input style={inputStyle} placeholder="PCX 160, NMAX..." value={form.model} onChange={e => set('model', e.target.value)} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="สี">
              <input style={inputStyle} placeholder="ดำ, ขาว, แดง..." value={form.color} onChange={e => set('color', e.target.value)} />
            </Field>
            <Field label="ปี">
              <input style={inputStyle} type="number" placeholder="2023" value={form.year} onChange={e => set('year', e.target.value)} />
            </Field>
          </div>
          <Field label="สถานะ">
            <select style={inputStyle} value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="available">ว่าง (พร้อมเช่า)</option>
              <option value="maintenance">ซ่อม</option>
            </select>
          </Field>
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '16px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
            💰 ราคา
          </div>
          <Field label="ราคา / วัน (บาท) *" required>
            <input style={inputStyle} type="number" placeholder="200" value={form.daily_rate} onChange={e => set('daily_rate', e.target.value)} />
          </Field>
          <Field label="ราคา / เดือน (บาท)" style={{ marginBottom: 0 }}>
            <input style={inputStyle} type="number" placeholder="3500" value={form.monthly_rate} onChange={e => set('monthly_rate', e.target.value)} />
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

function Field({ label, children, required, style }: { label: string; children: React.ReactNode; required?: boolean; style?: React.CSSProperties }) {
  return (
    <div style={{ marginBottom: '12px', ...style }}>
      <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '5px' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
