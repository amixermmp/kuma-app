'use client'

import { useState } from 'react'
import { Toggle, SettingsHeader } from '../_shared'

type BranchRow = {
  id: string
  name: string
  enabled: boolean
}

export default function LineChatbotClient({ branches }: { branches: BranchRow[] }) {
  const [states, setStates] = useState<Record<string, boolean>>(
    Object.fromEntries(branches.map(b => [b.id, b.enabled]))
  )
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [msgs, setMsgs] = useState<Record<string, string>>({})

  const toggle = async (branchId: string) => {
    const next = !states[branchId]
    setStates(s => ({ ...s, [branchId]: next }))
    setSaving(s => ({ ...s, [branchId]: true }))
    setMsgs(s => ({ ...s, [branchId]: '' }))

    const res = await fetch('/api/owner/settings/line-bot-toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_id: branchId, enabled: next }),
    })

    setSaving(s => ({ ...s, [branchId]: false }))
    if (!res.ok) {
      // revert on error
      setStates(s => ({ ...s, [branchId]: !next }))
      setMsgs(s => ({ ...s, [branchId]: '❌ บันทึกไม่สำเร็จ' }))
    } else {
      setMsgs(s => ({ ...s, [branchId]: next ? '✅ เปิดแล้ว' : '✅ ปิดแล้ว' }))
    }
    setTimeout(() => setMsgs(s => ({ ...s, [branchId]: '' })), 2500)
  }

  return (
    <div className="app-wrap">
      <SettingsHeader title="LINE Chatbot" sub="เปิด/ปิด AI ตอบแชท รายสาขา" />

      <div style={{ margin: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px', lineHeight: 1.6 }}>
          เมื่อเปิด — Claude จะตอบแชท LINE อัตโนมัติ<br />
          เมื่อปิด — ข้อความจะถูกรับแต่ไม่มีการตอบกลับ (staff ตอบเอง)
        </div>

        {branches.map(b => {
          const on = states[b.id]
          const isSaving = saving[b.id]
          const msg = msgs[b.id]
          return (
            <div key={b.id} style={{
              background: '#fff', borderRadius: '14px', padding: '16px',
              boxShadow: '0 1px 4px rgba(0,0,0,.07)',
              display: 'flex', alignItems: 'center', gap: '14px',
              borderLeft: `4px solid ${on ? '#00b900' : '#d1d5db'}`,
            }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                background: on ? '#f0fdf4' : '#f9fafb',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
              }}>💬</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>{b.name}</div>
                <div style={{ fontSize: '12px', marginTop: '2px', color: on ? '#16a34a' : '#9ca3af' }}>
                  {isSaving ? '⏳ กำลังบันทึก...' : msg || (on ? 'Bot กำลังทำงาน' : 'Bot ปิดอยู่ — staff ตอบเอง')}
                </div>
              </div>
              <Toggle on={on} onClick={() => !isSaving && toggle(b.id)} />
            </div>
          )
        })}

        {branches.length === 0 && (
          <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '14px', padding: '40px 0' }}>
            ไม่พบข้อมูลสาขา
          </div>
        )}
      </div>
    </div>
  )
}
