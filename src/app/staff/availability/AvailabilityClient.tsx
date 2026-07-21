'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import TabBar from '@/components/staff/TabBar'

type Group = {
  branchId: string; branchName: string; brand: string; model: string
  total: number; rawAvailable: number; modelDemand: number; netAvailable: number
}

function fmtDateLabel(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00+07:00`)
  return d.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AvailabilityClient({ date, groups, multiBranch }: { date: string; groups: Group[]; multiBranch: boolean }) {
  const router = useRouter()

  const shiftDate = (deltaDays: number) => {
    const d = new Date(`${date}T12:00:00+07:00`)
    d.setDate(d.getDate() + deltaDays)
    const next = d.toISOString().split('T')[0]
    router.push(`/staff/availability?date=${next}`)
  }

  const overbooked = groups.filter(g => g.netAvailable < 0)

  return (
    <div className="app-wrap" style={{ background: '#f8fafc' }}>
      <div style={{
        background: 'var(--red)', color: '#fff', padding: '16px', borderRadius: '0 0 22px 22px',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <Link href="/staff/home" style={{
          background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff',
          width: '32px', height: '32px', borderRadius: '50%', fontSize: '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
        }}>←</Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '17px', fontWeight: 700 }}>ภาพรวมรถว่าง</div>
          <div style={{ fontSize: '12px', opacity: .8, marginTop: '2px' }}>ดูตามวัน แยกรุ่น</div>
        </div>
      </div>
      <TabBar />

      <div style={{ padding: '16px', marginTop: '-14px' }}>

        {/* Date picker */}
        <div style={{
          background: '#fff', borderRadius: '14px', padding: '10px 12px', marginBottom: '14px',
          boxShadow: '0 4px 14px rgba(225,29,72,.15)', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <button onClick={() => shiftDate(-1)} style={{
            width: '36px', height: '36px', borderRadius: '10px', border: '1.5px solid #e5e7eb',
            background: '#f9fafb', fontSize: '16px', cursor: 'pointer', flexShrink: 0,
          }}>‹</button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <input
              type="date"
              value={date}
              onChange={e => router.push(`/staff/availability?date=${e.target.value}`)}
              style={{
                border: 'none', fontSize: '14px', fontWeight: 700, color: '#111827',
                textAlign: 'center', width: '100%', fontFamily: 'inherit', outline: 'none',
              }}
            />
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{fmtDateLabel(date)}</div>
          </div>
          <button onClick={() => shiftDate(1)} style={{
            width: '36px', height: '36px', borderRadius: '10px', border: '1.5px solid #e5e7eb',
            background: '#f9fafb', fontSize: '16px', cursor: 'pointer', flexShrink: 0,
          }}>›</button>
        </div>

        {overbooked.length > 0 && (
          <div style={{
            background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '12px',
            padding: '12px 14px', marginBottom: '14px', fontSize: '13px', color: '#dc2626', fontWeight: 700,
          }}>
            ⚠️ มี {overbooked.length} รุ่นที่เกินจอง (overbooking) วันนี้ — ต้องจัดการหารถให้ลูกค้า
          </div>
        )}

        {groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af', fontSize: '14px' }}>
            ไม่มีข้อมูลรถในสาขานี้
          </div>
        ) : (
          groups.map(g => {
            const negative = g.netAvailable < 0
            const tight = !negative && g.netAvailable <= 1
            const color = negative ? '#dc2626' : tight ? '#d97706' : '#16a34a'
            const bg = negative ? '#fef2f2' : tight ? '#fffbeb' : '#f0fdf4'
            return (
              <div key={`${g.branchId}__${g.brand}__${g.model}`} style={{
                background: '#fff', borderRadius: '12px', marginBottom: '8px', padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,.06)', borderLeft: `4px solid ${color}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{g.brand} {g.model}</div>
                  {multiBranch && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>{g.branchName}</div>}
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '3px' }}>
                    ทั้งหมด {g.total} คัน • ว่างจริง {g.rawAvailable} คัน{g.modelDemand > 0 ? ` • จองไว้ ${g.modelDemand} คิว` : ''}
                  </div>
                </div>
                <div style={{
                  minWidth: '52px', textAlign: 'center', padding: '6px 10px', borderRadius: '10px',
                  background: bg, color, fontSize: '18px', fontWeight: 900, flexShrink: 0,
                }}>
                  {g.netAvailable > 0 ? `+${g.netAvailable}` : g.netAvailable}
                </div>
              </div>
            )
          })
        )}

      </div>
    </div>
  )
}
