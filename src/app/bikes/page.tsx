import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppLayout from '@/components/AppLayout'

export const dynamic = 'force-dynamic'

const sC: Record<string,string> = { available:'#10b981',rented:'#f59e0b',maintenance:'#ef4444',monthly:'#6366f1' }
const sL: Record<string,string> = { available:'ว่าง',rented:'เช่าอยู่',maintenance:'ซ่อม',monthly:'รายเดือน' }

export default async function BikesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: bikes } = await supabase.from('bikes').select('*').order('status').order('license_plate')
  const addBtn = <Link href="/bikes/new" style={{ color:'#f59e0b',fontWeight:600,fontSize:'15px',textDecoration:'none' }}>+ เพิ่มรถ</Link>
  return (
    <AppLayout title="รถทั้งหมด" action={addBtn}>
      <div style={{ display:'flex',flexDirection:'column',gap:'10px' }}>
        {bikes?.map(bike => (
          <Link key={bike.id} href={'/bikes/'+bike.id} style={{ display:'block',background:'#fff',borderRadius:'12px',padding:'14px 16px',textDecoration:'none',color:'inherit',boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <div>
                <p style={{ fontWeight:700,fontSize:'15px' }}>{bike.license_plate}</p>
                <p style={{ color:'#6b7280',fontSize:'13px',marginTop:'2px' }}>{bike.brand} {bike.model}{bike.color?' · '+bike.color:''}</p>
                <p style={{ color:'#374151',fontSize:'13px',marginTop:'4px',fontWeight:500 }}>{Number(bike.daily_rate).toLocaleString()} บ./วัน{bike.monthly_rate?' · '+Number(bike.monthly_rate).toLocaleString()+' บ./เดือน':''}</p>
              </div>
              <span style={{ fontSize:'12px',fontWeight:700,padding:'5px 12px',borderRadius:'20px',background:(sC[bike.status]??'#6b7280')+'20',color:sC[bike.status]??'#6b7280' }}>{sL[bike.status]??bike.status}</span>
            </div>
          </Link>
        ))}
        {(!bikes||bikes.length===0)&&(
          <div style={{ textAlign:'center',padding:'48px 20px',color:'#9ca3af' }}>
            <p style={{ fontSize:'48px',marginBottom:'12px' }}>🏍️</p>
            <p>ยังไม่มีรถในระบบ</p>
            <Link href="/bikes/new" style={{ display:'inline-block',marginTop:'16px',background:'#f59e0b',color:'#fff',padding:'10px 24px',borderRadius:'8px',textDecoration:'none',fontWeight:600 }}>+ เพิ่มรถคันแรก</Link>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
