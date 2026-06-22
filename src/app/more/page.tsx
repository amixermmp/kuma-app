'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/AppLayout'
import Link from 'next/link'

const menuSections = [
  {
    title: 'จัดการ',
    items: [
      { icon: '📅', label: 'เช่ารายเดือน', desc: 'จัดการสัญญารายเดือน', href: '/monthly', color: '#7c3aed' },
      { icon: '🔧', label: 'งานซ่อม', desc: 'บันทึกและติดตามงานซ่อม', href: '/repairs', color: '#d97706' },
    ],
  },
  {
    title: 'การเงิน',
    items: [
      { icon: '💸', label: 'ค่าใช้จ่าย', desc: 'บันทึกค่าใช้จ่ายประจำ', href: '/expenses', color: '#dc2626' },
      { icon: '📊', label: 'รายงาน', desc: 'ภาพรวมรายได้และสถิติ', href: '/reports', color: '#16a34a' },
    ],
  },
  {
    title: 'ระบบ',
    items: [
      { icon: '⚙️', label: 'ตั้งค่า', desc: 'จัดการสาขา โปรโมชั่น การแจ้งเตือน', href: '/settings', color: '#6b7280' },
    ],
  },
]

export default function MorePage() {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <AppLayout title="เพิ่มเติม" headerStyle="blue">
      <div style={{ padding: '12px' }}>
        {menuSections.map(section => (
          <div key={section.title} style={{ marginBottom: '20px' }}>
            <div style={{
              fontSize: '11px', fontWeight: 700, color: '#6b7280',
              textTransform: 'uppercase', letterSpacing: '0.5px',
              marginBottom: '8px', paddingLeft: '4px',
            }}>
              {section.title}
            </div>
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              {section.items.map((item, i) => (
                <Link key={item.href} href={item.href} style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 16px',
                  borderBottom: i < section.items.length - 1 ? '1px solid #f3f4f6' : 'none',
                  textDecoration: 'none', color: 'inherit',
                }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    background: item.color + '15',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '20px', flexShrink: 0,
                  }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{item.label}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '1px' }}>{item.desc}</div>
                  </div>
                  <span style={{ color: '#d1d5db', fontSize: '18px' }}>›</span>
                </Link>
              ))}
            </div>
          </div>
        ))}

        <button
          onClick={handleLogout}
          style={{
            width: '100%', padding: '14px',
            background: '#fef2f2', color: '#dc2626',
            border: '1px solid #fecaca', borderRadius: '12px',
            fontSize: '15px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          🚪 ออกจากระบบ
        </button>
      </div>
    </AppLayout>
  )
}
