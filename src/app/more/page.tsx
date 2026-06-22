'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/AppLayout'
import Link from 'next/link'

const menuItems = [
  { icon: '📅', label: 'เช่ารายเดือน', href: '/monthly' },
  { icon: '🔧', label: 'งานซ่อม', href: '/repairs' },
  { icon: '💰', label: 'ค่าใช้จ่าย', href: '/expenses' },
  { icon: '📊', label: 'รายงาน', href: '/reports' },
  { icon: '⚙️', label: 'ตั้งค่า', href: '/settings' },
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
    <AppLayout title="เพิ่มเติม">
      <div style={{ display:'flex',flexDirection:'column',gap:'10px',marginBottom:'20px' }}>
        {menuItems.map(item => (
          <Link key={item.href} href={item.href} style={{ display:'flex',alignItems:'center',gap:'14px',background:'#fff',borderRadius:'12px',padding:'16px',textDecoration:'none',color:'inherit',boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
            <span style={{ fontSize:'22px' }}>{item.icon}</span>
            <span style={{ fontSize:'15px',fontWeight:500 }}>{item.label}</span>
            <span style={{ marginLeft:'auto',color:'#d1d5db',fontSize:'18px' }}>›</span>
          </Link>
        ))}
      </div>
      <button onClick={handleLogout} style={{ width:'100%',padding:'14px',background:'#fef2f2',color:'#ef4444',border:'none',borderRadius:'12px',fontSize:'15px',fontWeight:600,cursor:'pointer' }}>
        ออกจากระบบ
      </button>
    </AppLayout>
  )
}
