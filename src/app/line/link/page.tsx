'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'

// หน้า LIFF — ลูกค้าสแกน QR จากร้านแล้วเปิดหน้านี้ใน LINE เพื่อผูกไลน์กับสัญญาเช่า
// LIFF Endpoint URL ใน LINE Developers Console ต้องชี้มาที่ /line/link

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { liff: any }
}

type Status = 'loading' | 'success' | 'error'

// อ่านรหัสสัญญาจาก URL — รองรับทั้ง ?rental= (รายวัน) และ ?monthly= (รายเดือน)
function getContractRef(): { key: 'rental' | 'monthly'; id: string } | null {
  const sources = [new URLSearchParams(window.location.search)]
  // LIFF ส่ง query เดิมมาใน liff.state
  const state = sources[0].get('liff.state')
  if (state) sources.push(new URLSearchParams(state.replace(/^\?/, '')))
  for (const params of sources) {
    for (const key of ['rental', 'monthly'] as const) {
      const id = params.get(key)
      if (id) return { key, id }
    }
  }
  return null
}

export default function LineLinkPage() {
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('กำลังเชื่อมต่อ...')
  const [sdkReady, setSdkReady] = useState(false)

  useEffect(() => {
    if (!sdkReady) return
    const run = async () => {
      try {
        const ref = getContractRef()
        if (!ref) throw new Error('ลิงก์ไม่ถูกต้อง (ไม่พบรหัสสัญญาเช่า) กรุณาสแกน QR จากหน้าร้านอีกครั้ง')

        const cfgRes = await fetch(`/api/line/link-config?${ref.key}=${ref.id}`)
        if (!cfgRes.ok) throw new Error('สาขานี้ยังไม่ได้ตั้งค่า LIFF ID')
        const { liffId } = await cfgRes.json()

        await window.liff.init({ liffId })

        if (!window.liff.isLoggedIn()) {
          window.liff.login({ redirectUri: window.location.href })
          return
        }

        setMessage('กำลังผูกบัญชี...')
        const profile = await window.liff.getProfile()
        const res = await fetch('/api/line/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rentalId: ref.key === 'rental' ? ref.id : undefined,
            monthlyId: ref.key === 'monthly' ? ref.id : undefined,
            lineUserId: profile.userId,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'เกิดข้อผิดพลาด')

        setStatus('success')
        setMessage(data.customerName ? `คุณ${data.customerName}` : '')
      } catch (e) {
        setStatus('error')
        setMessage(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่')
      }
    }
    run()
  }, [sdkReady])

  return (
    <div style={{
      minHeight: '100vh', background: '#f8fafc',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <Script src="https://static.line-scdn.net/liff/edge/2/sdk.js" onLoad={() => setSdkReady(true)} />

      <div style={{
        background: '#fff', borderRadius: '20px', padding: '36px 28px',
        maxWidth: '360px', width: '100%', textAlign: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,.08)',
      }}>
        {status === 'loading' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{message}</div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>รอสักครู่นะครับ</div>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>✅</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a' }}>ผูกไลน์เรียบร้อย!</div>
            {message && <div style={{ fontSize: '15px', color: '#374151', marginTop: '8px' }}>{message}</div>}
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '12px' }}>
              ระบบจะแจ้งเตือนก่อนครบกำหนดคืนรถทางไลน์นี้<br />ปิดหน้านี้ได้เลยครับ
            </div>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>❌</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#dc2626' }}>ผูกไลน์ไม่สำเร็จ</div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>{message}</div>
          </>
        )}
      </div>
    </div>
  )
}
