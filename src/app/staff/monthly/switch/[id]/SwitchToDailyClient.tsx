'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cleanAmount } from '@/lib/monthlySettlement'
import { DAY_MS, minSwitchDays, quoteSwitch, requiredDeposit, switchStartMs, type CardChoice, type SwitchPackage } from '@/lib/dailySwitch'
import CardDepositGate from '@/components/CardDepositGate'

type Ctx = {
  monthlyId: string
  customer: { name: string; phone: string }
  isThaiId: boolean
  bike: { plate: string; brand: string; model: string; branchId: string; odometer: number; baseDailyRate: number }
  today: string
  dealStart: string | null
  lateDays: number
  blockReason: string | null
  pickupDefault: string | null
  promoPayDays: number
  heldDeposit: { amount: number; method: 'cash' | 'id_card' }
  hasAccommodationProof: boolean
  hasStudentIdPhoto: boolean
  student: { eligible: boolean; discountPerDay: number; university: string | null }
}

const baht = (n: number) => `฿${Math.round(n).toLocaleString()}`
const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00+07:00`).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' })
const fmtDateTime = (ms: number) =>
  new Date(ms).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function SwitchToDailyClient({ ctx }: { ctx: Ctx }) {
  const router = useRouter()
  const [nowMs] = useState(() => Date.now())

  const [pickupTime, setPickupTime]       = useState(ctx.pickupDefault ?? '')
  const [pkg, setPkg]                     = useState<SwitchPackage>('now')
  const [daysInput, setDaysInput]         = useState('')
  const [isStudent, setIsStudent]         = useState(false)
  const [uni, setUni]                     = useState<'affiliated' | 'other' | null>(null)
  const [studentPhoto, setStudentPhoto]   = useState('')
  const [extraDepInput, setExtraDepInput] = useState<string | null>(null)
  const [confirmWaive, setConfirmWaive]   = useState(false)
  const [cardChoice, setCardChoice]       = useState<CardChoice | null>(null)
  const [confirmKeepCard, setConfirmKeepCard] = useState(false)
  const [receivedDate, setReceivedDate]   = useState(ctx.today)
  const [method, setMethod]               = useState<'cash' | 'transfer' | null>(ctx.isThaiId ? 'transfer' : null)
  const [slipUrl, setSlipUrl]             = useState('')
  const [uploading, setUploading]         = useState<'slip' | 'student' | null>(null)
  const [confirmed, setConfirmed]         = useState(false)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')

  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(pickupTime)
  const startMs = ctx.dealStart && validTime ? switchStartMs(ctx.dealStart, pickupTime) : null
  const minDays = startMs != null ? minSwitchDays(startMs, nowMs) : 1

  // ส่วนลดนักศึกษา: เกณฑ์เดียวกับ API (API คิดซ้ำอีกรอบ)
  const needUniAnswer = isStudent && ctx.student.eligible && !!ctx.student.university
  const discountPerDay = isStudent && ctx.student.eligible && (!ctx.student.university || uni === 'affiliated') ? ctx.student.discountPerDay : 0
  const needStudentPhoto = discountPerDay > 0 && !ctx.hasStudentIdPhoto && !studentPhoto

  const quote = quoteSwitch({ pkg, daysInput: Number(daysInput), minDays, baseRate: ctx.bike.baseDailyRate, discountPerDay, promoPayDays: ctx.promoPayDays })
  const q = 'error' in quote ? null : quote
  const quoteError = 'error' in quote ? quote.error : ''
  const endMs = startMs != null && q ? startMs + q.days * DAY_MS : null

  const idCardDeposit = ctx.heldDeposit.method === 'id_card'
  // วางบัตรแต่เกณฑ์ใหม่เป็นแบบยาว (7 วันขึ้นไป/นักศึกษา) → เลือกเปลี่ยนเป็นเงินสด หรือผู้จัดการยืนยันคงบัตร
  const cardConflict = idCardDeposit && q != null && (isStudent || q.days >= 7)
  const keepCard = cardConflict && cardChoice === 'keep_card'
  const cardGateOpen = cardConflict && (cardChoice == null || (keepCard && !confirmKeepCard))
  const requiredDep = q ? requiredDeposit({ isStudent, days: q.days, hasAccommodationProof: ctx.hasAccommodationProof }) : 0
  const recommendedExtra = idCardDeposit && !(cardConflict && cardChoice === 'cash') ? 0 : Math.max(0, requiredDep - ctx.heldDeposit.amount)
  const extraDep = keepCard ? 0 : extraDepInput == null ? recommendedExtra : cleanAmount(extraDepInput, 100_000)
  const waived = !keepCard && extraDep < recommendedExtra
  const totalToday = (q?.total ?? 0) + extraDep

  const upload = async (file: File, kind: 'slip' | 'student') => {
    setUploading(kind)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/staff/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (res.ok && data.url) { if (kind === 'slip') setSlipUrl(data.url); else setStudentPhoto(data.url) }
    } finally {
      setUploading(null)
    }
  }

  const submit = async (overrideBookingConflict: boolean) => {
    return fetch('/api/staff/monthly/switch-to-daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        monthlyRentalId: ctx.monthlyId, pickupTime, pkg,
        days: pkg === 'days' ? Number(daysInput) : undefined,
        receivedDate, paymentMethod: method, slipUrl,
        isStudent, universityAffiliation: needUniAnswer ? uni : null, studentIdPhotoUrl: studentPhoto || null,
        extraDeposit: extraDep, confirmWaiveDeposit: waived ? confirmWaive : false,
        cardChoice: cardConflict ? cardChoice : undefined, confirmKeepCard: keepCard ? confirmKeepCard : undefined,
        overrideBookingConflict,
      }),
    })
  }

  const handleConfirm = async () => {
    setError('')
    if (!validTime) { setError('กรุณาใส่เวลารับรถ เช่น 12:00'); return }
    if (!q) { setError(quoteError || 'คิดราคาไม่ได้'); return }
    if (needUniAnswer && !uni) { setError(`กรุณาเลือกว่าเป็นนักศึกษา ${ctx.student.university} หรือมหาลัยอื่นๆ`); return }
    if (needStudentPhoto) { setError('ใช้สิทธิราคานักศึกษา — กรุณาแนบรูปบัตรนิสิต/นักศึกษาด้วย'); return }
    if (cardConflict && cardChoice == null) { setError('ลูกค้าวางบัตรไว้ — เลือกเปลี่ยนเป็นมัดจำเงินสด หรือให้ผู้จัดการยืนยันคงบัตรไว้'); return }
    if (keepCard && !confirmKeepCard) { setError('ผู้จัดการยังไม่ได้ยืนยันให้คงบัตรไว้ — ติ๊กยืนยันก่อน'); return }
    if (waived && !confirmWaive) { setError('มัดจำที่เก็บน้อยกว่าที่ควร — ติ๊กยืนยันหยวนมัดจำก่อน'); return }
    if (!method) { setError('กรุณาเลือกวิธีรับเงิน (เงินสด/โอน)'); return }
    if (!slipUrl) { setError('กรุณาแนบสลิป/หลักฐานการชำระเงินของรอบนี้'); return }
    if (!confirmed) { setError('กรุณากดยืนยันก่อน'); return }
    setLoading(true)
    try {
      let res = await submit(false)
      let data = await res.json()
      if (!res.ok && data.conflictBookingId) {
        if (!confirm(`⚡ ${data.error}\n\nยืนยันใช้ Fast lane ทำต่อไหม?`)) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
        res = await submit(true)
        data = await res.json()
      }
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      router.push('/staff/home')
    } catch {
      setError('เกิดข้อผิดพลาด ลองอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  const row = (key: string, val: string, color?: string, bold?: boolean) => (
    <div className="info-row">
      <span className="info-key">{key}</span>
      <span className="info-val" style={{ color, fontWeight: bold ? 700 : undefined }}>{val}</span>
    </div>
  )
  const warn = (text: string, tone: 'amber' | 'red' = 'amber') => (
    <div style={{
      fontSize: '12px', borderRadius: '8px', padding: '8px 10px', margin: '8px 0',
      background: tone === 'red' ? '#fef2f2' : '#fffbeb', color: tone === 'red' ? '#dc2626' : '#92400e',
      border: `1px solid ${tone === 'red' ? '#fecaca' : '#fcd34d'}`,
    }}>{text}</div>
  )
  const uploadBox = (label: string, done: boolean, kind: 'slip' | 'student') => (
    <label style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      border: '2px dashed #d1d5db', borderRadius: '10px', padding: '12px',
      cursor: uploading ? 'not-allowed' : 'pointer', color: '#6b7280', fontSize: '13px',
    }}>
      <input type="file" accept="image/*" disabled={!!uploading} style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f, kind) }} />
      {uploading === kind ? '⏳ กำลังอัปโหลด...' : done ? '✅ แนบแล้ว (กดเพื่อเปลี่ยน)' : label}
    </label>
  )

  const pkgOption = (value: SwitchPackage, title: string, sub: string, disabled = false) => (
    <button key={value} type="button" disabled={disabled} onClick={() => setPkg(value)} style={{
      textAlign: 'left', padding: '10px 12px', borderRadius: '10px', width: '100%', marginBottom: '8px',
      border: `2px solid ${pkg === value ? '#16a34a' : '#e5e7eb'}`,
      background: disabled ? '#f9fafb' : pkg === value ? '#f0fdf4' : '#fff',
      color: disabled ? '#9ca3af' : '#111827', cursor: disabled ? 'not-allowed' : 'pointer',
    }}>
      <div style={{ fontSize: '14px', fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: '11px', color: disabled ? '#9ca3af' : '#6b7280', marginTop: '2px' }}>{sub}</div>
    </button>
  )

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
        <Link href={`/staff/collect/${ctx.monthlyId}`} className="app-header-back">←</Link>
        <div>
          <h1>ต่อเป็นรายวัน</h1>
          <div className="sub">{ctx.bike.plate} {ctx.bike.brand} {ctx.bike.model}</div>
        </div>
      </div>

      <div className="section-pad">
        <div className="card" style={{ borderTop: '3px solid #16a34a' }}>
          <div className="card-title">สัญญารายเดือนเดิม</div>
          {row('ผู้เช่า', ctx.customer.name)}
          {row('เบอร์โทร', ctx.customer.phone)}
          {ctx.dealStart && row('วันครบดีล (เริ่มนับรายวัน)', fmtDate(ctx.dealStart), '#16a34a', true)}
          {row('เรทรายวัน', baht(ctx.bike.baseDailyRate))}
          {row('มัดจำที่ถืออยู่', idCardDeposit ? 'วางบัตรประชาชน' : baht(ctx.heldDeposit.amount))}
        </div>

        {ctx.blockReason ? (
          <div className="card" style={{ border: '2px solid #fecaca' }}>
            <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: '6px' }}>⛔ ยังสลับเป็นรายวันไม่ได้</div>
            <div style={{ fontSize: '14px', color: '#374151', lineHeight: 1.6 }}>{ctx.blockReason}</div>
          </div>
        ) : (
          <>
            {ctx.lateDays > 0 && warn(`เลยวันครบดีลมา ${ctx.lateDays} วันแล้ว — นับวันเช่ารายวันจากวันครบดีลเดิม ไม่ใช่วันนี้`)}

            {/* เวลารับรถ */}
            <div className="card">
              <div className="card-title">เวลารับรถ</div>
              <div className="field-row" style={{ marginBottom: 0 }}>
                <label className="field-label">เวลาที่ลูกค้ารับรถไปตอนแรก (กำหนดคืนจะเป็นเวลานี้ทุกวัน เกินคิดค่าล่วงเวลา)</label>
                <input className="field-input" type="time" value={pickupTime} onChange={e => setPickupTime(e.target.value)} />
                {!ctx.pickupDefault && warn('สัญญานี้ไม่ได้เก็บเวลารับรถไว้ — ถามลูกค้าหรือดูจากสัญญา แล้วกรอกเวลาให้ตรง')}
              </div>
            </div>

            {/* แพ็กเกจ */}
            <div className="card">
              <div className="card-title">เลือกแบบที่ต่อ</div>
              {pkgOption('now', `ถึงวันนี้ — ${minDays} วัน (ราคาเต็ม)`, `คิดวันละ ${baht(ctx.bike.baseDailyRate - discountPerDay)} × ${minDays} วัน ไม่มีโปร`)}
              {pkgOption('plus1', `ถึงพรุ่งนี้ — ${minDays + 1} วัน (ราคาเต็ม)`, 'ต่ออีก 1 วันจากวันนี้ คิดตรงๆ ไม่มีโปร')}
              {pkgOption('days', 'ระบุจำนวนวันเอง (ราคาเต็ม)', `ไม่ต่ำกว่า ${minDays} วัน คิดตรงๆ ไม่มีเพดาน`)}
              {pkg === 'days' && (
                <input className="field-input" type="number" min={minDays} inputMode="numeric" placeholder={`จำนวนวัน (≥ ${minDays})`}
                  value={daysInput} onChange={e => setDaysInput(e.target.value)} style={{ marginBottom: '8px' }} />
              )}
              {pkgOption('week', 'แพ็กเกจสัปดาห์ 7 วัน (โปร)', `จ่าย ${ctx.promoPayDays} วันจาก 7 วัน`, minDays > 7)}
              {minDays > 7 && warn('แพ็กเกจสัปดาห์ครอบคลุมไม่ถึงวันนี้ (เลยมา 7 วันแล้ว) — เลือกแบบอื่น')}
              {pkg === 'week' && ctx.lateDays > 0 && warn(`⚠️ เลยวันครบดีลมา ${ctx.lateDays} วันแล้ว — โปรสัปดาห์ปกติใช้กับคนจ่ายก้อนเดียวตรงเวลา ใช้ได้ถ้าตกลงกับลูกค้าแล้ว ระบบจะบันทึกไว้`)}
              {quoteError && pkg === 'days' && daysInput && warn(quoteError, 'red')}

              {q && endMs != null && (
                <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '12px', marginTop: '4px' }}>
                  <div style={{ fontSize: '12px', color: '#166534' }}>
                    {q.days} วัน • กำหนดคืน {fmtDateTime(endMs)}
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#15803d' }}>{baht(q.total)}</div>
                  {q.discount > 0 && <div style={{ fontSize: '11px', color: '#6b7280' }}>ลดนักศึกษา {baht(q.discount)} จากราคาเต็ม {baht(q.normalTotal)}</div>}
                </div>
              )}
            </div>

            {/* นักศึกษา */}
            <div className="card">
              <div className="card-title">ราคานักศึกษา</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={isStudent} onChange={e => { setIsStudent(e.target.checked); setUni(null) }} style={{ width: '18px', height: '18px' }} />
                <span style={{ fontSize: '14px', fontWeight: 600 }}>🎓 ลูกค้าเป็นนักศึกษา</span>
              </label>
              {isStudent && !ctx.student.eligible && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>รุ่น/สาขานี้ไม่ร่วมโปรนักศึกษา — ไม่มีส่วนลด แต่ไม่เก็บมัดจำ</div>}
              {needUniAnswer && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  {([['affiliated', `🎓 ${ctx.student.university}`], ['other', 'มหาลัยอื่นๆ']] as const).map(([v, label]) => (
                    <button key={v} type="button" onClick={() => setUni(v)} style={{
                      flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
                      border: `2px solid ${uni === v ? '#16a34a' : '#e5e7eb'}`, background: uni === v ? '#f0fdf4' : '#fff', cursor: 'pointer',
                    }}>{label}</button>
                  ))}
                </div>
              )}
              {discountPerDay > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ fontSize: '12px', color: '#166534', marginBottom: '6px' }}>✓ ลด {baht(discountPerDay)}/วัน</div>
                  {ctx.hasStudentIdPhoto
                    ? <div style={{ fontSize: '12px', color: '#166534' }}>✓ มีรูปบัตรนักศึกษาในสัญญาเดิมแล้ว</div>
                    : uploadBox('📷 แนบรูปบัตรนิสิต/นักศึกษา (บังคับ)', !!studentPhoto, 'student')}
                </div>
              )}
            </div>

            {/* มัดจำ */}
            <div className="card">
              <div className="card-title">มัดจำ</div>
              {cardConflict && (
                <div style={{ marginBottom: '10px' }}>
                  <CardDepositGate choice={cardChoice} onChoice={c => { setCardChoice(c); setConfirmKeepCard(false); setConfirmWaive(false) }}
                    confirmKeep={confirmKeepCard} onConfirmKeep={setConfirmKeepCard} why="แบบที่เลือกเข้าเกณฑ์เช่า 7 วันขึ้นไป/นักศึกษา" />
                </div>
              )}
              {idCardDeposit && !cardConflict && (
                <div style={{ fontSize: '13px', color: '#374151' }}>วางบัตรประชาชนไว้แทนมัดจำต่อไป ไม่มีเงินมัดจำต้องเก็บ</div>
              )}
              {keepCard && (
                <div style={{ fontSize: '13px', color: '#1d4ed8', fontWeight: 600 }}>🪪 คงบัตรประชาชนไว้ (ผู้จัดการยืนยัน) — ไม่เก็บเงินมัดจำ</div>
              )}
              {(!idCardDeposit || (cardConflict && cardChoice === 'cash')) && (
                <>
                  {row('ถืออยู่', baht(ctx.heldDeposit.amount))}
                  {row('เกณฑ์ของแบบนี้', baht(requiredDep))}
                  {recommendedExtra > 0 ? (
                    <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: '10px', padding: '10px 12px', margin: '8px 0' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400e' }}>⚠️ ควรเก็บมัดจำเพิ่ม {baht(recommendedExtra)}</div>
                      <div style={{ fontSize: '11px', color: '#92400e', marginTop: '2px' }}>กรอกยอดที่เก็บจริง (หยวนได้ เช่น ใส่ 0 แต่ต้องติ๊กยืนยัน)</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#166534', margin: '6px 0' }}>✓ มัดจำที่ถืออยู่ครบตามเกณฑ์แล้ว</div>
                  )}
                  <div className="field-row" style={{ marginBottom: 0 }}>
                    <label className="field-label">เก็บมัดจำเพิ่มจริง (บาท)</label>
                    <input className="field-input" type="number" min={0} inputMode="numeric"
                      value={extraDepInput ?? String(recommendedExtra)} onChange={e => { setExtraDepInput(e.target.value); setConfirmWaive(false) }} />
                  </div>
                  {waived && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={confirmWaive} onChange={e => setConfirmWaive(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#dc2626' }}>ยืนยันหยวนมัดจำ (เก็บ {baht(extraDep)} จากที่ควร {baht(recommendedExtra)})</span>
                    </label>
                  )}
                </>
              )}
            </div>

            {/* รับเงิน */}
            <div className="card">
              <div className="card-title">รับเงินรอบนี้</div>
              <div className="field-row">
                <label className="field-label">วันที่รับเงินจริง (ถ้าลูกค้าโอนล่วงหน้า เลือกวันที่โอน)</label>
                <input className="field-input" type="date" max={ctx.today} value={receivedDate} onChange={e => setReceivedDate(e.target.value || ctx.today)} />
              </div>
              <label className="field-label">วิธีรับเงิน</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                {(['cash', 'transfer'] as const).map(m => {
                  const disabled = m === 'cash' && ctx.isThaiId
                  const active = method === m
                  return (
                    <button key={m} type="button" disabled={disabled} onClick={() => setMethod(m)} style={{
                      flex: 1, padding: '10px', borderRadius: '10px', fontSize: '14px', fontWeight: 700,
                      border: `2px solid ${active ? '#16a34a' : '#e5e7eb'}`, background: active ? '#f0fdf4' : '#fff',
                      color: disabled ? '#d1d5db' : active ? '#16a34a' : '#374151', cursor: disabled ? 'not-allowed' : 'pointer',
                    }}>{m === 'cash' ? '💵 เงินสด' : '📲 โอน'}</button>
                  )
                })}
              </div>
              {ctx.isThaiId && <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>บัตรประชาชนไทย — จ่ายเงินสดไม่ได้ ต้องโอนเท่านั้น</div>}
              {uploadBox('📷 แนบสลิป/หลักฐานการชำระเงินรอบนี้ (บังคับ)', !!slipUrl, 'slip')}
              <div style={{ textAlign: 'center', marginTop: '14px', paddingTop: '12px', borderTop: '1px dashed #d1d5db' }}>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>ลูกค้าจ่ายรอบนี้ (ค่าเช่า {baht(q?.total ?? 0)}{extraDep > 0 ? ` + มัดจำเพิ่ม ${baht(extraDep)}` : ''})</div>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#15803d' }}>{baht(totalToday)}</div>
              </div>
            </div>

            <div className="card" style={{ border: '1.5px solid #16a34a' }}>
              <div style={{ fontSize: '13px', color: '#111827', lineHeight: 1.6, marginBottom: '12px' }}>
                สัญญารายเดือนเดิมจะถูกปิด และเปิดสัญญารายวันต่อเนื่องคันเดิม <strong>รถยังอยู่กับลูกค้า</strong> เอกสารทั้งหมดย้ายไปสัญญารายวันให้อัตโนมัติ
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#16a34a' }} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#15803d' }}>ฉันยืนยันว่ารับเงิน {baht(totalToday)} แล้ว และลูกค้าตกลงต่อเป็นรายวัน</span>
              </label>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', color: '#dc2626', fontSize: '14px', marginBottom: '12px' }}>
                ⚠️ {error}
              </div>
            )}

            <button onClick={handleConfirm} disabled={loading || !confirmed || cardGateOpen} style={{
              width: '100%', background: confirmed ? '#16a34a' : '#e5e7eb', color: confirmed ? '#fff' : '#9ca3af',
              border: 'none', borderRadius: '12px', padding: '16px', fontSize: '16px', fontWeight: 700,
              cursor: confirmed ? 'pointer' : 'not-allowed', opacity: loading ? 0.7 : 1,
            }}>
              {loading ? '⏳ กำลังบันทึก...' : '✅ ยืนยันต่อเป็นรายวัน'}
            </button>
          </>
        )}

        <div style={{ height: '24px' }} />
      </div>
    </div>
  )
}
