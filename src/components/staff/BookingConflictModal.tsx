'use client'

type Conflict = {
  id: string
  booking_ref: string
  customer_name: string
  customer_phone: string | null
  start_datetime: string
  end_datetime: string
  reason: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function BookingConflictModal({ conflicts, onAcknowledge }: { conflicts: Conflict[]; onAcknowledge: () => void }) {
  if (conflicts.length === 0) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', maxWidth: '400px', width: '100%',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #fecaca', background: '#fef2f2' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#dc2626' }}>⚠️ คิวจองมีปัญหา</div>
          <div style={{ fontSize: '12px', color: '#991b1b', marginTop: '4px' }}>
            การเปลี่ยนแปลงนี้กระทบคิวจอง {conflicts.length} รายการ — ต้องจัดการหารถให้ลูกค้าเอง
          </div>
        </div>
        <div style={{ padding: '12px 20px', overflowY: 'auto', flex: 1 }}>
          {conflicts.map(c => (
            <div key={c.id} style={{
              border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 12px', marginBottom: '8px',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                {c.customer_name}{c.customer_phone ? ` • ${c.customer_phone}` : ''}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                📅 {fmtDate(c.start_datetime)} → {fmtDate(c.end_datetime)} • #{c.booking_ref}
              </div>
              <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px', fontWeight: 600 }}>
                {c.reason}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid #f3f4f6' }}>
          <button onClick={onAcknowledge} style={{
            width: '100%', background: '#dc2626', color: '#fff', border: 'none',
            borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            รับทราบ — จะไปจัดการเอง
          </button>
        </div>
      </div>
    </div>
  )
}
