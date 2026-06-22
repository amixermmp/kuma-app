import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppLayout from '@/components/AppLayout'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: customers } = await supabase.from('customers').select('id,name,phone,id_card,is_blacklisted').order('name')
  const addBtn = <Link href="/customers/new" style={{ color:'#f59e0b',fontWeight:600,fontSize:'15px',textDecoration:'none' }}>+ เพิ่มลูกค้า</Link>
  return (
    <AppLayout title="ลูกค้า" action={addBtn}>
      <div style={{ display:'flex',flexDirection:'column',gap:'10px' }}>
        {customers?.map(c => (
          <Link key={c.id} href={'/customers/'+c.id} style={{ display:'block',background:'#fff',borderRadius:'12px',padding:'14px 16px',textDecoration:'none',color:'inherit',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',borderLeft:c.is_blacklisted?'4px solid #ef4444':'4px solid transparent' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <div>
                <p style={{ fontWeight:700,fontSize:'15px' }}>{c.name}</p>
                <p style={{ color:'#6b7280',fontSize:'13px',marginTop:'2px' }}>{c.phone}</p>
                {c.id_card&&<p style={{ color:'#9ca3af',fontSize:'12px',marginTop:'2px' }}>บัตร: {c.id_card}</p>}
              </div>
              {c.is_blacklisted&&<span style={{ fontSize:'11px',fontWeight:700,padding:'4px 10px',borderRadius:'20px',background:'#fef2f2',color:'#ef4444' }}>แบล็คลิสต์</span>}
            </div>
          </Link>
        ))}
        {(!customers||customers.length===0)&&(
          <div style={{ textAlign:'center',padding:'48px 20px',color:'#9ca3af' }}>
            <p style={{ fontSize:'48px',marginBottom:'12px' }}>👥</p><p>ยังไม่มีลูกค้าในระบบ</p>
            <Link href="/customers/new" style={{ display:'inline-block',marginTop:'16px',background:'#f59e0b',color:'#fff',padding:'10px 24px',borderRadius:'8px',textDecoration:'none',fontWeight:600 }}>+ เพิ่มลูกค้าคนแรก</Link>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
