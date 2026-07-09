import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import QRCode from 'qrcode'
import Link from 'next/link'
import LineLinkClient from './LineLinkClient'

export const dynamic = 'force-dynamic'

export default async function StaffLineLinkPage({ params }: { params: { rentalId: string } }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()
  const { data: rental } = await supabase
    .from('rentals')
    .select('id, branch_id, customer_id, customers(name, phone), bikes(id, license_plate, brand, model)')
    .eq('id', params.rentalId)
    .in('status', ['active', 'extended'])
    .single()

  if (!rental) redirect('/staff/home')

  const [{ data: settings }, { data: link }] = await Promise.all([
    supabase
      .from('branch_settings')
      .select('line_liff_id')
      .eq('branch_id', rental.branch_id)
      .maybeSingle(),
    supabase
      .from('customer_line_links')
      .select('id')
      .eq('customer_id', rental.customer_id)
      .eq('branch_id', rental.branch_id)
      .maybeSingle(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customer = rental.customers as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bike = rental.bikes as any

  if (!settings?.line_liff_id) {
    return (
      <div className="app-wrap">
        <div className="app-header" style={{ background: '#06c755' }}>
          <Link href={`/staff/bikes/${bike?.id}/menu`} className="app-header-back">←</Link>
          <div><h1>ผูกไลน์ลูกค้า</h1></div>
        </div>
        <div className="section-pad" style={{ paddingTop: '20px' }}>
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '12px', padding: '16px', fontSize: '14px', color: '#991b1b',
          }}>
            ⚠️ สาขานี้ยังไม่ได้ตั้งค่า LIFF ID<br />
            <span style={{ fontSize: '13px', color: '#6b7280' }}>
              ให้เจ้าของร้านไปตั้งค่าที่ เมนูเจ้าของ → ตั้งค่า → LINE แจ้งเตือนลูกค้า (รายสาขา)
            </span>
          </div>
        </div>
      </div>
    )
  }

  const liffUrl = `https://liff.line.me/${settings.line_liff_id}?rental=${rental.id}`
  const qrDataUrl = await QRCode.toDataURL(liffUrl, {
    width: 300,
    margin: 2,
    color: { dark: '#06c755', light: '#ffffff' },
  })

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: '#06c755' }}>
        <Link href={`/staff/bikes/${bike?.id}/menu`} className="app-header-back">←</Link>
        <div>
          <h1>ผูกไลน์ลูกค้า</h1>
          <div className="sub">{bike?.license_plate} • คุณ{customer?.name}</div>
        </div>
      </div>

      <div className="section-pad" style={{ paddingTop: '20px', textAlign: 'center' }}>

        <div className="card" style={{ padding: '24px', alignItems: 'center', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
            💬 ให้ลูกค้าสแกน QR นี้ด้วยมือถือ
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            เปิดใน LINE → แอดไลน์ร้าน → ระบบผูกกับสัญญาอัตโนมัติ
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="LINE Link QR" style={{ width: 220, height: 220 }} />
          <div style={{ fontWeight: 700, fontSize: '15px' }}>
            คุณ{customer?.name} {customer?.phone ? `• ${customer.phone}` : ''}
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>
            {bike?.brand} {bike?.model} • {bike?.license_plate}
          </div>
        </div>

        <div style={{ marginTop: '14px' }}>
          <LineLinkClient statusQuery={`rentalId=${rental.id}`} initialLinked={Boolean(link)} />
        </div>

        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '14px' }}>
          ผูกแล้วระบบจะแจ้งเตือนลูกค้าทางไลน์อัตโนมัติ<br />
          เมื่อใกล้ครบกำหนดคืนรถ และเมื่อเกินกำหนด
        </div>

      </div>
    </div>
  )
}
