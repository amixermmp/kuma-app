'use client'

import { useState } from 'react'
import Link from 'next/link'

type Shop = {
  shop_name?: string | null
  address?: string | null
  phone?: string | null
  tax_id?: string | null
  logo_url?: string | null
}

type Payment = {
  id: string
  invoiceNo: string
  itemLabel: string
  itemDetail: string
  qtyLabel?: string | null
  rateLabel?: string | null
  amount: number
  discountAmount: number
  depositAmount: number
  paymentMethod: string | null
  paidAt: string
}

type Customer = {
  name?: string | null
  phone?: string | null
  workplace?: string | null
}

type Props = {
  payment: Payment
  customer: Customer
  shop: Shop
  contractType: 'rental' | 'monthly'
  contractId: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric',
  })
}

const PAYMENT_LABEL: Record<string, string> = {
  '💵 เงินสด': 'เงินสด',
  '📱 โอนธนาคาร': 'โอนธนาคาร',
  '💳 บัตรเครดิต': 'บัตรเครดิต',
  '📲 QR Promptpay': 'QR Promptpay',
  cash: 'เงินสด',
}

export default function InvoiceView({ payment, customer, shop, contractType, contractId }: Props) {
  const grandTotal = payment.amount + payment.depositAmount
  const vatRate = 0.07
  const baseAmount = grandTotal / (1 + vatRate)
  const vatAmount = grandTotal - baseAmount
  const payMethod = PAYMENT_LABEL[payment.paymentMethod ?? ''] ?? payment.paymentMethod ?? '—'
  const hasQty = !!payment.qtyLabel

  const [custName, setCustName] = useState<string>(customer?.name ?? '')
  const [custAddr, setCustAddr] = useState<string>(customer?.workplace ?? '')
  const [custId, setCustId] = useState<string>(customer?.phone ?? '')
  const [savingBilling, setSavingBilling] = useState(false)
  const [billingMsg, setBillingMsg] = useState('')

  const shopName = shop.shop_name || 'Kuma Rental'

  const handlePrint = () => window.print()

  const saveBilling = async () => {
    setSavingBilling(true)
    const res = await fetch('/api/staff/billing-override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractType, contractId,
        billingName: custName, billingAddress: custAddr, billingId: custId,
      }),
    })
    setSavingBilling(false)
    setBillingMsg(res.ok ? '✅ บันทึกแล้ว ใช้กับใบเสร็จรอบถัดไปของสัญญานี้ได้เลย' : '❌ เกิดข้อผิดพลาด')
    setTimeout(() => setBillingMsg(''), 4000)
  }

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
        <div className="app-header no-print">
          <Link href="/staff/home" className="app-header-back">←</Link>
          <div style={{ flex: 1 }}>
            <h1>ใบเสร็จรับเงิน</h1>
            <div className="sub">{payment.invoiceNo}</div>
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
              {shop.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shop.logo_url} alt={shopName} style={{ width: '56px', height: '56px', objectFit: 'contain', margin: '0 auto 8px' }} />
              )}
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#111827' }}>{shopName}</div>
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
                  color: '#111827', fontWeight: 600,
                }}>
                  เลขประจำตัวผู้เสียภาษี: {shop.tax_id}
                </div>
              )}
            </div>

            <div style={{ textAlign: 'center', fontSize: '16px', fontWeight: 800, marginBottom: '16px' }}>
              ใบเสร็จรับเงิน / Receipt
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
                <div><span style={{ color: '#6b7280' }}>เลขที่: </span><strong>{payment.invoiceNo}</strong></div>
                <div><span style={{ color: '#6b7280' }}>วันที่: </span><strong>{fmtDate(payment.paidAt)}</strong></div>
              </div>
            </div>

            {/* Items table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '8px 6px', textAlign: 'left' }}>รายการ</th>
                  {hasQty && <th style={{ padding: '8px 6px', textAlign: 'center' }}>จำนวน</th>}
                  {hasQty && <th style={{ padding: '8px 6px', textAlign: 'right' }}>ราคา/วัน</th>}
                  <th style={{ padding: '8px 6px', textAlign: 'right' }}>รวม</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '8px 6px' }}>
                    {payment.itemLabel}<br />
                    <span style={{ color: '#6b7280', fontSize: '11px', whiteSpace: 'pre-line' }}>{payment.itemDetail}</span>
                  </td>
                  {hasQty && (
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>{payment.qtyLabel}</td>
                  )}
                  {hasQty && (
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>{payment.rateLabel}</td>
                  )}
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700 }}>
                    ฿{payment.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                {payment.discountAmount > 0 && (
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td colSpan={hasQty ? 3 : 1} style={{ padding: '8px 6px', color: '#16a34a' }}>ส่วนลด</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', color: '#16a34a' }}>
                      −฿{payment.discountAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
                {payment.depositAmount > 0 && (
                  <tr>
                    <td colSpan={hasQty ? 3 : 1} style={{ padding: '8px 6px', color: '#6b7280' }}>มัดจำ (คืนเมื่อส่งรถ)</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', color: '#6b7280' }}>
                      ฿{payment.depositAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
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
                <span style={{ color: '#111827' }}>฿{grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb', fontSize: '12px', color: '#6b7280', textAlign: 'center' }}>
              ชำระโดย: {payMethod} &nbsp;|&nbsp; วันที่ออกบิล: {fmtDate(payment.paidAt)}<br />
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
            <div className="field-row" style={{ marginBottom: '12px' }}>
              <label className="field-label">เลขบัตร / พาสปอร์ต / เบอร์โทร</label>
              <input className="field-input" value={custId} onChange={e => setCustId(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={saveBilling}
                disabled={savingBilling}
                style={{
                  background: '#f1f5f9', color: '#374151', border: '1px solid #e5e7eb',
                  borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600,
                  cursor: savingBilling ? 'not-allowed' : 'pointer',
                }}
              >
                {savingBilling ? '⏳ กำลังบันทึก...' : '💾 บันทึกไว้ใช้ทุกใบเสร็จของสัญญานี้'}
              </button>
              {billingMsg && (
                <span style={{ fontSize: '12px', color: billingMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{billingMsg}</span>
              )}
            </div>
          </div>

          <button
            onClick={handlePrint}
            className="no-print"
            style={{
              width: '100%', background: '#111827', color: '#fff', border: 'none',
              borderRadius: '12px', padding: '16px', fontSize: '16px', fontWeight: 700,
              cursor: 'pointer', marginBottom: '80px',
            }}
          >
            ⬇️ Download ใบเสร็จรับเงิน (PDF)
          </button>

        </div>
      </div>
    </>
  )
}
