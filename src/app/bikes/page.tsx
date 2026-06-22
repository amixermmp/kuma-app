import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppLayout from '@/components/AppLayout'

export const dynamic = 'force-dynamic'

export default async function BikesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: bikes } = await supabase
    .from('bikes')
    .select('id, license_plate, brand, model, color, year, status, daily_rate, odometer, compulsory_expiry, insurance_expiry, tax_expiry, oil_change_km, last_oil_change_km, branches(name)')
    .order('license_plate')

  const available = bikes?.filter(b => b.status === 'available') ?? []
  const rented    = bikes?.filter(b => b.status === 'rented' || b.status === 'monthly') ?? []
  const repair    = bikes?.filter(b => b.status === 'maintenance') ?? []

  const addBtn = (
    <Link href="/bikes/new" style={{
      color: '#fff', fontWeight: 700, fontSize: '13px', textDecoration: 'none',
      background: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '8px',
    }}>
      + เพิ่มรถ
    </Link>
  )

  type Bike = NonNullable<typeof bikes>[0]

  function docWarning(bike: Bike): string | null {
    const now = Date.now()
    const dates = [bike.compulsory_expiry, bike.insurance_expiry, bike.tax_expiry].filter(Boolean) as string[]
    for (const d of dates) {
      const days = Math.ceil((new Date(d).getTime() - now) / 86400000)
      if (days <= 30) return `⚠️ เอกสารใกล้หมด ${days} วัน`
    }
    return null
  }

  function oilWarning(bike: Bike): string | null {
    const km = (bike.odometer ?? 0) - (bike.last_oil_change_km ?? 0)
    const limit = bike.oil_change_km ?? 3000
    if (km >= limit * 0.9) return '🛢️ ใกล้เปลี่ยนน้ำมัน'
    return null
  }

  function BikeRow({ bike }: { bike: Bike }) {
    const branch = bike.branches as unknown as { name: string } | null
    const doc = docWarning(bike)
    const oil = oilWarning(bike)
    const dotColor = bike.status === 'available' ? '#16a34a'
      : bike.status === 'maintenance' ? '#dc2626' : '#2563eb'

    return (
      <Link href={'/bikes/' + bike.id} style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px 14px', borderBottom: '1px solid #f3f4f6',
        textDecoration: 'none', color: 'inherit',
      }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <div style={{ fontSize: '22px', flexShrink: 0 }}>🛵</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>{bike.license_plate}</div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '1px' }}>
            {bike.brand} {bike.model}{bike.year ? ` • ปี ${bike.year}` : ''}{bike.color ? ` • ${bike.color}` : ''}
          </div>
          {(branch || doc || oil) && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
              {branch && <span style={tagStyle}>{branch.name}</span>}
              {doc && <span style={{ ...tagStyle, background: '#fef2f2', color: '#dc2626' }}>{doc}</span>}
              {oil && <span style={{ ...tagStyle, background: '#fffbeb', color: '#d97706' }}>{oil}</span>}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>฿{Number(bike.daily_rate).toLocaleString()}/วัน</div>
          {bike.odometer ? <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>{bike.odometer.toLocaleString()} กม.</div> : null}
        </div>
      </Link>
    )
  }

  return (
    <AppLayout title="สต็อครถทั้งหมด" subtitle={(bikes?.length ?? 0) + ' คัน'} action={addBtn} headerStyle="dark">

      {/* Status strip */}
      <div style={{ background: '#fff', display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
        {[
          { count: available.length, label: 'ว่าง',    color: '#16a34a' },
          { count: rented.length,    label: 'เช่าอยู่', color: '#2563eb' },
          { count: repair.length,    label: 'ซ่อม',     color: '#dc2626' },
        ].map((s, i, arr) => (
          <div key={s.label} style={{
            flex: 1, textAlign: 'center', padding: '10px',
            borderRight: i < arr.length - 1 ? '1px solid #e5e7eb' : 'none',
          }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* List */}
      <div style={{ background: '#fff' }}>
        {available.length > 0 && (
          <>
            <SectionHeader color="#16a34a">🟢 ว่าง ({available.length})</SectionHeader>
            {available.map(b => <BikeRow key={b.id} bike={b} />)}
          </>
        )}
        {rented.length > 0 && (
          <>
            <SectionHeader color="#2563eb">🔵 เช่าอยู่ ({rented.length})</SectionHeader>
            {rented.map(b => <BikeRow key={b.id} bike={b} />)}
          </>
        )}
        {repair.length > 0 && (
          <>
            <SectionHeader color="#dc2626">🔴 ซ่อม ({repair.length})</SectionHeader>
            {repair.map(b => <BikeRow key={b.id} bike={b} />)}
          </>
        )}
      </div>

      {(!bikes || bikes.length === 0) && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>🛵</p>
          <p style={{ fontSize: '15px' }}>ยังไม่มีรถในระบบ</p>
          <Link href="/bikes/new" style={{
            display: 'inline-block', marginTop: '16px',
            background: '#1e3a8a', color: '#fff',
            padding: '10px 24px', borderRadius: '8px',
            textDecoration: 'none', fontWeight: 600,
          }}>
            + เพิ่มรถคันแรก
          </Link>
        </div>
      )}
    </AppLayout>
  )
}

const tagStyle: React.CSSProperties = {
  fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
  background: '#f3f4f6', color: '#6b7280',
}

function SectionHeader({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{
      padding: '8px 14px', fontSize: '11px', fontWeight: 700,
      color, background: '#f9fafb', textTransform: 'uppercase', letterSpacing: '0.5px',
      borderBottom: '1px solid #f3f4f6',
    }}>
      {children}
    </div>
  )
}
