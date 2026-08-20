'use client'

import { useState } from 'react'
import { Section, Field, SaveBtn, Toggle, SettingsHeader, type Branch } from '../_shared'

type Shop = Record<string, any>
type BranchLine = { branch_id: string; line_token: string | null; line_liff_id: string | null; promptpay_id: string | null; line_notify_customer: boolean | null }

function BranchLineCard({ branch, initial }: { branch: Branch; initial?: BranchLine }) {
  const [token, setToken] = useState(initial?.line_token ?? '')
  const [liffId, setLiffId] = useState(initial?.line_liff_id ?? '')
  const [promptpay, setPromptpay] = useState(initial?.promptpay_id ?? '')
  const [notify, setNotify] = useState(initial?.line_notify_customer ?? true)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const save = async () => {
    setLoading(true); setMsg('')
    const res = await fetch('/api/owner/settings/branch-line', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_id: branch.id,
        line_token: token, line_liff_id: liffId,
        promptpay_id: promptpay, line_notify_customer: notify,
      }),
    })
    setLoading(false)
    setMsg(res.ok ? '✅ บันทึกแล้ว' : '❌ เกิดข้อผิดพลาด')
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div style={{ border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <span style={{ fontWeight: 800, fontSize: '14px', color: '#111827', flex: 1 }}>📍 {branch.name}</span>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>แจ้งเตือนลูกค้า</span>
        <Toggle on={notify} onClick={() => setNotify(!notify)} />
      </div>
      <Field label="Channel Access Token (OA ของสาขานี้)">
        <input className="field-input" type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="วางจาก LINE Developers Console" />
      </Field>
      <Field label="LIFF ID" hint="สร้าง LIFF app ของสาขานี้ แล้ว copy LIFF ID มาใส่">
        <input className="field-input" value={liffId} onChange={e => setLiffId(e.target.value)} placeholder="เช่น 1234567890-AbcdEfgh" />
      </Field>
      <Field label="PromptPay" hint="เบอร์โทร หรือ เลขบัตรประชาชน ที่รับเงินของสาขานี้">
        <input className="field-input" value={promptpay} onChange={e => setPromptpay(e.target.value)} placeholder="08x-xxx-xxxx" />
      </Field>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <SaveBtn loading={loading} onClick={save} />
        {msg && <span style={{ fontSize: '13px', color: msg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{msg}</span>}
      </div>
    </div>
  )
}

export default function NotificationsClient({ shop, branches, branchLine }: { shop: Shop; branches: Branch[]; branchLine: BranchLine[] }) {
  const [docDays, setDocDays] = useState(String(shop.doc_alert_days ?? 30))
  const [overdueHours, setOverdueHours] = useState(String(shop.overdue_alert_hours ?? 2))
  const [thresholdLoading, setThresholdLoading] = useState(false)
  const [thresholdMsg, setThresholdMsg] = useState('')

  const [lineToken, setLineToken] = useState(shop.line_token ?? '')
  const [lineTarget, setLineTarget] = useState(shop.line_target_id ?? '')
  const [lineOverdue, setLineOverdue] = useState(shop.line_notify_overdue ?? true)
  const [lineDocs, setLineDocs] = useState(shop.line_notify_docs ?? true)
  const [lineMonthly, setLineMonthly] = useState(shop.line_notify_monthly ?? true)
  const [lineBroken, setLineBroken] = useState(shop.line_notify_broken ?? false)
  const [lineRoutine, setLineRoutine] = useState(shop.line_notify_routine ?? true)
  const [lineLoading, setLineLoading] = useState(false)
  const [lineMsg, setLineMsg] = useState('')

  const saveThresholds = async () => {
    setThresholdLoading(true); setThresholdMsg('')
    const res = await fetch('/api/owner/settings/shop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doc_alert_days: parseInt(docDays) || 30,
        overdue_alert_hours: parseInt(overdueHours) || 2,
      }),
    })
    setThresholdLoading(false)
    setThresholdMsg(res.ok ? '✅ บันทึกแล้ว' : '❌ เกิดข้อผิดพลาด')
    setTimeout(() => setThresholdMsg(''), 3000)
  }

  const saveLine = async () => {
    setLineLoading(true); setLineMsg('')
    const res = await fetch('/api/owner/settings/shop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        line_token: lineToken, line_target_id: lineTarget,
        line_notify_overdue: lineOverdue, line_notify_docs: lineDocs,
        line_notify_monthly: lineMonthly, line_notify_broken: lineBroken,
        line_notify_routine: lineRoutine,
      }),
    })
    setLineLoading(false)
    setLineMsg(res.ok ? '✅ บันทึกแล้ว' : '❌ เกิดข้อผิดพลาด')
    setTimeout(() => setLineMsg(''), 3000)
  }

  return (
    <>
      <SettingsHeader title="🔔 แจ้งเตือน" sub="เกณฑ์แจ้งเตือน + LINE ทั้งร้าน/รายสาขา" />

      <div style={{ paddingBottom: '40px' }}>
        <Section title="การแจ้งเตือน">
          <div style={{ padding: '12px 16px' }}>
            <Field label="แจ้งเตือนก่อนเอกสารหมดอายุ (วัน)">
              <input className="field-input" type="number" value={docDays} onChange={e => setDocDays(e.target.value)} />
            </Field>
            <Field label="แจ้งเตือนเมื่อลูกค้าเกินกำหนดคืน (ชม.)">
              <input className="field-input" type="number" value={overdueHours} onChange={e => setOverdueHours(e.target.value)} />
            </Field>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <SaveBtn loading={thresholdLoading} onClick={saveThresholds} />
              {thresholdMsg && <span style={{ fontSize: '13px', color: thresholdMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{thresholdMsg}</span>}
            </div>
          </div>
        </Section>

        <Section title="LINE Notification">
          <div style={{ margin: '12px 16px 0', background: '#f0fdf4', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#166534', border: '1px solid #bbf7d0' }}>
            ระบบจะส่งแจ้งเตือนเข้า LINE OA อัตโนมัติสำหรับ event สำคัญ
          </div>
          <div style={{ padding: '12px 16px' }}>
            <Field label="LINE Channel Access Token">
              <input className="field-input" type="password" value={lineToken} onChange={e => setLineToken(e.target.value)} placeholder="วางได้จาก LINE Developers Console" />
            </Field>
            <Field label="LINE Group / User ID" hint="เพิ่มบอทเข้ากลุ่มไลน์ Staff แล้ว copy Group ID มาใส่">
              <input className="field-input" value={lineTarget} onChange={e => setLineTarget(e.target.value)} placeholder="C... หรือ U..." />
            </Field>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>เปิดแจ้งเตือนสำหรับ</div>
            {[
              { label: '⏰ ลูกค้าเกินกำหนดคืนรถ', val: lineOverdue, set: setLineOverdue },
              { label: '📄 เอกสารรถใกล้หมดอายุ', val: lineDocs, set: setLineDocs },
              { label: '🔧 งานเซอร์วิสถึงกำหนด (น้ำมันเครื่อง ฯลฯ)', val: lineRoutine, set: setLineRoutine },
              { label: '💜 ค่าเช่ารายเดือนค้างชำระ', val: lineMonthly, set: setLineMonthly },
              { label: '🛵💥 มีแจ้งรถเสียใหม่', val: lineBroken, set: setLineBroken },
            ].map(({ label, val, set }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
                <span style={{ flex: 1, fontSize: '14px' }}>{label}</span>
                <Toggle on={val} onClick={() => set(!val)} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button className="btn" style={{ flex: 1, border: '1.5px solid #00b900', color: '#00b900', background: '#fff' }}>
                🧪 ทดสอบส่ง LINE
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
              <SaveBtn loading={lineLoading} onClick={saveLine} />
              {lineMsg && <span style={{ fontSize: '13px', color: lineMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{lineMsg}</span>}
            </div>
          </div>
        </Section>

        <Section title="LINE แจ้งเตือนลูกค้า (รายสาขา)">
          <div style={{ margin: '12px 16px 0', background: '#f0fdf4', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#166534', border: '1px solid #bbf7d0' }}>
            แต่ละสาขาใช้ LINE OA ของตัวเอง — ระบบจะเตือนลูกค้าก่อนครบกำหนดคืนรถ
            และทวงเงินพร้อม QR PromptPay เมื่อเกินกำหนด
          </div>
          <div style={{ padding: '12px 16px' }}>
            {branches.map(b => (
              <BranchLineCard key={b.id} branch={b} initial={branchLine.find(l => l.branch_id === b.id)} />
            ))}
          </div>
        </Section>
      </div>
    </>
  )
}
