import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import InvoiceView from './InvoiceView'

export const dynamic = 'force-dynamic'

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function invoiceNumber(paymentId: string, paidAt: string) {
  const year = new Date(paidAt).getFullYear() + 543
  return `RCT-${year}-${paymentId.slice(0, 6).toUpperCase()}`
}

export default async function InvoicePage({ params }: { params: Promise<{ paymentId: string }> }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) redirect('/staff/login')

  const { paymentId } = await params
  const supabase = createAdminClient()

  const { data: payment } = await supabase
    .from('rental_payments')
    .select(`
      id, rental_id, kind, amount, paid_at,
      rentals(
        start_datetime, expected_end_datetime, total_days, daily_rate,
        deposit_amount, discount, payment_method, branch_id,
        bikes(license_plate, brand, model),
        customers(name, phone, workplace)
      )
    `)
    .eq('id', paymentId)
    .single()

  if (!payment) redirect('/staff/home')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rental = (payment as any).rentals
  if (!rental) redirect('/staff/home')

  const { data: shop } = await supabase
    .from('shop_settings')
    .select('shop_name, address, phone, tax_id')
    .limit(1)
    .maybeSingle()

  // สาขาตั้งชื่อร้าน/ที่อยู่/เบอร์ ในใบเสร็จเองได้ — ไม่ตั้งค่าใช้ของร้านกลางแทน
  const { data: branchReceipt } = await supabase
    .from('branch_settings')
    .select('receipt_shop_name, receipt_address, receipt_phone')
    .eq('branch_id', rental.branch_id)
    .maybeSingle()
  const resolvedShop = {
    ...shop,
    shop_name: branchReceipt?.receipt_shop_name || shop?.shop_name,
    address: branchReceipt?.receipt_address || shop?.address,
    phone: branchReceipt?.receipt_phone || shop?.phone,
  }

  const bike = rental.bikes
  const bikeLine = `${bike?.brand ?? ''} ${bike?.model ?? ''} • ${bike?.license_plate ?? ''}`
  const isCreation = payment.kind === 'rental'

  const invoicePayment = isCreation
    ? {
        id: payment.id,
        invoiceNo: invoiceNumber(payment.id, payment.paid_at),
        itemLabel: 'เช่ารถจักรยานยนต์',
        itemDetail: `${bikeLine}\n${fmtDateTime(rental.start_datetime)} – ${fmtDateTime(rental.expected_end_datetime)}`,
        qtyLabel: `${rental.total_days} วัน`,
        rateLabel: `฿${Number(rental.daily_rate).toLocaleString()}`,
        amount: Number(payment.amount ?? 0),
        discountAmount: Number(rental.discount ?? 0),
        depositAmount: Number(rental.deposit_amount ?? 0),
        paymentMethod: rental.payment_method ?? null,
        paidAt: payment.paid_at,
      }
    : {
        id: payment.id,
        invoiceNo: invoiceNumber(payment.id, payment.paid_at),
        itemLabel: 'ต่อเวลาเช่ารถจักรยานยนต์',
        itemDetail: `${bikeLine}\nต่อเวลาถึง ${fmtDateTime(rental.expected_end_datetime)}`,
        qtyLabel: null,
        rateLabel: null,
        amount: Number(payment.amount ?? 0),
        discountAmount: 0,
        depositAmount: 0,
        paymentMethod: null,
        paidAt: payment.paid_at,
      }

  return <InvoiceView payment={invoicePayment} customer={rental.customers ?? {}} shop={resolvedShop} />
}
