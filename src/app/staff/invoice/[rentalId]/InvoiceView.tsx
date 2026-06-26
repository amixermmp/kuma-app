'use client'

import { useState } from 'react'
import Link from 'next/link'

type Shop = {
  shop_name?: string | null
  address?: string | null
  phone?: string | null
  tax_id?: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props = { rental: any; shop: Shop; type: 'daily' | 'monthly' }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function invoiceNumber(id: string, createdAt: string) {
  const year = new Date(createdAt).getFullYear() + 543
  return `INV-${year}-${id.slice(0, 6).toUpperCase()}`
}

const PAYMENT_LABEL: Record<string, string> = {
  '💵 เงินสด': 'เงินสด',
  '📱 โอนธนาคาร': 'โอนธนาคาร',
  '💳 บัตรเครดิต': 'บัตรเครดิต',
  '📲 QR Promptpay': 'QR Promptpay',
  cash: 'เงินสด',
}

export default function InvoiceView({ rental, shop, type }: Props) {
  const bike = rental.bikes
  const customer = rental.customers
  const invNo = invoiceNumber(rental.id, rental.created_at)

  // Daily: compute values
  const isDaily = type === 'daily'
  const totalAmount: number = isDaily
    ? Number(rental.total_amount ?? 0)
    : Number(rental.monthly_rate ?? 0)
  const depositAmount: number = Number(rental.deposit_amount ?? 0)
  const discount: number = isDaily ? Number(rental.discount ?? 0) : 0
  const vatRate = 0.07
  const baseAmount = totalAmount / (1 + vatRate)
  const vatAmount = totalAmount - baseAmount
  const payMethod = PAYMENT_LABEL[rental.payment_method ?? ''] ?? rental.payment_method ?? '—'

  const [custName, setCustName]   = useState<string>(customer?.name ?? '')
  const [custAddr, setCustAddr]   = useState<string>(
    isDaily ? (customer?.hotel ?? '') : (customer?.workplace ?? '')
  )
  const [custId, setCustId]       = useState<string>(customer?.phone ?? '')

  const shopName = shop.shop_name || 'Kuma Rental'

  const handlePrint = () => window.print()

  return (
    <>
      {/* ── Print styles injected via style tag ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .app-wrap { max-width: 100% !important; }
          body { background: #fff !important; }
          .print-card {
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      <div className="app-wrap">

        {/* Header — hidden on print */}
        <div className="app-header no-print" style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a8a)' }}>
          <Link href="/staff/home" className="app-header-back">←</Link>
          <div style={{ flex: 1 }}>
            <h1>ใบกำกับภาษี</h1>
            <div className="sub">{invNo}</div>
          </div>
          <button
            onClick={handlePrint}
            style={{
              background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff',
              borderRadius: '8px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer',
            }}
          >
            ⬇️ PDF
          </button>
        </div>

        <div className="section-pad" style={{ paddingTop: '12px' }}>

          {/* ── Invoice card ── */}
          <div className="card print-card" style={{ padding: '20px', fontSize: '13px', lineHeight: 1.8 }}>

            {/* Shop header */}
            <div style={{ textAlign: 'center', marginBottom: '16px', paddingBottom: '16px', borderBottom: '2px solid #e5e7eb' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#1e3a8a' }}>{shopName}</div>
              {shop.address && (
                <div style={{ color: '#6b7280', fontSize: '12px' }}>{shop.address}</div>
              )}
              {shop.phone && (
                <div style={{ color: '#6b7280', fontSize: '12px' }}>Tel: {shop.phone}</div>
              )}
              {shop.tax_id && (
                <div style={{
                  background: '#f0f4ff', borderRadius: '6px', padding: '4px 12px',
                  display: 'inline-block', marginTop: '6px', fontSize: '12px',
                  color: '#1e3a8a', fontWeight: 600,
                }}>
                  เลขประจำตัวผู้เสียภาษี: {shop.tax_id}
                </div>
              )}
            </div>

            <div style={{ textAlign: 'center', fontSize: '16px', fontWeight: 800, marginBottom: '16px' }}>
              ใบกำกับภาษี / Tax Invoice
            </div>

            {/* Customer + Invoice meta */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', fontSize: '12px' }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>ออกให้แก่:</div>
                <div>{custName}</div>
                {custId && <div style={{ color: '#6b7280' }}>{custId}</div>}
                {custAddr && <div style={{ color: '#6b7280' }}>{custAddr}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div><span style={{ color: '#6b7280' }}>เลขที่: </span><strong>{invNo}</strong></div>
                <div><span style={{ color: '#6b7280' }}>วันที่: </span><strong>{fmtDate(rental.created_at)}</strong></div>
              </div>
            </div>

            {/* Items table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '8px 6px', textAlign: 'left' }}>รายการ</th>
                  {isDaily && <th style={{ padding: '8px 6px', textAlign: 'center' }}>จำนวน</th>}
                  {isDaily && <th style={{ padding: '8px 6px', textAlign: 'right' }}>ราคา/วัน</th>}
                  <th style={{ padding: '8px 6px', textAlign: 'right' }}>รวม</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '8px 6px' }}>
                    {isDaily ? 'เช่ารถจักรยานยนต์' : 'เช่ารถจักรยานยนต์ (รายเดือน)'}<br />
                    <span style={{ color: '#6b7280', fontSize: '11px' }}>
                      {bike?.brand} {bike?.model} • {bike?.license_plate}<br />
                      {isDaily
                        ? `${fmtDateTime(rental.start_datetime)} – ${fmtDateTime(rental.end_datetime)}`
                        : `เริ่ม ${fmtDate(rental.start_date)} • ชำระทุกวันที่ ${rental.payment_day} ของเดือน`
                      }
                    </span>
                  </td>
                  {isDaily && (
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>{rental.total_days} วัน</td>
                  )}
                  {isDaily && (
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>฿{Number(rental.daily_rate).toLocaleString()}</td>
                  )}
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700 }}>
                    ฿{totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                {discount > 0 && (
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td colSpan={isDaily ? 3 : 1} style={{ padding: '8px 6px', color: '#16a34a' }}>ส่วนลด</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', color: '#16a34a' }}>
                      −฿{discount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
                {depositAmount > 0 && (
                  <tr>
                    <td colSpan={isDaily ? 3 : 1} style={{ padding: '8px 6px', color: '#6b7280' }}>มัดจำ (คืนเมื่อส่งรถ)</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', color: '#6b7280' }}>
                      ฿{depositAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
              {shop.tax_id && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                    <span style={{ color: '#6b7280' }}>ราคาก่อนภาษี</span>
                    <span>฿{baseAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                    <span style={{ color: '#6b7280' }}>ภาษีมูลค่าเพิ่ม 7%</span>
                    <span>฿{vatAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                  </div>
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 800, borderTop: '2px solid #e5e7eb', paddingTop: '8px', marginTop: '4px' }}>
                <span>ยอดรวมทั้งสิ้น</span>
                <span style={{ color: '#1e3a8a' }}>฿{totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb', fontSize: '12px', color: '#6b7280', textAlign: 'center' }}>
              ชำระโดย: {payMethod} &nbsp;|&nbsp; วันที่ออกบิล: {fmtDate(rental.created_at)}<br />
              ขอบคุณที่ใช้บริการ {shopName} 🙏
            </div>
          </div>

          {/* ── Editable customer info ── */}
          <div className="card no-print">
            <div className="card-title">
              ข้อมูลผู้รับบิล
              <span style={{ fontSize: '11px', fontWeight: 400, color: '#9ca3af', marginLeft: '6px' }}>
                แก้ไขได้ก่อน download
              </span>
            </div>
            <div className="field-row">
              <label className="field-label">ชื่อลูกค้า</label>
              <input className="field-input" value={custName} onChange={e => setCustName(e.target.value)} />
            </div>
            <div className="field-row">
              <label className="field-label">ที่อยู่ / โรงแรม</label>
              <input className="field-input" value={custAddr} onChange={e => setCustAddr(e.target.value)} placeholder="โรงแรม / ที่อยู่" />
            </div>
            <div className="field-row" style={{ marginBottom: 0 }}>
              <label className="field-label">เลขบัตร / พาสปอร์ต / เบอร์โทร</label>
              <input className="field-input" value={custId} onChange={e => setCustId(e.target.value)} />
            </div>
          </div>

          <button
            onClick={handlePrint}
            className="no-print"
            style={{
              width: '100%', background: '#1e3a8a', color: '#fff', border: 'none',
              borderRadius: '12px', padding: '16px', fontSize: '16px', fontWeight: 700,
              cursor: 'pointer', marginBottom: '80px',
            }}
          >
            ⬇️ Download ใบกำกับภาษี (PDF)
          </button>

        </div>
      </div>
    </>
  )
}
