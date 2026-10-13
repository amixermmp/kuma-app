type Payment = { id: string; kind: string; amount: number; paid_at: string }

const KIND_LABEL: Record<string, string> = {
  rental: 'ค่าเช่า', extend: 'ต่อเวลา', overtime: 'ค่าล่วงเวลา',
  early_return_refund: 'คืนเงิน (คืนก่อนกำหนด)', return_fee: 'ค่ารับคืนนอกสถานที่',
}

const fmtMoney = (n: number) => `${n < 0 ? '-' : ''}฿${Math.abs(n).toLocaleString()}`
const fmtWhen = (iso: string) => new Date(iso).toLocaleString('th-TH', {
  timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
})

// สัญญารายวัน/รายสัปดาห์ที่เคยต่อเวลา — โชว์ทุกยอดที่เก็บ (ค่าเช่า ต่อเวลา ค่าล่วงเวลา ฯลฯ) พร้อมวันเวลา
// ใช้จับคู่กับรายงานรายรับได้ตรงๆ เพราะดึงจากใบเสร็จชุดเดียวกัน ไม่แตะข้อมูลอื่นบนการ์ด สัญญาที่ไม่เคยต่อเวลาไม่แสดง
export default function ExtensionSummary({ payments }: { payments?: Payment[] }) {
  const all = payments ?? []
  const extensions = all.filter(p => p.kind === 'extend')
  if (extensions.length === 0) return null

  const extTotal = extensions.reduce((a, p) => a + Number(p.amount), 0)
  const total = all.reduce((a, p) => a + Number(p.amount), 0)

  return (
    <div style={{ marginTop: '10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '10px 12px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400e' }}>
        ⏱ ต่อเวลา {extensions.length} ครั้ง • {fmtMoney(extTotal)}
      </div>
      <div style={{ marginTop: '6px' }}>
        {all.map(p => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px', color: '#374151', padding: '2px 0' }}>
            <span>{fmtWhen(p.paid_at)} • {KIND_LABEL[p.kind] ?? p.kind}</span>
            <span style={{ fontWeight: 600 }}>{fmtMoney(Number(p.amount))}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, color: '#111827', borderTop: '1px dashed #fcd34d', marginTop: '6px', paddingTop: '6px' }}>
        <span>รวมเก็บจริงทั้งหมด</span>
        <span>{fmtMoney(total)}</span>
      </div>
    </div>
  )
}
