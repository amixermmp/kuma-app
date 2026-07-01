'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const PAD_KEYS = ['1','2','3','4','5','6','7','8','9','del','0','ok']

export default function LandingClient({
  shopName,
  logoUrl,
}: {
  shopName: string
  logoUrl: string | null
}) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  const doSubmit = useCallback(async (digits: string) => {
    if (digits.length !== 6 || loading) return
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: digits }),
      })
      if (!res.ok) throw new Error()
      router.push('/staff/home')
    } catch {
      setShake(true)
      setErrorMsg('PIN ไม่ถูกต้อง ลองอีกครั้ง')
      setTimeout(() => { setShake(false); setPin('') }, 600)
    } finally {
      setLoading(false)
    }
  }, [loading, router])

  const press = useCallback((key: string) => {
    if (loading || shake) return
    if (key === 'del') {
      setPin(p => p.slice(0, -1))
      setErrorMsg('')
    } else if (key === 'ok') {
      doSubmit(pin)
    } else {
      if (pin.length >= 6) return
      const next = pin + key
      setPin(next)
      if (next.length === 6) setTimeout(() => doSubmit(next), 150)
    }
  }, [loading, shake, pin, doSubmit])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') press(e.key)
      else if (e.key === 'Backspace') press('del')
      else if (e.key === 'Enter') press('ok')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press])

  return (
    <>
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%,60%  { transform: translateX(-10px); }
          40%,80%  { transform: translateX(10px); }
        }
        @keyframes dot-pop {
          0%   { transform: scale(0.5); }
          60%  { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .lc-wrap { animation: fade-up 0.4s ease; }
        .lc-dot {
          width: 16px; height: 16px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.3);
          transition: background .12s, border-color .12s, transform .12s;
        }
        .lc-dot.filled {
          background: #e11d48; border-color: #e11d48;
          animation: dot-pop 0.2s ease;
        }
        .lc-dot.error { background: #f87171; border-color: #f87171; }
        .lc-dots-row {
          display: flex; gap: 14px;
        }
        .lc-dots-row.shake { animation: shake 0.5s ease; }
        .lc-key {
          width: 76px; height: 76px; border-radius: 50%;
          border: 1.5px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.08);
          color: #fff; font-size: 26px; font-weight: 600;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: background .1s, transform .08s;
          font-family: inherit; -webkit-tap-highlight-color: transparent;
        }
        .lc-key:active:not(:disabled) {
          background: rgba(255,255,255,0.22); transform: scale(0.9);
        }
        .lc-key:disabled { opacity: 0.3; cursor: default; }
        .lc-key.del-key { background: transparent; border-color: transparent; font-size: 22px; }
        .lc-key.ok-key { background: #e11d48; border-color: #e11d48; font-size: 20px; }
        .lc-key.ok-key:active { background: #be123c; }
        .lc-spinner {
          width: 20px; height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%;
          animation: spin 0.7s linear infinite; margin: 0 auto;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div
        className="app-wrap"
        style={{
          minHeight: '100vh', background: '#111827',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '32px 24px',
        }}
      >
        <div className="lc-wrap" style={{ width: '100%', maxWidth: '320px', textAlign: 'center' }}>

          {/* Logo */}
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={shopName}
              style={{
                width: '88px', height: '88px', objectFit: 'contain',
                borderRadius: '22px', marginBottom: '18px',
                border: '2px solid rgba(255,255,255,.1)',
              }}
            />
          ) : (
            <div style={{
              width: '88px', height: '88px', background: '#e11d48',
              borderRadius: '22px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '42px', margin: '0 auto 18px',
            }}>🛵</div>
          )}

          {/* Shop name */}
          <div style={{ color: '#fff', marginBottom: '36px' }}>
            <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '1px', textTransform: 'uppercase' }}>
              {shopName}
            </div>
            <div style={{ width: '24px', height: '2px', background: '#e11d48', borderRadius: '1px', margin: '10px auto' }} />
            <div style={{ fontSize: '13px', opacity: 0.4 }}>กรอก PIN 6 หลักเพื่อเข้าสู่ระบบ</div>
          </div>

          {/* PIN dots */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '36px' }}>
            <div className={`lc-dots-row${shake ? ' shake' : ''}`}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`lc-dot${i < pin.length ? (shake ? ' error' : ' filled') : ''}`} />
              ))}
            </div>
          </div>

          {/* Error */}
          <div style={{
            height: '18px', marginBottom: '20px', fontSize: '13px', fontWeight: 600,
            color: '#f87171', opacity: errorMsg ? 1 : 0, transition: 'opacity .2s',
          }}>
            {errorMsg || ' '}
          </div>

          {/* Number pad */}
          {loading ? (
            <div style={{ padding: '40px 0' }}><div className="lc-spinner" /></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 76px)', gap: '14px', justifyContent: 'center' }}>
              {PAD_KEYS.map((k, i) => {
                if (k === 'ok') return (
                  <button key={i} className="lc-key ok-key" onClick={() => press('ok')} disabled={pin.length < 6}>✓</button>
                )
                if (k === 'del') return (
                  <button key={i} className="lc-key del-key" onClick={() => press('del')} disabled={pin.length === 0}>⌫</button>
                )
                return <button key={i} className="lc-key" onClick={() => press(k)}>{k}</button>
              })}
            </div>
          )}

          {/* Owner link */}
          <Link
            href="/owner/login"
            style={{
              display: 'block', marginTop: '48px',
              color: 'rgba(255,255,255,0.35)', fontSize: '13px',
              textDecoration: 'none', letterSpacing: '0.3px',
            }}
          >
            เข้าสู่ระบบ Owner →
          </Link>
        </div>
      </div>
    </>
  )
}
