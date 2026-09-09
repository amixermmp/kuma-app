'use client'

import { useState } from 'react'
import { SettingsHeader } from '../_shared'

type StockInfo = { quantity: number; low_stock_threshold: number }
type BranchRow = { id: string; name: string; engine: StockInfo; gear: StockInfo }

const OIL_LABEL: Record<'engine' | 'gear', string> = { engine: 'น้ำมันเครื่อง', gear: 'น้ำมันเฟืองท้าย' }

function OilTypeCard({ branchId, oilType, info }: { branchId: string; oilType: 'engine' | 'gear'; info: StockInfo }) {
  const [quantity, setQuantity] = useState(info.quantity)
  const [threshold, setThreshold] = useState(String(info.low_stock_threshold))
  const [addQty, setAddQty] = useState('')
  const [addCost, setAddCost] = useState('')
  const [showRestock, setShowRestock] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const isLow = quantity < info.low_stock_threshold

  const restock = async () => {
    if (!addQty || Number(addQty) <= 0) { setMsg('❌ กรุณาใส่จำนวนขวด'); return }
    setLoading(true)
    const res = await fetch('/api/owner/settings/oil-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restock', branch_id: branchId, oil_type: oilType, quantity: addQty, cost: addCost || null }),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) {
      setQuantity(data.quantity)
      setAddQty(''); setAddCost(''); setShowRestock(false)
      setMsg('✅ เติมสต๊อกแล้ว')
    } else {
      setMsg('❌ ' + (data.error ?? 'เกิดข้อผิดพลาด'))
    }
    setTimeout(() => setMsg(''), 3000)
  }

  const saveThreshold = async () => {
    setLoading(true)
    const res = await fetch('/api/owner/settings/oil-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_threshold', branch_id: branchId, oil_type: oilType, threshold }),
    })
    const data = await res.json()
    setLoading(false)
    setMsg(res.ok ? '✅ บันทึกเกณฑ์แล้ว' : '❌ ' + (data.error ?? 'เกิดข้อผิดพลาด'))
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div style={{
      border: `1.5px solid ${isLow ? '#fca5a5' : '#e5e7eb'}`, borderRadius: '12px',
      padding: '14px', marginBottom: '10px', background: isLow ? '#fef2f2' : '#fff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>🛢️ {OIL_LABEL[oilType]}</span>
        {msg && <span style={{ fontSize: '12px', color: msg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{msg}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '10px' }}>
        <span style={{ fontSize: '24px', fontWeight: 900, color: isLow ? '#dc2626' : '#111827' }}>{quantity}</span>
        <span style={{ fontSize: '13px', color: '#6b7280' }}>ขวด {isLow && '— ใกล้หมด'}</span>
      </div>

      {showRestock ? (
        <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>เติมกี่ขวด</div>
              <input className="field-input" type="number" placeholder="เช่น 10" value={addQty}
                onChange={e => setAddQty(e.target.value)} style={{ fontSize: '13px', padding: '8px' }} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>ราคารวม (฿) — ถ้ามี</div>
              <input className="field-input" type="number" placeholder="เช่น 3000" value={addCost}
                onChange={e => setAddCost(e.target.value)} style={{ fontSize: '13px', padding: '8px' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={restock} disabled={loading} className="btn" style={{ flex: 1, padding: '8px', fontSize: '13px' }}>
              {loading ? '⏳' : '💾 บันทึกเติมสต๊อก'}
            </button>
            <button onClick={() => setShowRestock(false)} style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>
              ยกเลิก
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowRestock(true)} className="btn" style={{ width: '100%', padding: '8px', fontSize: '13px', marginBottom: '8px' }}>
          + เติมสต๊อก
        </button>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', color: '#6b7280', flexShrink: 0 }}>แจ้งเตือนเมื่อเหลือน้อยกว่า</span>
        <input className="field-input" type="number" value={threshold} onChange={e => setThreshold(e.target.value)}
          style={{ fontSize: '13px', padding: '6px 8px', width: '70px' }} />
        <span style={{ fontSize: '12px', color: '#6b7280' }}>ขวด</span>
        <button onClick={saveThreshold} disabled={loading} style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}>
          💾
        </button>
      </div>
    </div>
  )
}

export default function OilStockClient({ branches }: { branches: BranchRow[] }) {
  return (
    <>
      <SettingsHeader title="🛢️ สต๊อกน้ำมัน" sub="เติมสต๊อก + ตั้งเกณฑ์แจ้งเตือนใกล้หมด รายสาขา" />
      <div style={{ padding: '12px 16px 40px' }}>
        {branches.map(b => (
          <div key={b.id} style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280', marginBottom: '8px' }}>📍 {b.name}</div>
            <OilTypeCard branchId={b.id} oilType="engine" info={b.engine} />
            <OilTypeCard branchId={b.id} oilType="gear" info={b.gear} />
          </div>
        ))}
      </div>
    </>
  )
}
