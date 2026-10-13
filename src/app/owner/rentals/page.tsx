import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import RentalsClient from './RentalsClient'

export const dynamic = 'force-dynamic'

export default async function OwnerRentalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()

  const [{ data: dailyRentals }, { data: monthlyRentals }, { data: branchRows }] = await Promise.all([
    admin
      .from('rentals')
      .select(`
        id, branch_id, start_datetime, expected_end_datetime, status,
        daily_rate, total_days, total_amount, deposit_amount, payment_method,
        send_photos, notes,
        bikes(id, license_plate, brand, model, color),
        customers(name, phone)
      `)
      .in('status', ['active', 'extended', 'overdue'])
      .order('created_at', { ascending: false }),
    admin
      .from('monthly_rentals')
      .select(`
        id, branch_id, start_date, payment_day, monthly_rate, deposit_amount, status,
        send_photos,
        bikes(id, license_plate, brand, model, color),
        customers(name, phone)
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    admin.from('branches').select('id, name'),
  ])

  // ป้ายสาขาที่เปิดสัญญา (ชื่อเต็ม ไม่ใช่สาขาที่รถอยู่ตอนนี้)
  const branchNameById = new Map((branchRows ?? []).map(b => [b.id, b.name]))
  const withBranch = <T extends { branch_id: string | null }>(rows: T[]) =>
    rows.map(r => ({ ...r, branchName: (r.branch_id && branchNameById.get(r.branch_id)) || '' }))

  return <RentalsClient dailyRentals={withBranch(dailyRentals ?? [])} monthlyRentals={withBranch(monthlyRentals ?? [])} />
}
