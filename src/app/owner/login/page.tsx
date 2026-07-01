'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function OwnerLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/owner/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error === 'Invalid login credentials' ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : data.error ?? 'เข้าสู่ระบบไม่สำเร็จ')
        return
      }
      window.location.href = '/owner/dashboard'
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ol-wrap { animation: fade-up 0.4s ease; }
        .ol-input {
          width: 100%;
          padding: 13px 16px;
          border-radius: 12px;
          border: 1.5px solid rgba(255,255,255,0.25);
          background: rgba(255,255,255,0.12);
          color: #fff;
          font-size: 15px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s, background 0.15s;
        }
        .ol-input::placeholder { color: rgba(255,255,255,0.4); }
        .ol-input:focus {
          border-color: rgba(255,255,255,0.6);
          background: rgba(255,255,255,0.18);
        }
        .ol-btn {
          width: 100%;
          padding: 15px;
          border-radius: 14px;
          border: none;
          background: #e11d48;
          color: #fff;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          font-family: inherit;
          transition: opacity 0.15s, transform 0.08s;
          letter-spacing: 0.3px;
        }
        .ol-btn:active { transform: scale(0.97); }
        .ol-btn:disabled { opacity: 0.5; cursor: default; }
        .ol-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255,255,255,0.7);
          margin-bottom: 8px;
          letter-spacing: 0.3px;
        }
      `}</style>

      <div
        className="app-wrap"
        style={{
          minHeight: '100vh',
          background: '#111827',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
        }}
      >
        <div className="ol-wrap" style={{ width: '100%', maxWidth: '320px' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', color: '#fff', marginBottom: '36px' }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '20px',
              background: '#e11d48',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '34px', margin: '0 auto 20px',
            }}>
              👑
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '1px', textTransform: 'uppercase' }}>Owner Portal</div>
            <div style={{ width: '24px', height: '2px', background: '#e11d48', borderRadius: '1px', margin: '10px auto' }} />
            <div style={{ fontSize: '13px', opacity: 0.4, marginTop: '4px' }}>
              เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '20px',
              padding: '24px',
              marginBottom: '16px',
            }}>
              <div style={{ marginBottom: '18px' }}>
                <label className="ol-label">อีเมล</label>
                <input
                  className="ol-input"
                  type="email"
                  placeholder="owner@kuma.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label className="ol-label">รหัสผ่าน</label>
                <input
                  className="ol-input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {/* Error */}
            <div style={{
              height: '20px',
              marginBottom: '12px',
              textAlign: 'center',
              fontSize: '13px',
              fontWeight: 600,
              color: '#f87171',
              opacity: error ? 1 : 0,
              transition: 'opacity 0.2s',
            }}>
              {error || ' '}
            </div>

            <button className="ol-btn" type="submit" disabled={loading || !email || !password}>
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ →'}
            </button>
          </form>

          {/* Back */}
          <Link
            href="/"
            style={{
              display: 'block',
              marginTop: '28px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.45)',
              fontSize: '13px',
              textDecoration: 'none',
            }}
          >
            ← กลับหน้าหลัก
          </Link>
        </div>
      </div>
    </>
  )
}
