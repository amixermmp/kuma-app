import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffOwnBranchId } from '@/lib/staffBranch'
import Link from 'next/link'
import BookingConfirmCard from './BookingConfirmCard'

export const dynamic = 'force-dynamic'

// params.bikeId here actually holds the bookingId (same slug level)
export default async function BookingConfirmPage({ params }: { params: { bikeId: string } }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const BRANCH_ID = await getStaffOwnBranchId(staffId)
  const supabase = createAdminClient()

  const [{ data: booking }, { data: settings }, { data: shop }, { data: branchReceipt }] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, bikes(license_plate, brand, model, color, year)')
      .eq('id', params.bikeId)
      .single(),
    supabase
      .from('branch_settings')
      .select('contact_phone, contact_line')
      .eq('branch_id', BRANCH_ID)
      .maybeSingle(),
    supabase
      .from('shop_settings')
      .select('shop_name, address, phone, logo_url')
      .limit(1)
      .maybeSingle(),
    // สาขาตั้งชื่อร้าน/ที่อยู่/เบอร์/โลโก้ ในใบเสร็จเองได้ — ใบจองใช้ข้อมูลเดียวกันนี้
    supabase
      .from('branch_settings')
      .select('receipt_shop_name, receipt_address, receipt_phone, receipt_logo_url')
      .eq('branch_id', BRANCH_ID)
      .maybeSingle(),
  ])

  if (!booking) redirect('/staff/home')

  const resolvedShop = {
    shop_name: branchReceipt?.receipt_shop_name || shop?.shop_name || 'Kuma Rental',
    address: branchReceipt?.receipt_address || shop?.address,
    phone: branchReceipt?.receipt_phone || shop?.phone,
    logo_url: branchReceipt?.receipt_logo_url || shop?.logo_url,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bike = (booking as any).bikes
  // For model-based bookings, bike may be null — use requested fields
  const displayBrand = bike?.brand ?? booking.requested_brand ?? ''
  const displayModel = bike?.model ?? booking.requested_model ?? ''

  return (
    <div className="app-wrap">

      <div className="app-header" style={{ background: '#111827' }}>
        <Link href="/staff/home" className="app-header-back">←</Link>
        <div>
          <h1>ยืนยันการจอง</h1>
          <div className="sub">บันทึกรูปหรือแคปหน้าจอส่งให้ลูกค้าได้เลย</div>
        </div>
      </div>

      <BookingConfirmCard
        bookingRef={booking.booking_ref}
        createdAt={booking.created_at}
        startDatetime={booking.start_datetime}
        endDatetime={booking.end_datetime}
        totalDays={booking.total_days}
        dailyRate={booking.daily_rate != null ? Number(booking.daily_rate) : null}
        displayBrand={displayBrand}
        displayModel={displayModel}
        bike={bike ? { license_plate: bike.license_plate, color: bike.color, year: bike.year } : null}
        customerName={booking.customer_name}
        customerPhone={booking.customer_phone}
        customerHotel={booking.customer_hotel}
        deliveryType={booking.delivery_type}
        deliveryAddress={booking.delivery_address}
        notes={booking.notes}
        shop={resolvedShop}
        contactPhone={settings?.contact_phone ?? null}
        contactLine={settings?.contact_line ?? null}
      />
    </div>
  )
}
