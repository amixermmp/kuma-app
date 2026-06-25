'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

interface Props {
  onSave: (dataUrl: string) => void
  onClose: () => void
}

export default function SignaturePad({ onSave, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match display size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // White background
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  const getPos = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: t.clientX - rect.left, y: t.clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  const startDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    setIsDrawing(true)
    setIsEmpty(false)
    lastPos.current = getPos(e, canvas)
  }, [])

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pos = getPos(e, canvas)
    if (lastPos.current) {
      ctx.beginPath()
      ctx.moveTo(lastPos.current.x, lastPos.current.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    }
    lastPos.current = pos
  }, [isDrawing])

  const endDraw = useCallback(() => {
    setIsDrawing(false)
    lastPos.current = null
  }, [])

  const clear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, rect.width, rect.height)
    setIsEmpty(true)
  }

  const save = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    onSave(canvas.toDataURL('image/png'))
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px 20px 0 0',
        width: '100%', maxWidth: '480px',
        padding: '20px 16px 32px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>ลายเซ็นลูกค้า</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>เซ็นชื่อในกล่องด้านล่าง</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
          style={{
            display: 'block',
            width: '100%',
            height: '200px',
            border: '2px dashed #d1d5db',
            borderRadius: '12px',
            touchAction: 'none',
            cursor: 'crosshair',
            background: '#fff',
          }}
        />

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button onClick={clear} style={{
            flex: 1, padding: '14px', border: '1.5px solid #e5e7eb',
            borderRadius: '10px', background: '#fff', fontSize: '14px',
            fontWeight: 600, cursor: 'pointer', color: '#374151',
          }}>
            🗑️ ล้าง
          </button>
          <button onClick={save} disabled={isEmpty} style={{
            flex: 2, padding: '14px', border: 'none',
            borderRadius: '10px', background: isEmpty ? '#d1d5db' : '#0ea5e9',
            color: '#fff', fontSize: '14px', fontWeight: 700,
            cursor: isEmpty ? 'not-allowed' : 'pointer',
          }}>
            ✅ ยืนยันลายเซ็น
          </button>
        </div>
      </div>
    </div>
  )
}
