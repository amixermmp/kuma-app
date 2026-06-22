'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/AppLayout'

export default function NewCustomerPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', id_card: '', address: '' })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.phone) {
      setError('กรุณากรอกชื่อและเบอร์โทร')
      return
    }
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.from('customers').insert({
      name: form.name.trim(),
      phone: form.phone.trim(),
      id_card: form.id_card.trim() || null,
      address: form.address.trim() || null,
    }).select('id').single()

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      router.push(`/customers/${data.id}`)
      router.refresh()
    }
  }

  return (
    <AppLayout title="เพิ่มลูกค้าใหม่" subtitle="บันทึกข้อมูลลูกค้า" backHref="/customers" headerStyle="blue">
      <form onSubmit={handleSubmit} style={{ padding: '12px' }}>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', marginBottom: '12px', color: '#dc2626', fontSize: '13px' }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '12px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
            ข้อมูลลูกค้า
          </div>

          <Field label="ชื่อ - นามสกุล *">
            <input style={inputStyle} placeholder="สมชาย ดีใจ" value={form.name} onChange={e => set('name', e.target.value)} />
          </Field>
          <Field label="เบอร์โทรศัพท์ *">
            <input style={inputStyle} type="tel" placeholder="081-234-5678" value={form.phone} onChange={e => set('phone', e.target.value)} />
          </Field>
          <Field label="เลขบัตรประชาชน / พาสปอร์ต">
            <input style={inputStyle} placeholder="1-2345-67890-12-3" value={form.id_card} onChange={e => set('id_card', e.target.value)} />
          </Field>
          <Field label="ที่พัก / ที่อยู่" style={{ marginBottom: 0 }}>
            <input style={inputStyle} placeholder="โรงแรม / ที่พัก" value={form.address} onChange={e => set('address', e.target.value)} />
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
          {loading ? '⏳ กำลังบันทึก...' : '💾 บันทึกลูกค้าใหม่'}
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

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ marginBottom: '12px', ...style }}>
      <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '5px' }}>{label}</label>
      {children}
    </div>
  )
}
