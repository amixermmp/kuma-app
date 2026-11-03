'use client'

import type { CardChoice } from '@/lib/dailySwitch'

// กรอบเตือน "ลูกค้าวางบัตรประชาชนไว้ แต่เกณฑ์นี้ต้องมัดจำเงินสด" — ใช้ร่วมกันทุกหน้า (ต่อเวลา/แปลงเป็นรายเดือน/ต่อเป็นรายวัน)
// กติกาอยู่ที่ checkCardGate ใน lib/dailySwitch.ts (API ตรวจซ้ำเอง) คอมโพเนนต์นี้แค่เก็บคำตอบ
export default function CardDepositGate({ choice, onChoice, confirmKeep, onConfirmKeep, why }: {
  choice: CardChoice | null
  onChoice: (c: CardChoice) => void
  confirmKeep: boolean
  onConfirmKeep: (v: boolean) => void
  why: string
}) {
  const optionStyle = (on: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
    border: `1.5px solid ${on ? '#1d4ed8' : '#e5e7eb'}`, background: on ? '#eff6ff' : '#fff', marginTop: '8px',
  })
  return (
    <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: '12px', padding: '12px 14px' }}>
      <div style={{ fontSize: '14px', fontWeight: 800, color: '#92400e' }}>🪪 ลูกค้าวางบัตรประชาชนไว้แทนมัดจำ</div>
      <div style={{ fontSize: '12px', color: '#92400e', marginTop: '2px', lineHeight: 1.6 }}>
        {why} ต้องมัดจำเงินสด วางบัตรแทนไม่ได้ — เลือก 1 ทาง
      </div>

      <label style={optionStyle(choice === 'cash')}>
        <input type="radio" name="card-gate" checked={choice === 'cash'} onChange={() => onChoice('cash')} style={{ marginTop: 3 }} />
        <span style={{ fontSize: '13px', color: '#111827' }}>
          <strong>เปลี่ยนเป็นมัดจำเงินสด</strong>
          <span style={{ display: 'block', fontSize: '12px', color: '#6b7280' }}>ลูกค้านำเงินสดมาแลกบัตร — เก็บมัดจำแล้ว <strong>คืนบัตรให้ลูกค้าเลย</strong></span>
        </span>
      </label>

      <label style={optionStyle(choice === 'keep_card')}>
        <input type="radio" name="card-gate" checked={choice === 'keep_card'} onChange={() => onChoice('keep_card')} style={{ marginTop: 3 }} />
        <span style={{ fontSize: '13px', color: '#111827' }}>
          <strong>ให้คงบัตรไว้ต่อ (ต้องผู้จัดการยืนยัน)</strong>
          <span style={{ display: 'block', fontSize: '12px', color: '#6b7280' }}>ไม่เก็บมัดจำเงินสด บัตรอยู่ที่ร้านต่อ — ระบบบันทึกว่าใช้ข้อยกเว้นนี้</span>
        </span>
      </label>

      {choice === 'keep_card' && (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '10px', cursor: 'pointer' }}>
          <input type="checkbox" checked={confirmKeep} onChange={e => onConfirmKeep(e.target.checked)} style={{ width: '18px', height: '18px', marginTop: 1 }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#b45309' }}>ผู้จัดการยืนยันแล้ว ให้ลูกค้าคงบัตรไว้เป็นมัดจำต่อได้</span>
        </label>
      )}
    </div>
  )
}
