import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import InvoiceView from '../../[paymentId]/InvoiceView'

export const dynamic = 'force-dynamic'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function invoiceNumber(paymentId: string, paidAt: string) {
  const year = new Date(paidAt).getFullYear() + 543
  return `RCT-${year}-${paymentId.slice(0, 6).toUpperCase()}`
}

export default async function MonthlyInvoicePage({ params }: { params: Promise<{ paymentId: string }> }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const { paymentId } = await params
  const supabase = createAdminClient()

  const { data: payment } = await supabase
    .from('monthly_payments')
    .select(`
      id, monthly_rental_id, due_date, paid_date, amount, payment_method,
      monthly_rentals(
        start_date, payment_day, deposit_amount, branch_id,
        billing_name, billing_address, billing_id,
        bikes(license_plate, brand, model),
        customers(name, phone, workplace)
      )
    `)
    .eq('id', paymentId)
    .single()

  if (!payment) redirect('/staff/home')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rental = (payment as any).monthly_rentals
  if (!rental) redirect('/staff/home')

  // งวดแรก (ตอนสร้างสัญญา) ถึงจะมีมัดจำแสดงในใบเสร็จ — เช็คจาก due_date เรียงจากน้อยไปมาก
  const { data: allPayments } = await supabase
    .from('monthly_payments')
    .select('id')
    .eq('monthly_rental_id', payment.monthly_rental_id)
    .is('voided_at', null)
    .order('due_date', { ascending: true })
  const isFirstPayment = (allPayments ?? [])[0]?.id === payment.id

  const { data: shop } = await supabase
    .from('shop_settings')
    .select('shop_name, address, phone, tax_id, logo_url')
    .limit(1)
    .maybeSingle()

  // สาขาตั้งชื่อร้าน/ที่อยู่/เบอร์/โลโก้ ในใบเสร็จเองได้ — ไม่ตั้งค่าใช้ของร้านกลางแทน
  const { data: branchReceipt } = await supabase
    .from('branch_settings')
    .select('receipt_shop_name, receipt_address, receipt_phone, receipt_logo_url')
    .eq('branch_id', rental.branch_id)
    .maybeSingle()
  const resolvedShop = {
    ...shop,
    shop_name: branchReceipt?.receipt_shop_name || shop?.shop_name,
    address: branchReceipt?.receipt_address || shop?.address,
    phone: branchReceipt?.receipt_phone || shop?.phone,
    logo_url: branchReceipt?.receipt_logo_url || shop?.logo_url,
  }

  const bike = rental.bikes
  const bikeLine = `${bike?.brand ?? ''} ${bike?.model ?? ''} • ${bike?.license_plate ?? ''}`

  const invoicePayment = {
    id: payment.id,
    invoiceNo: invoiceNumber(payment.id, payment.paid_date),
    itemLabel: isFirstPayment ? 'เช่ารถจักรยานยนต์ (รายเดือน)' : 'ค่าเช่ารายเดือน',
    itemDetail: isFirstPayment
      ? `${bikeLine}\nเริ่ม ${fmtDate(rental.start_date)} • ชำระทุกวันที่ ${rental.payment_day} ของเดือน • งวดวันที่ ${fmtDate(payment.due_date)}`
      : `${bikeLine}\nงวดวันที่ ${fmtDate(payment.due_date)}`,
    qtyLabel: null,
    rateLabel: null,
    amount: Number(payment.amount ?? 0),
    discountAmount: 0,
    depositAmount: isFirstPayment ? Number(rental.deposit_amount ?? 0) : 0,
    paymentMethod: payment.payment_method ?? null,
    paidAt: payment.paid_date,
  }

  // ถ้าเคยบันทึกชื่อ/ที่อยู่ที่แก้ไว้สำหรับสัญญานี้ (เช่น ขอออกใบเสร็จเป็นชื่อบริษัท) ใช้ค่านั้นแทนชื่อลูกค้าปกติ
  const customer = {
    name: rental.billing_name || rental.customers?.name,
    phone: rental.billing_id || rental.customers?.phone,
    workplace: rental.billing_address || rental.customers?.workplace,
  }

  return (
    <InvoiceView
      payment={invoicePayment}
      customer={customer}
      shop={resolvedShop}
      contractType="monthly"
      contractId={payment.monthly_rental_id}
    />
  )
}
