import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import ExpenseForm from './ExpenseForm'

export const dynamic = 'force-dynamic'

const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

const CATEGORY_ICON: Record<string, string> = {
  'เงินเดือนพนักงาน': '💼',
  'ค่าเช่าร้าน': '🏠',
  'ค่าน้ำ / ไฟ / เน็ต': '💡',
  'ค่าซ่อมบำรุง': '🔧',
  'ค่าต่อเอกสาร/ภาษี': '📄',
  'ค่าน้ำมัน': '🛢️',
  'อื่นๆ': '📦',
}

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/owner/login')

  const admin = createAdminClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const [branchesRes, expensesRes] = await Promise.all([
    admin.from('branches').select('id, name').order('name'),
    admin.from('expenses')
      .select('id, branch_id, category, description, amount, expense_date, branches(name)')
      .gte('expense_date', monthStart.split('T')[0])
      .lte('expense_date', monthEnd.split('T')[0])
      .order('expense_date', { ascending: false }),
  ])

  const branches  = branchesRes.data ?? []
  const expenses  = expensesRes.data ?? []
  const totalAmt  = expenses.reduce((s, e) => s + (e.amount ?? 0), 0)
  const monthLabel = `${MONTHS_TH[now.getMonth()]} ${now.getFullYear() + 543}`

  return (
    <div className="app-wrap">
      <div className="app-header" style={{ background: '#111827' }}>
        <Link href="/owner/dashboard" className="app-header-back">←</Link>
        <div>
          <h1>บันทึกค่าใช้จ่าย</h1>
          <div className="sub">รายจ่ายประจำเดือน — {monthLabel}</div>
        </div>
      </div>

      <div className="section-pad" style={{ paddingTop: '12px' }}>

        <ExpenseForm branches={branches} />

        {/* History */}
        <div style={{ marginTop: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '12px' }}>
            ประวัติ — {monthLabel}
          </div>

          {/* Total */}
          <div style={{
            background: '#fef2f2', borderRadius: '10px', padding: '12px 14px',
            marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: '13px', color: '#dc2626' }}>รวมค่าใช้จ่ายเดือนนี้</span>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#dc2626' }}>
              ฿{totalAmt.toLocaleString('th-TH')}
            </span>
          </div>

          {expenses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: '13px' }}>
              ยังไม่มีรายการค่าใช้จ่ายเดือนนี้
            </div>
          ) : expenses.map((exp, i) => {
            const branch = Array.isArray(exp.branches) ? exp.branches[0] : exp.branches as { name: string } | null
            const icon = CATEGORY_ICON[exp.category] ?? '📦'
            const d = new Date(exp.expense_date)
            const dateStr = `${d.getDate()} ${MONTHS_TH[d.getMonth()]}`
            return (
              <div key={exp.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 0', borderBottom: i < expenses.length - 1 ? '1px solid #f3f4f6' : 'none',
              }}>
                <div style={{ fontSize: '22px', width: '36px', textAlign: 'center' }}>{icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{exp.category}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>
                    {branch?.name ?? 'ส่วนกลาง'}{exp.description ? ` • ${exp.description}` : ''} • {dateStr}
                  </div>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#dc2626' }}>
                  −฿{(exp.amount ?? 0).toLocaleString('th-TH')}
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
