import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppLayout from '@/components/AppLayout'

export const dynamic = 'force-dynamic'

export default async function RentalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rentals } = await supabase
    .from('rentals')
    .select('id, status, expected_end_datetime, daily_rate, bikes(license_plate, brand, model), customers(name, phone)')
    .in('status', ['active', 'extended', 'overdue'])
    .order('expected_end_datetime', { ascending: true })
  const now = new Date()
  const addBtn = <Link href="/rentals/new" style={{ color:'#f59e0b',fontWeight:600,fontSize:'15px',textDecoration:'none' }}>+ เช่าใหม่</Link>
  return (
    <AppLayout title="การเช่าปัจจุบัน" action={addBtn}>
      <div style={{ display:'flex',flexDirection:'column',gap:'10px' }}>
        {rentals?.map(r => {
          const end = new Date(r.expected_end_datetime)
          const diffHrs = Math.round((end.getTime()-now.getTime())/36e5)
          const ov = r.status==='overdue'||diffHrs<0
          const bike = r.bikes as { license_plate:string; brand:string; model:string }|null
          const cust = r.customers as { name:string; phone:string }|null
          return (
            <Link key={r.id} href={'/rentals/'+r.id} style={{ display:'block',background:'#fff',borderRadius:'12px',padding:'14px 16px',textDecoration:'none',color:'inherit',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',borderLeft:'4px solid '+(ov?'#ef4444':'#f59e0b') }}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
                <div style={{ flex:1,marginRight:'10px' }}>
                  <p style={{ fontWeight:700,fontSize:'15px' }}>{bike?.license_plate} <span style={{ fontWeight:400,fontSize:'13px',color:'#6b7280' }}>{bike?.brand} {bike?.model}</span></p>
                  <p style={{ fontSize:'14px',color:'#374151',marginTop:'3px' }}>{cust?.name}</p>
                  <p style={{ fontSize:'12px',color:'#9ca3af',marginTop:'2px' }}>{cust?.phone}</p>
                  <p style={{ fontSize:'12px',color:'#6b7280',marginTop:'5px' }}>คืน: {end.toLocaleDateString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
                </div>
                <div style={{ textAlign:'right',flexShrink:0 }}>
                  <span style={{ display:'inline-block',fontSize:'11px',fontWeight:700,padding:'4px 10px',borderRadius:'20px',marginBottom:'6px',background:ov?'#fef2f2':'#fef3c7',color:ov?'#ef4444':'#d97706' }}>
                    {ov?'เกิน '+Math.floor(Math.abs(diffHrs)/24)+'วัน '+Math.abs(diffHrs)%24+'ชม.':diffHrs<24?'เหลือ '+diffHrs+'ชม.':'เหลือ '+Math.floor(diffHrs/24)+'วัน'}
                  </span>
                  <p style={{ fontSize:'13px',fontWeight:600,color:'#374151' }}>{Number(r.daily_rate).toLocaleString()} บ./วัน</p>
                </div>
              </div>
            </Link>
          )
        })}
        {(!rentals||rentals.length===0)&&(
          <div style={{ textAlign:'center',padding:'48px 20px',color:'#9ca3af' }}>
            <p style={{ fontSize:'48px',marginBottom:'12px' }}>📋</p>
            <p>ไม่มีการเช่า active อยู่</p>
            <Link href="/rentals/new" style={{ display:'inline-block',marginTop:'16px',background:'#f59e0b',color:'#fff',padding:'10px 24px',borderRadius:'8px',textDecoration:'none',fontWeight:600 }}>+ สร้างการเช่าใหม่</Link>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
