import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import EditBookingForm from './EditBookingForm'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function one(v: any) {
  return Array.isArray(v) ? v[0] : v
}

export default async function EditBookingPage({ params }: { params: { bookingId: string } }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const supabase = createAdminClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booking_ref, branch_id, bike_id, requested_brand, requested_model, daily_rate, customer_name, customer_phone, customer_hotel, notes, start_datetime, end_datetime, status, bikes(license_plate, brand, model, monthly_rate)')
    .eq('id', params.bookingId)
    .single()

  if (!booking || booking.status !== 'confirmed') {
    return (
      <div className="app-wrap">
        <div className="app-header" style={{ background: '#111827' }}>
          <Link href="/staff/home" className="app-header-back">←</Link>
          <div><h1>แก้ไขคิวจอง</h1></div>
        </div>
        <div className="section-pad">
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#9ca3af' }}>
            ไม่พบคิวจองนี้ หรือถูกยกเลิก/ทำรายการไปแล้ว
          </div>
        </div>
      </div>
    )
  }

  const bike = one(booking.bikes)
  let monthlyRate = bike?.monthly_rate ?? booking.daily_rate * 30
  if (!bike && booking.requested_brand && booking.requested_model) {
    const { data: modelBike } = await supabase.from('bikes')
      .select('monthly_rate')
      .eq('branch_id', booking.branch_id).eq('brand', booking.requested_brand).eq('model', booking.requested_model)
      .not('monthly_rate', 'is', null)
      .limit(1).maybeSingle()
    monthlyRate = modelBike?.monthly_rate ?? booking.daily_rate * 30
  }

  return (
    <EditBookingForm
      booking={{
        id: booking.id,
        bookingRef: booking.booking_ref,
        bikeLabel: bike ? `${bike.license_plate} ${bike.brand} ${bike.model}` : `${booking.requested_brand} ${booking.requested_model} (ยังไม่ได้กำหนดรถ)`,
        customerName: booking.customer_name,
        customerPhone: booking.customer_phone,
        customerHotel: booking.customer_hotel ?? '',
        notes: booking.notes ?? '',
        startDatetime: booking.start_datetime,
        endDatetime: booking.end_datetime,
        dailyRate: booking.daily_rate,
      }}
      monthlyRate={monthlyRate}
    />
  )
}
