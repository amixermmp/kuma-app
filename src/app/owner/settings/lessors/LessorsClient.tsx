'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SettingsHeader } from '../_shared'
import SignaturePad from '@/components/SignaturePad'

type Lessor = { id: string; name: string; id_card_number: string; signature_data: string | null }

function LessorCard({ lessor }: { lessor: Lessor }) {
  const router = useRouter()
  const [showSignPad, setShowSignPad] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const saveSignature = async (dataUrl: string) => {
    setShowSignPad(false)
    setLoading(true)
    const res = await fetch('/api/owner/settings/lessors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sign', id: lessor.id, signatureData: dataUrl }),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) { setMsg('✅ บันทึกลายเซ็นแล้ว'); router.refresh() }
    else setMsg('❌ ' + (data.error ?? 'เกิดข้อผิดพลาด'))
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div style={{
      border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '14px', marginBottom: '10px', background: '#fff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>👤 {lessor.name}</span>
        {msg && <span style={{ fontSize: '12px', color: msg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{msg}</span>}
      </div>
      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '10px' }}>
        เลขบัตรประชาชน: {lessor.id_card_number}
      </div>

      {lessor.signature_data ? (
        <div>
          <div style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '8px', height: '80px', overflow: 'hidden', marginBottom: '8px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lessor.signature_data} alt="ลายเซ็น" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <button onClick={() => setShowSignPad(true)} disabled={loading} className="btn" style={{ width: '100%', padding: '8px', fontSize: '13px' }}>
            เซ็นใหม่
          </button>
        </div>
      ) : (
        <button onClick={() => setShowSignPad(true)} disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '8px', fontSize: '13px' }}>
          ✏️ แตะเพื่อเซ็นชื่อ
        </button>
      )}

      {showSignPad && (
        <SignaturePad onSave={saveSignature} onClose={() => setShowSignPad(false)} />
      )}
    </div>
  )
}

function AddLessorForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [idCardNumber, setIdCardNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const submit = async () => {
    if (!name.trim() || !idCardNumber.trim()) { setMsg('❌ กรุณากรอกชื่อและเลขบัตรประชาชน'); return }
    setLoading(true)
    const res = await fetch('/api/owner/settings/lessors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', name, idCardNumber }),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) { setName(''); setIdCardNumber(''); setOpen(false); router.refresh() }
    else setMsg('❌ ' + (data.error ?? 'เกิดข้อผิดพลาด'))
    setTimeout(() => setMsg(''), 3000)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn" style={{ width: '100%', padding: '10px', fontSize: '13px' }}>
        + เพิ่มผู้ให้เช่าใหม่
      </button>
    )
  }

  return (
    <div style={{ border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '14px', background: '#f9fafb' }}>
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>ชื่อ-นามสกุล</div>
        <input className="field-input" type="text" placeholder="เช่น สมชาย ใจดี" value={name}
          onChange={e => setName(e.target.value)} style={{ fontSize: '13px', padding: '8px' }} />
      </div>
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>เลขบัตรประชาชน 13 หลัก</div>
        <input className="field-input" type="text" placeholder="เช่น 1234567890123" value={idCardNumber}
          onChange={e => setIdCardNumber(e.target.value)} style={{ fontSize: '13px', padding: '8px' }} />
      </div>
      {msg && <div style={{ fontSize: '12px', color: '#dc2626', marginBottom: '8px' }}>{msg}</div>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={submit} disabled={loading} className="btn btn-primary" style={{ flex: 1, padding: '8px', fontSize: '13px' }}>
          {loading ? '⏳' : '💾 บันทึก'}
        </button>
        <button onClick={() => setOpen(false)} style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>
          ยกเลิก
        </button>
      </div>
    </div>
  )
}

export default function LessorsClient({ lessors }: { lessors: Lessor[] }) {
  return (
    <>
      <SettingsHeader title="👤 ผู้ให้เช่า" sub="รายชื่อเจ้าของรถที่ใช้ในสัญญาเช่า — เลือกได้ตอนแก้ไขรถแต่ละคัน" />
      <div style={{ padding: '12px 16px 40px' }}>
        {lessors.map(l => <LessorCard key={l.id} lessor={l} />)}
        <AddLessorForm />
      </div>
    </>
  )
}
