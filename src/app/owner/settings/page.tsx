import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const CATEGORIES = [
  { icon: '🏢', label: 'ร้านค้า', sub: 'ข้อมูลร้าน, สาขา, ราคา/ค่าล่วงเวลา', href: '/owner/settings/shop', color: '#111827' },
  { icon: '👤', label: 'พนักงาน', sub: 'เพิ่ม/แก้ไข/ปิดการใช้งานพนักงาน', href: '/owner/settings/staff', color: '#374151' },
  { icon: '🎁', label: 'โปรโมชั่น', sub: 'จัดการส่วนลด/แพ็คเกจ', href: '/owner/settings/promos', color: '#be185d' },
  { icon: '📄', label: 'เอกสารร้าน', sub: 'สัญญา/ข้อกำหนด/คู่มือ ขึ้นทุกคัน', href: '/owner/settings/docs', color: '#0369a1' },
  { icon: '🔔', label: 'แจ้งเตือน', sub: 'เกณฑ์แจ้งเตือน + LINE ทั้งร้าน/รายสาขา', href: '/owner/settings/notifications', color: '#00b900' },
  { icon: '🖼️', label: 'รูปโปรโมท', sub: 'กรอบ/สติ๊กเกอร์ปิดหน้า รายสาขา', href: '/owner/settings/marketing', color: '#a78bfa' },
] as const

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: '#111827' }}>
        <Link href="/owner/dashboard" className="app-header-back">←</Link>
        <div style={{ flex: 1 }}>
          <h1>ตั้งค่าระบบ</h1>
          <div className="sub">Owner — จัดการร้าน</div>
        </div>
        <div style={{ fontSize: '28px' }}>👑</div>
      </div>

      <div style={{ margin: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {CATEGORIES.map(({ icon, label, sub, href, color }) => (
          <Link key={href} href={href} style={{ textDecoration: 'none' }}>
            <div style={{
              background: '#fff', borderRadius: '14px', padding: '16px',
              boxShadow: '0 1px 4px rgba(0,0,0,.07)',
              display: 'flex', alignItems: 'center', gap: '14px',
              borderLeft: `4px solid ${color}`,
            }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                background: `${color}15`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '22px',
              }}>{icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>{label}</div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{sub}</div>
              </div>
              <div style={{ color: '#d1d5db', fontSize: '18px' }}>›</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
