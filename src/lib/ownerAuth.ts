// บัญชีเจ้าของ = ผู้ใช้ Supabase ที่ app_metadata.role = 'owner' (ตั้งด้วย service role เท่านั้น ผู้ใช้แก้เองไม่ได้)
// เดิมเช็คแค่ "ล็อกอินแล้ว" — ระบบสมัครของ Supabase เปิดอยู่ ใครสมัครเองก็เข้าหน้าเจ้าของได้
import type { User } from '@supabase/supabase-js'

export function isOwnerUser(user: User | null | undefined): user is User {
  return user?.app_metadata?.role === 'owner'
}
