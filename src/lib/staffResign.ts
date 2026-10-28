import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

// พนักงานลาออก: ไม่ลบแถว (ประวัติทุกอย่างที่ผูกกับเขายังอยู่และดึงชื่อได้) แต่ปิดบัญชี เปลี่ยนชื่อต่อท้ายว่า "(ลาออกแล้ว)"
// และเปลี่ยน PIN เป็นเลขสุ่มที่ไม่ซ้ำ เพื่อคืน PIN เดิมให้คนใหม่ใช้ได้
// หน้าที่ดึงชื่อจากบัญชีพนักงาน (สัญญา/ชำระเงิน/เข้างาน/ปิดร้าน/ซ่อม ฯลฯ) จะขึ้นชื่อพร้อมวงเล็บเองโดยไม่ต้องแก้หน้าไหน
export const RESIGNED_SUFFIX = ' (ลาออกแล้ว)'
export const isResignedName = (name: string | null | undefined) => !!name && name.endsWith(RESIGNED_SUFFIX)

export async function resignStaff(admin: Admin, id: string): Promise<{ ok: true; name: string; alreadyResigned: boolean } | { ok: false; error: string }> {
  const { data: row } = await admin.from('staff').select('id, name').eq('id', id).maybeSingle()
  if (!row) return { ok: false, error: 'ไม่พบพนักงาน' }
  if (isResignedName(row.name)) return { ok: true, name: row.name, alreadyResigned: true }

  const { data: pins } = await admin.from('staff').select('pin')
  const used = new Set((pins ?? []).map(p => String(p.pin)))
  const newName = `${String(row.name).trim()}${RESIGNED_SUFFIX}`

  for (let attempt = 0; attempt < 20; attempt++) {
    const pin = String(100000 + Math.floor(Math.random() * 900000))
    if (used.has(pin)) continue
    const { error } = await admin.from('staff').update({ name: newName, is_active: false, pin }).eq('id', id)
    if (!error) return { ok: true, name: newName, alreadyResigned: false }
    // PIN ชนกันพอดี (unique) → สุ่มใหม่ ข้อผิดพลาดอื่นให้หยุด
    if (!/unique|duplicate/i.test(error.message)) return { ok: false, error: error.message }
    used.add(pin)
  }
  return { ok: false, error: 'สุ่ม PIN ใหม่ไม่สำเร็จ ลองอีกครั้ง' }
}
