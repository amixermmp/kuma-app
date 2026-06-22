import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppLayout from '@/components/AppLayout'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, phone, id_card, is_blacklisted, created_at')
    .order('name')

  const addBtn = (
    <Link href="/customers/new" style={{
      color: '#fff', fontWeight: 700, fontSize: '13px', textDecoration: 'none',
      background: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '8px',
    }}>
      + เพิ่มลูกค้า
    </Link>
  )

  return (
    <AppLayout title="ลูกค้า" subtitle={`${customers?.length ?? 0} คนในระบบ`} action={addBtn} headerStyle="blue">
      {/* Search bar placeholder */}
      <div style={{ background: '#fff', padding: '10px 12px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: '#f9fafb', border: '1.5px solid #e5e7eb',
          borderRadius: '8px', padding: '8px 12px',
          fontSize: '13px', color: '#9ca3af',
        }}>
          🔍 ค้นหาชื่อ หรือเบอร์โทร...
        </div>
      </div>

      <div style={{ padding: '10px 12px' }}>
        {customers?.map(c => (
          <Link key={c.id} href={`/customers/${c.id}`} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            background: '#fff', borderRadius: '12px',
            padding: '14px 16px', marginBottom: '8px',
            textDecoration: 'none', color: 'inherit',
            border: c.is_blacklisted ? '1.5px solid #fecaca' : '1px solid #e5e7eb',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            {/* Avatar */}
            <div style={{
              width: '42px', height: '42px', borderRadius: '50%',
              background: c.is_blacklisted ? '#fef2f2' : '#eff6ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px', fontWeight: 700,
              color: c.is_blacklisted ? '#dc2626' : '#2563eb',
              flexShrink: 0,
            }}>
              {c.name.charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: '14px', margin: 0, color: '#111827' }}>{c.name}</p>
              <p style={{ color: '#6b7280', fontSize: '12px', margin: 0, marginTop: '2px' }}>{c.phone}</p>
              {c.id_card && <p style={{ color: '#9ca3af', fontSize: '11px', margin: 0, marginTop: '1px' }}>บัตร: {c.id_card}</p>}
            </div>
            {c.is_blacklisted && (
              <span style={{
                fontSize: '11px', fontWeight: 700,
                padding: '4px 10px', borderRadius: '20px',
                background: '#fef2f2', color: '#dc2626', flexShrink: 0,
              }}>
                แบล็คลิสต์
              </span>
            )}
          </Link>
        ))}

        {(!customers || customers.length === 0) && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9ca3af' }}>
            <p style={{ fontSize: '48px', marginBottom: '12px' }}>👥</p>
            <p style={{ fontSize: '15px' }}>ยังไม่มีลูกค้าในระบบ</p>
            <Link href="/customers/new" style={{
              display: 'inline-block', marginTop: '16px',
              background: '#2563eb', color: '#fff',
              padding: '10px 24px', borderRadius: '8px',
              textDecoration: 'none', fontWeight: 600,
            }}>
              + เพิ่มลูกค้าคนแรก
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
