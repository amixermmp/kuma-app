import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function QRPage({ params }: { params: { bikeId: string } }) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/owner/login')

  const supabase = createAdminClient()
  const { data: bike } = await supabase
    .from('bikes')
    .select('id, license_plate, brand, model, color, year')
    .eq('id', params.bikeId)
    .single()

  if (!bike) redirect('/staff/home')

  const publicUrl = `https://kuma-app.vercel.app/bike/${bike.id}`
  const qrDataUrl = await QRCode.toDataURL(publicUrl, {
    width: 300,
    margin: 2,
    color: { dark: '#1e293b', light: '#ffffff' },
  })

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: '#111827' }}>
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div>
          <h1>QR Code รถ</h1>
          <div className="sub">{bike.license_plate}</div>
        </div>
      </div>

      <div className="section-pad" style={{ paddingTop: '20px', textAlign: 'center' }}>

        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: '12px', padding: '12px 16px', marginBottom: '20px',
          fontSize: '13px', color: '#15803d',
        }}>
          ✅ เพิ่มรถเรียบร้อยแล้ว!
        </div>

        <div className="card" style={{ padding: '24px', alignItems: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
            ลูกค้าสแกน QR นี้เพื่อดูข้อมูลรถ
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="QR Code" style={{ width: 220, height: 220 }} />
          <div style={{ fontWeight: 700, fontSize: '18px', letterSpacing: '1px', marginTop: '4px' }}>
            {bike.license_plate}
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>
            {bike.brand} {bike.model}{bike.year ? ` (${bike.year})` : ''}{bike.color ? ` • ${bike.color}` : ''}
          </div>
        </div>

        <div style={{ fontSize: '11px', color: '#9ca3af', margin: '8px 0 4px' }}>
          พิมพ์และติด QR นี้ที่ตัวรถ
        </div>

        <a href={publicUrl} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '12px', color: '#374151', wordBreak: 'break-all', display: 'block', margin: '0 0 20px' }}>
          {publicUrl}
        </a>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <a href={qrDataUrl} download={`QR-${bike.license_plate}.png`}
            className="btn btn-primary" style={{ width: '100%', textAlign: 'center', padding: '13px', display: 'block' }}>
            ⬇️ ดาวน์โหลด QR (PNG)
          </a>
          <Link href={`/staff/bikes/${bike.id}/edit`}
            className="btn" style={{ width: '100%', textAlign: 'center', padding: '13px', display: 'block' }}>
            ✏️ แก้ไขข้อมูลรถ
          </Link>
          <Link href="/staff/bikes/add"
            className="btn" style={{ width: '100%', textAlign: 'center', padding: '13px', display: 'block' }}>
            + เพิ่มรถคันต่อไป
          </Link>
        </div>

      </div>
    </div>
  )
}
