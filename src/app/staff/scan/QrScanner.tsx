'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function QrScanner() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const router = useRouter()

  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const [detected, setDetected] = useState('')

  useEffect(() => {
    let stream: MediaStream | null = null
    let animFrame: number

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setScanning(true)
          scanFrame()
        }
      } catch {
        setError('ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้กล้อง')
      }
    }

    const scanFrame = async () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < 2) {
        animFrame = requestAnimationFrame(scanFrame)
        return
      }

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0)

      try {
        if ('BarcodeDetector' in window) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
          const codes = await detector.detect(canvas)
          if (codes.length > 0) {
            const value: string = codes[0].rawValue
            setDetected(value)
            stream?.getTracks().forEach(t => t.stop())
            // ถ้าเป็น URL ของ /bike/... ให้ navigate ไปเลย
            if (value.includes('/bike/')) {
              const path = new URL(value).pathname
              router.push(path)
            } else {
              setError(`QR ที่สแกนได้: ${value}`)
            }
            return
          }
        }
      } catch { /* ไม่ support BarcodeDetector */ }

      animFrame = requestAnimationFrame(scanFrame)
    }

    startCamera()
    return () => {
      cancelAnimationFrame(animFrame)
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [router])

  return (
    <div style={{ padding: '16px' }}>
      {/* Viewfinder */}
      <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', background: '#000', aspectRatio: '1', marginBottom: '16px' }}>
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Corner guides */}
        {scanning && !detected && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ width: '60%', aspectRatio: '1', position: 'relative' }}>
              {[
                { top: 0, left: 0, borderTop: '3px solid #fff', borderLeft: '3px solid #fff', borderRadius: '4px 0 0 0' },
                { top: 0, right: 0, borderTop: '3px solid #fff', borderRight: '3px solid #fff', borderRadius: '0 4px 0 0' },
                { bottom: 0, left: 0, borderBottom: '3px solid #fff', borderLeft: '3px solid #fff', borderRadius: '0 0 0 4px' },
                { bottom: 0, right: 0, borderBottom: '3px solid #fff', borderRight: '3px solid #fff', borderRadius: '0 0 4px 0' },
              ].map((s, i) => (
                <div key={i} style={{ position: 'absolute', width: '20px', height: '20px', ...s }} />
              ))}
            </div>
          </div>
        )}

        {!scanning && !error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px' }}>
            กำลังเปิดกล้อง...
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '14px', color: '#dc2626', fontSize: '14px', marginBottom: '12px', textAlign: 'center' }}>
          ⚠️ {error}
        </div>
      )}

      {scanning && !detected && (
        <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '13px', marginBottom: '16px' }}>
          ส่องกล้องไปที่ QR Code บนรถ...
        </div>
      )}

      {/* Fallback: ถ้า browser ไม่รองรับ BarcodeDetector */}
      {scanning && (
        <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', textAlign: 'center' }}>
            หรือป้อน URL จาก QR Code โดยตรง
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              className="field-input"
              style={{ flex: 1 }}
              placeholder="https://kuma-app.vercel.app/bike/..."
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim()
                  if (val.includes('/bike/')) router.push(new URL(val).pathname)
                }
              }}
            />
            <button
              className="btn"
              style={{ background: '#1e40af', color: '#fff', padding: '0 16px', flexShrink: 0 }}
              onClick={e => {
                const input = (e.currentTarget.previousElementSibling as HTMLInputElement)
                const val = input?.value.trim()
                if (val?.includes('/bike/')) router.push(new URL(val).pathname)
              }}
            >ไป</button>
          </div>
        </div>
      )}
    </div>
  )
}
