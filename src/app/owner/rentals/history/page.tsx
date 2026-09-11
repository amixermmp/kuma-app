import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import HistoryClient from './HistoryClient'

export const dynamic = 'force-dynamic'

const PHOTO_LABEL: Record<string, string> = {
  id_card: 'บัตรประชาชน/พาสปอร์ต',
  selfie: 'เซลฟี่',
  with_bike: 'รูปคู่รถ',
  damage: 'รูปตำหนิ',
  payment: 'สลิปโอนเงิน',
  student_id_card: 'บัตรนักศึกษา',
  accommodation_proof: 'หลักฐานที่พัก',
}

// send_photos เก็บ 2 รูปแบบ: รายวัน = object {category: url}, รายเดือน = array [{label, url}] — แปลงให้เป็นรูปแบบเดียวกัน
function normalizePhotos(photos: unknown): { label: string; url: string }[] {
  if (!photos) return []
  if (Array.isArray(photos)) {
    return photos
      .filter((p): p is { label?: string; url: string } => !!p && typeof p === 'object' && typeof p.url === 'string' && p.url.length > 0)
      .map(p => ({ label: PHOTO_LABEL[p.label ?? ''] ?? p.label ?? '', url: p.url }))
  }
  if (typeof photos === 'object') {
    return Object.entries(photos as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0)
      .map(([key, url]) => ({ label: PHOTO_LABEL[key] ?? key, url }))
  }
  return []
}

export default async function OwnerRentalHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()

  const [{ data: dailyRentals }, { data: monthlyRentals }] = await Promise.all([
    admin
      .from('rentals')
      .select(`
        id, start_datetime, actual_end_datetime, total_amount,
        send_odometer, return_odometer, send_photos, return_photos,
        bikes(id, license_plate, brand, model, color),
        customers(name, phone)
      `)
      .eq('status', 'returned')
      .order('actual_end_datetime', { ascending: false })
      .limit(300),
    admin
      .from('monthly_rentals')
      .select(`
        id, start_date, end_date, monthly_rate,
        send_odometer, return_odometer, send_photos, return_photos,
        bikes(id, license_plate, brand, model, color),
        customers(name, phone)
      `)
      .eq('status', 'ended')
      .order('end_date', { ascending: false })
      .limit(300),
  ])

  const withPhotos = <T extends { send_photos: unknown; return_photos: unknown }>(rows: T[]) =>
    rows.map(r => ({ ...r, sendPhotos: normalizePhotos(r.send_photos), returnPhotos: normalizePhotos(r.return_photos) }))

  // ใบเสร็จของแต่ละสัญญา — ดึงเป็นชุดเดียวแล้วจับกลุ่มเอง กันยิง query ทีละคัน
  const dailyIds = (dailyRentals ?? []).map(r => r.id)
  const monthlyIds = (monthlyRentals ?? []).map(r => r.id)
  const [{ data: dailyPayments }, { data: monthlyPayments }] = await Promise.all([
    dailyIds.length
      ? admin.from('rental_payments').select('id, rental_id, kind, amount, paid_at').in('rental_id', dailyIds).is('voided_at', null).order('paid_at')
      : Promise.resolve({ data: [] as { id: string; rental_id: string; kind: string; amount: number; paid_at: string }[] }),
    monthlyIds.length
      ? admin.from('monthly_payments').select('id, monthly_rental_id, amount, paid_date').in('monthly_rental_id', monthlyIds).is('voided_at', null).order('paid_date')
      : Promise.resolve({ data: [] as { id: string; monthly_rental_id: string; amount: number; paid_date: string }[] }),
  ])

  const dailyList = withPhotos(dailyRentals ?? []).map(r => ({
    ...r, payments: (dailyPayments ?? []).filter(p => p.rental_id === r.id),
  }))
  const monthlyList = withPhotos(monthlyRentals ?? []).map(r => ({
    ...r, payments: (monthlyPayments ?? []).filter(p => p.monthly_rental_id === r.id),
  }))

  return <HistoryClient dailyRentals={dailyList} monthlyRentals={monthlyList} />
}
