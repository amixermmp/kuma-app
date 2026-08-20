'use client'

import { useState } from 'react'
import { Section, Field, SaveBtn, SettingsHeader, type Branch } from '../_shared'

type Staff = { id: string; name: string; pin: string; branch_id: string | null; allowed_branch_ids: string[] | null; is_active: boolean; branches?: { name: string } | null }

function StaffModal({ branches, onClose, onSaved, editing }: {
  branches: Branch[]
  onClose: () => void
  onSaved: (staff: Staff) => void
  editing?: Staff
}) {
  const [name, setName] = useState(editing?.name ?? '')
  const [pin, setPin] = useState(editing?.pin ?? '')
  const [allowedBranchIds, setAllowedBranchIds] = useState<string[]>(editing?.allowed_branch_ids ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toggleBranch = (id: string) =>
    setAllowedBranchIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const save = async () => {
    if (!name.trim()) { setError('กรุณาใส่ชื่อ'); return }
    if (pin.length !== 6) { setError('PIN ต้องมี 6 หลัก'); return }
    setLoading(true); setError('')
    const url = editing ? `/api/owner/settings/staff/${editing.id}` : '/api/owner/settings/staff'
    const payload = { name: name.trim(), pin, allowed_branch_ids: allowedBranchIds.length > 0 ? allowedBranchIds : null }
    const res = await fetch(url, {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'เกิดข้อผิดพลาด'); setLoading(false); return }
    const result: Staff = editing
      ? { ...editing, ...payload }
      : { id: data.id ?? crypto.randomUUID(), ...payload, branch_id: null, is_active: true, branches: null }
    onSaved(result)
  }

  const deactivate = async () => {
    if (!editing) return
    if (!confirm(`ปิดการใช้งาน ${editing.name}?`)) return
    await fetch(`/api/owner/settings/staff/${editing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: false }),
    })
    onSaved({ ...editing, is_active: false })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 999, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', width: '100%', borderRadius: '16px 16px 0 0', padding: '20px 16px 32px' }}>
        <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '16px' }}>
          {editing ? 'แก้ไขพนักงาน' : '+ เพิ่มพนักงาน'}
        </div>
        <Field label="ชื่อ - นามสกุล *">
          <input className="field-input" value={name} onChange={e => setName(e.target.value)} placeholder="สมชาย มีดี" />
        </Field>
        <Field label="PIN (6 หลัก) *" hint="พนักงานใช้ PIN นี้ scan QR รถเพื่อเข้าระบบ">
          <input className="field-input" type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" />
        </Field>
        {branches.length > 0 && (
          <Field label="สาขาที่เข้าถึงได้">
            {branches.map(b => (
              <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}>
                <input
                  type="checkbox"
                  checked={allowedBranchIds.includes(b.id)}
                  onChange={() => toggleBranch(b.id)}
                  style={{ width: '18px', height: '18px', accentColor: '#e11d48', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '14px', color: '#111827' }}>{b.name}</span>
              </label>
            ))}
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px' }}>
              ไม่เลือก = เข้าถึงได้ทุกสาขา
            </div>
          </Field>
        )}
        {error && <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>⚠️ {error}</div>}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose} className="btn" style={{ flex: 1, background: '#f3f4f6', color: '#374151' }}>ยกเลิก</button>
          <SaveBtn loading={loading} onClick={save} label={editing ? '💾 บันทึก' : '+ เพิ่ม'} />
        </div>
        {editing && editing.is_active && (
          <button onClick={deactivate} style={{ marginTop: '10px', width: '100%', background: 'none', border: 'none', color: '#dc2626', fontSize: '13px', cursor: 'pointer' }}>
            ปิดการใช้งานพนักงานคนนี้
          </button>
        )}
      </div>
    </div>
  )
}

export default function StaffClient({ staff: initialStaff, branches }: { staff: Staff[]; branches: Branch[] }) {
  const [staff, setStaff] = useState(initialStaff)
  const [staffModal, setStaffModal] = useState<Staff | null | 'new'>(null)

  const reactivateStaff = async (s: Staff) => {
    setStaff(prev => prev.map(x => x.id === s.id ? { ...x, is_active: true } : x))
    await fetch(`/api/owner/settings/staff/${s.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: true }),
    })
  }

  const deleteStaff = async (s: Staff) => {
    if (!confirm(`ลบ ${s.name} ถาวร?\n\nพนักงานคนนี้จะเข้าระบบด้วย PIN ไม่ได้อีก\nแต่ประวัติงานที่เคยทำ (เช่า/ซ่อม/น้ำมันเครื่อง ฯลฯ) ยังอยู่ครบทุกอย่าง`)) return
    const res = await fetch(`/api/owner/settings/staff/${s.id}`, { method: 'DELETE' })
    if (res.ok) setStaff(prev => prev.filter(x => x.id !== s.id))
    else alert('ลบไม่สำเร็จ ลองใหม่อีกครั้ง')
  }

  return (
    <>
      <SettingsHeader title="👤 พนักงาน" sub="เพิ่ม/แก้ไข/ปิดการใช้งานพนักงาน" />

      <div style={{ paddingBottom: '40px' }}>
        <Section title="รายชื่อพนักงาน">
          {staff.filter(s => s.is_active).map(s => {
            const branchName = s.branches?.name
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#111827', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                  {s.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>PIN: {'•'.repeat(6)} {branchName ? `• ${branchName}` : ''}</div>
                </div>
                <button onClick={() => setStaffModal(s)} style={{ background: 'none', border: 'none', color: '#374151', fontSize: '13px', cursor: 'pointer' }}>แก้ไข</button>
              </div>
            )
          })}

          {staff.some(s => !s.is_active) && (
            <>
              <div style={{ padding: '12px 16px 4px', fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                ปิดใช้งานอยู่
              </div>
              {staff.filter(s => !s.is_active).map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid #f3f4f6', opacity: 0.65 }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#9ca3af', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                    {s.name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>ปิดใช้งาน (ประวัติงานยังอยู่ครบ)</div>
                  </div>
                  <button onClick={() => reactivateStaff(s)} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: '13px', fontWeight: 700, padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                    เปิดใช้งาน
                  </button>
                  <button onClick={() => deleteStaff(s)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '12px', cursor: 'pointer', padding: '4px' }}>
                    ลบถาวร
                  </button>
                </div>
              ))}
            </>
          )}

          <div style={{ padding: '12px 16px' }}>
            <button onClick={() => setStaffModal('new')} className="btn" style={{ border: '1.5px solid #374151', color: '#374151', background: '#fff', width: '100%' }}>
              + เพิ่มพนักงาน
            </button>
          </div>
        </Section>
      </div>

      {staffModal && (
        <StaffModal
          branches={branches}
          editing={staffModal === 'new' ? undefined : staffModal}
          onClose={() => setStaffModal(null)}
          onSaved={(saved) => {
            setStaffModal(null)
            setStaff(prev => {
              const exists = prev.find(s => s.id === saved.id)
              if (exists) return prev.map(s => s.id === saved.id ? saved : s)
              return [...prev, saved]
            })
          }}
        />
      )}
    </>
  )
}
