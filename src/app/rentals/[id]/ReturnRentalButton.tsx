'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ReturnRentalButton({ rentalId, bikeId }: { rentalId: string; bikeId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleReturn() {
    if (!confirm('ยืนยันการรับรถคืน?')) return
    setLoading(true)
    await supabase.from('rentals').update({ status: 'completed', actual_end_datetime: new Date().toISOString() }).eq('id', rentalId)
    await supabase.from('bikes').update({ status: 'available' }).eq('id', bikeId)
    router.push('/rentals')
    router.refresh()
  }

  return (
    <button
      onClick={handleReturn}
      disabled={loading}
      style={{
        width: '100%', padding: '14px', borderRadius: '10px',
        border: 'none', background: loading ? '#86efac' : '#16a34a',
        color: '#fff', fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? '⏳ กำลังดำเนินการ...' : '✅ รับรถคืน'}
    </button>
  )
}
