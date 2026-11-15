import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import ContractView from './ContractView'
import { buildContractSummary, bangkokTodayLocal } from '@/lib/contractSummary'
import { utcToBangkokLocal } from '@/lib/time'

export const dynamic = 'force-dynamic'

export default async function ContractPage({ params }: { params: Promise<{ rentalId: string }> }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const { rentalId } = await params
  const supabase = createAdminClient()

  const [{ data: rental }, { data: shop }] = await Promise.all([
    supabase
      .from('rentals')
      .select(`
        id, branch_id, start_datetime, expected_end_datetime, total_days, daily_rate,
        total_amount, deposit_amount, discount, payment_method, created_at, notes,
        customer_signature, send_fuel_full, return_type, return_address, return_fee,
        bikes(license_plate, brand, model, color, lessor_profiles(name, id_card_number, signature_data)),
        customers(name, phone, workplace)
      `)
      .eq('id', rentalId)
      .single(),
    supabase
      .from('shop_settings')
      .select('shop_name, address, phone, tax_id')
      .limit(1)
      .maybeSingle(),
  ])

  if (!rental) redirect('/staff/home')

  // สาขาตั้งชื่อร้าน/ที่อยู่/เบอร์/โลโก้ ในใบเสร็จเองได้ — ไม่ตั้งค่าใช้ของร้านกลางแทน (เอามาใช้กับสัญญาด้วย)
  const [{ data: branch }, { data: branchReceipt }] = await Promise.all([
    supabase.from('branches').select('name').eq('id', rental.branch_id).maybeSingle(),
    supabase.from('branch_settings')
      .select('receipt_shop_name, receipt_address, receipt_phone, receipt_logo_url, document_theme, contact_phone')
      .eq('branch_id', rental.branch_id)
      .maybeSingle(),
  ])
  const resolvedShop = {
    shop_name: branchReceipt?.receipt_shop_name || shop?.shop_name,
    address: branchReceipt?.receipt_address || shop?.address,
    phone: branchReceipt?.receipt_phone || shop?.phone,
    logo_url: branchReceipt?.receipt_logo_url || null,
  }
  const theme = branchReceipt?.document_theme === 'zame' ? 'zame' : 'kuma'

  // ข้อความสรุปให้พนักงานก๊อปส่งลูกค้า — จากสัญญาที่บันทึกแล้ว (กำหนดคืนเป็นเวลาล่าสุด ถ้าเคยต่อเวลาจะเป็นเวลาที่ต่อแล้ว)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bikeRow = (Array.isArray((rental as any).bikes) ? (rental as any).bikes[0] : (rental as any).bikes) ?? {}
  const summaryText = buildContractSummary({
    theme, type: 'daily',
    brand: bikeRow.brand ?? '', model: bikeRow.model ?? '', plate: bikeRow.license_plate ?? '',
    startLocal: utcToBangkokLocal(rental.start_datetime),
    endLocal: utcToBangkokLocal(rental.expected_end_datetime),
    fuelFull: rental.send_fuel_full !== false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    returnType: (rental as any).return_type, returnAddress: (rental as any).return_address, returnFee: Number((rental as any).return_fee ?? 0),
    emergencyPhone: branchReceipt?.contact_phone || branchReceipt?.receipt_phone || null,
    todayLocal: bangkokTodayLocal(),
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ContractView rental={rental as any} shop={resolvedShop} branchName={branch?.name ?? null} theme={theme} summaryText={summaryText} />
}
