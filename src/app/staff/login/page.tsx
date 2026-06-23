'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const PAD_KEYS = ['1','2','3','4','5','6','7','8','9','del','0','ok']

export default function StaffLoginPage() {
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
      setTimeout(() => {
        setShake(false)
        setPin('')
      }, 600)
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
      if (next.length === 6) {
        setTimeout(() => doSubmit(next), 150)
      }
    }
  }, [loading, shake, pin, doSubmit])

  // Hardware keyboard support
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
        .sl-wrap {
          animation: fade-up 0.4s ease;
        }
        .sl-dot {
          width: 16px; height: 16px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.35);
          transition: background 0.12s, border-color 0.12s, transform 0.12s;
        }
        .sl-dot.filled {
          background: #fff;
          border-color: #fff;
          animation: dot-pop 0.2s ease;
        }
        .sl-dot.error {
          background: #f87171;
          border-color: #f87171;
        }
        .sl-dots-row {
          display: flex; gap: 14px;
          transition: transform 0.1s;
        }
        .sl-dots-row.shake {
          animation: shake 0.5s ease;
        }
        .sl-key {
          width: 76px; height: 76px;
          border-radius: 50%;
          border: 1.5px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.08);
          color: #fff;
          font-size: 26px;
          font-weight: 600;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.1s, transform 0.08s, border-color 0.1s;
          backdrop-filter: blur(6px);
          font-family: inherit;
          -webkit-tap-highlight-color: transparent;
        }
        .sl-key:active:not(:disabled) {
          background: rgba(255,255,255,0.22);
          transform: scale(0.9);
        }
        .sl-key:disabled { opacity: 0.3; cursor: default; }
        .sl-key.del-key {
          background: transparent;
          border-color: transparent;
          font-size: 22px;
        }
        .sl-key.ok-key {
          background: rgba(255,255,255,0.18);
          border-color: rgba(255,255,255,0.3);
          font-size: 20px;
        }
        .sl-key.ok-key:active { background: rgba(255,255,255,0.35); }
        .sl-spinner {
          width: 20px; height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          margin: 0 auto;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div
        className="app-wrap"
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(160deg, #0f172a 0%, #1e3a8a 55%, #2563eb 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
        }}
      >
        <div className="sl-wrap" style={{ width: '100%', maxWidth: '320px', textAlign: 'center' }}>

          {/* Logo */}
          <div style={{
            width: '80px', height: '80px', borderRadius: '24px',
            background: 'rgba(255,255,255,0.12)',
            border: '1.5px solid rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '38px', margin: '0 auto 20px',
          }}>
            👤
          </div>

          <div style={{ color: '#fff', marginBottom: '36px' }}>
            <div style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '0.5px' }}>Staff Portal</div>
            <div style={{ fontSize: '13px', opacity: 0.55, marginTop: '6px' }}>
              Kuma Bikes · กรอก PIN 6 หลัก
            </div>
          </div>

          {/* PIN dots */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px' }}>
            <div className={`sl-dots-row${shake ? ' shake' : ''}`}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`sl-dot${i < pin.length ? (shake ? ' error' : ' filled') : ''}`}
                />
              ))}
            </div>
          </div>

          {/* Error message */}
          <div style={{
            height: '20px',
            marginBottom: '24px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#f87171',
            transition: 'opacity 0.2s',
            opacity: errorMsg ? 1 : 0,
          }}>
            {errorMsg || ' '}
          </div>

          {/* Number pad */}
          {loading ? (
            <div style={{ padding: '40px 0' }}>
              <div className="sl-spinner" />
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 76px)',
              gap: '14px',
              justifyContent: 'center',
            }}>
              {PAD_KEYS.map((k, i) => {
                if (k === 'ok') {
                  return (
                    <button
                      key={i}
                      className="sl-key ok-key"
                      onClick={() => press('ok')}
                      disabled={pin.length < 6}
                    >
                      ✓
                    </button>
                  )
                }
                if (k === 'del') {
                  return (
                    <button
                      key={i}
                      className="sl-key del-key"
                      onClick={() => press('del')}
                      disabled={pin.length === 0}
                    >
                      ⌫
                    </button>
                  )
                }
                return (
                  <button key={i} className="sl-key" onClick={() => press(k)}>
                    {k}
                  </button>
                )
              })}
            </div>
          )}

          {/* Back */}
          <Link
            href="/"
            style={{
              display: 'block',
              marginTop: '44px',
              color: 'rgba(255,255,255,0.45)',
              fontSize: '13px',
              textDecoration: 'none',
              letterSpacing: '0.3px',
            }}
          >
            ← กลับหน้าหลัก
          </Link>
        </div>
      </div>
    </>
  )
}
