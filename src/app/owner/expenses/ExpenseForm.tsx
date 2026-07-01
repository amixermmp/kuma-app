'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Branch = { id: string; name: string }

const CATEGORIES = [
  '💼 เงินเดือนพนักงาน',
  '🏠 ค่าเช่าร้าน',
  '💡 ค่าน้ำ / ไฟ / เน็ต',
  '🔧 ค่าซ่อมบำรุง',
  '📄 ค่าต่อเอกสาร/ภาษี',
  '🛢️ ค่าน้ำมัน',
  '📦 อื่นๆ',
]

export default function ExpenseForm({ branches }: { branches: Branch[] }) {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]

  const [branchId,    setBranchId]    = useState('')
  const [category,    setCategory]    = useState(CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [amount,      setAmount]      = useState('')
  const [date,        setDate]        = useState(today)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState(false)

  const handleSubmit = async () => {
    setError(''); setSuccess(false)
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('กรุณาระบุจำนวนเงิน'); return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/owner/expenses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: branchId || null,
          category: category.replace(/^[\S]+\s/, ''), // strip emoji
          description,
          amount,
          expense_date: date,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'เกิดข้อผิดพลาด'); return }
      setSuccess(true)
      setDescription(''); setAmount(''); setDate(today)
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <div className="card-title">+ เพิ่มรายการค่าใช้จ่าย</div>

      <div className="field-row">
        <label className="field-label">สาขา</label>
        <select className="field-input" value={branchId} onChange={e => setBranchId(e.target.value)}>
          <option value="">🏢 ส่วนกลาง</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="field-row">
        <label className="field-label">หมวดหมู่</label>
        <select className="field-input" value={category} onChange={e => setCategory(e.target.value)}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="field-row">
        <label className="field-label">รายละเอียด</label>
        <input className="field-input" type="text"
          placeholder="เช่น เงินเดือนพนักงาน มิ.ย. 2568"
          value={description} onChange={e => setDescription(e.target.value)} />
      </div>

      <div className="field-row">
        <label className="field-label">จำนวนเงิน (บาท)</label>
        <input className="field-input" type="number" placeholder="0"
          value={amount} onChange={e => setAmount(e.target.value)} />
      </div>

      <div className="field-row" style={{ marginBottom: 0 }}>
        <label className="field-label">วันที่</label>
        <input className="field-input" type="date"
          value={date} onChange={e => setDate(e.target.value)} />
      </div>

      {error && (
        <div style={{ color: '#dc2626', fontSize: '13px', padding: '8px 0' }}>⚠️ {error}</div>
      )}
      {success && (
        <div style={{ color: '#16a34a', fontSize: '13px', padding: '8px 0' }}>✅ บันทึกสำเร็จ</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="btn btn-primary"
        style={{ width: '100%', marginTop: '12px', opacity: loading ? .7 : 1 }}
      >
        {loading ? '⏳ กำลังบันทึก...' : '💾 บันทึกค่าใช้จ่าย'}
      </button>
    </div>
  )
}
