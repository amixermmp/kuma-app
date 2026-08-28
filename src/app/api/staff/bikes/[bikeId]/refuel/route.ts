import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

// พนักงานกดยืนยันว่าไปเติมน้ำมันรถคันนี้เต็มแล้ว — เอาออกจาก list "รถต้องเติมน้ำมัน"
export async function POST(request: NextRequest, { params }: { params: Promise<{ bikeId: string }> }) {
  const cookieStore = await cookies()
  const staffId = cookieStore.get('kuma_staff_id')?.value
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bikeId } = await params
  const { error } = await createAdminClient().from('bikes').update({ fuel_level: 8 }).eq('id', bikeId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
