'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/AppLayout'

interface Bike { id: string; license_plate: string; brand: string; model: string; daily_rate: number }
interface Customer { id: string; name: string; phone: string }

export default function NewRentalPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [bikes, setBikes] = useState<Bike[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [form, setForm] = useState({
    bike_id: '',
    customer_id: '',
    start_datetime: toDatetimeLocal(new Date()),
    expected_end_datetime: toDatetimeLocal(new Date(Date.now() + 86400000)),
    daily_rate: '',
    deposit: '',
    paid_amount: '',
    notes: '',
  })

  useEffect(() => {
    supabase.from('bikes').select('id, license_plate, brand, model, daily_rate').eq('status', 'available').order('license_plate').then(({ data }) => setBikes(data ?? []))
    supabase.from('customers').select('id, name, phone').order('name').then(({ data }) => setCustomers(data ?? []))
  }, [])

  function set(field: string, value: string) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'bike_id') {
        const bike = bikes.find(b => b.id === value)
        if (bike) next.daily_rate = String(bike.daily_rate)
      }
      return next
    })
  }

  const days = form.start_datetime && form.expected_end_datetime
    ? Math.max(1, Math.ceil((new Date(form.expected_end_datetime).getTime() - new Date(form.start_datetime).getTime()) / 86400000))
    : 0
  const total = days * (parseFloat(form.daily_rate) || 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.bike_id || !form.customer_id || !form.start_datetime || !form.expected_end_datetime || !form.daily_rate) {
      setError('กรุณากรอกข้อมูลที่จำเป็นให้ครบ')
      return
    }
    setLoading(true)
    setError('')

    const { error: rentErr } = await supabase.from('rentals').insert({
      bike_id: form.bike_id,
      customer_id: form.customer_id,
      start_datetime: new Date(form.start_datetime).toISOString(),
      expected_end_datetime: new Date(form.expected_end_datetime).toISOString(),
      daily_rate: parseFloat(form.daily_rate),
      deposit: form.deposit ? parseFloat(form.deposit) : null,
      paid_amount: form.paid_amount ? parseFloat(form.paid_amount) : 0,
      status: 'active',
      notes: form.notes || null,
    })

    if (rentErr) {
      setError(rentErr.message)
      setLoading(false)
      return
    }

    await supabase.from('bikes').update({ status: 'rented' }).eq('id', form.bike_id)
    router.push('/rentals')
    router.refresh()
  }

  const selectedBike = bikes.find(b => b.id === form.bike_id)

  return (
    <AppLayout title="สร้างการเช่าใหม่" subtitle="กรอกข้อมูลการเช่า" backHref="/rentals" headerStyle="blue">
      <form onSubmit={handleSubmit} style={{ padding: '12px' }}>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', marginBottom: '12px', color: '#dc2626', fontSize: '13px' }}>
            ⚠️ {error}
          </div>
        )}

        {/* เลือกรถ */}
        <div style={cardStyle}>
          <SectionTitle>🏍️ เลือกรถ</SectionTitle>
          <Field label="รถ *">
            <select style={inputStyle} value={form.bike_id} onChange={e => set('bike_id', e.target.value)}>
              <option value="">-- เลือกรถ --</option>
              {bikes.map(b => (
                <option key={b.id} value={b.id}>{b.license_plate} — {b.brand} {b.model} (฿{b.daily_rate}/วัน)</option>
              ))}
            </select>
          </Field>
          {selectedBike && (
            <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#1d4ed8' }}>
              🏍️ {selectedBike.license_plate} — {selectedBike.brand} {selectedBike.model} • ฿{selectedBike.daily_rate}/วัน
            </div>
          )}
        </div>

        {/* เลือกลูกค้า */}
        <div style={cardStyle}>
          <SectionTitle>👤 ลูกค้า</SectionTitle>
          <Field label="ลูกค้า *">
            <select style={inputStyle} value={form.customer_id} onChange={e => set('customer_id', e.target.value)}>
              <option value="">-- เลือกลูกค้า --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
              ))}
            </select>
          </Field>
          <div style={{ textAlign: 'right' }}>
            <a href="/customers/new" style={{ fontSize: '12px', color: '#2563eb', textDecoration: 'none' }}>+ เพิ่มลูกค้าใหม่</a>
          </div>
        </div>

        {/* วันเวลา */}
        <div style={cardStyle}>
          <SectionTitle>📅 ช่วงเวลา</SectionTitle>
          <Field label="วันเริ่มเช่า *">
            <input style={inputStyle} type="datetime-local" value={form.start_datetime} onChange={e => set('start_datetime', e.target.value)} />
          </Field>
          <Field label="กำหนดคืนรถ *" style={{ marginBottom: 0 }}>
            <input style={inputStyle} type="datetime-local" value={form.expected_end_datetime} onChange={e => set('expected_end_datetime', e.target.value)} />
          </Field>
          {days > 0 && (
            <div style={{ marginTop: '10px', fontSize: '13px', color: '#6b7280', textAlign: 'center' }}>
              📆 รวม <strong style={{ color: '#2563eb' }}>{days} วัน</strong>
            </div>
          )}
        </div>

        {/* ราคา */}
        <div style={cardStyle}>
          <SectionTitle>💰 ราคาและการชำระ</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="ราคา/วัน (บาท) *">
              <input style={inputStyle} type="number" placeholder="200" value={form.daily_rate} onChange={e => set('daily_rate', e.target.value)} />
            </Field>
            <Field label="มัดจำ (บาท)">
              <input style={inputStyle} type="number" placeholder="0" value={form.deposit} onChange={e => set('deposit', e.target.value)} />
            </Field>
          </div>
          <Field label="รับเงินแล้ว (บาท)">
            <input style={inputStyle} type="number" placeholder="0" value={form.paid_amount} onChange={e => set('paid_amount', e.target.value)} />
          </Field>

          {total > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #0891b2, #0e7490)',
              color: '#fff', borderRadius: '12px', padding: '14px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '13px', opacity: 0.85 }}>ยอดรวมค่าเช่า</div>
              <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '4px' }}>฿{total.toLocaleString()}</div>
              <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>
                {selectedBike?.license_plate} • {days} วัน
              </div>
            </div>
          )}
        </div>

        {/* หมายเหตุ */}
        <div style={cardStyle}>
          <SectionTitle>📝 หมายเหตุ</SectionTitle>
          <textarea
            style={{ ...inputStyle, resize: 'vertical', minHeight: '72px' }}
            placeholder="เช่น ลูกค้าขอรถสีดำ, ต้องการ GPS..."
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', padding: '14px', borderRadius: '10px',
            border: 'none', background: loading ? '#93c5fd' : '#2563eb',
            color: '#fff', fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: '8px',
          }}
        >
          {loading ? '⏳ กำลังบันทึก...' : '🛵 สร้างการเช่า'}
        </button>
      </form>
    </AppLayout>
  )
}

function toDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: '12px', padding: '16px',
  marginBottom: '12px', border: '1px solid #e5e7eb',
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px',
  padding: '10px 12px', fontSize: '14px', color: '#111827',
  background: '#fff', outline: 'none', boxSizing: 'border-box',
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
      {children}
    </div>
  )
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ marginBottom: '10px', ...style }}>
      <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '5px' }}>{label}</label>
      {children}
    </div>
  )
}
