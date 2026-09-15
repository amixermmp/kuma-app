'use client'

import { useEffect, useRef, useState } from 'react'

type Hotspot = { brand: string; model: string; xPct: number; yPct: number; widthPct: number; heightPct: number }

export default function PosterOverlay({ templateUrl, hotspots, outOfStock }: {
  templateUrl: string
  hotspots: Hotspot[]
  outOfStock: string[] // "brand||model"
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(true)

  const outSet = new Set(outOfStock)
  const crossedHotspots = hotspots.filter(h => outSet.has(`${h.brand}||${h.model}`))
  const outOfStockKey = outOfStock.slice().sort().join(',')

  useEffect(() => {
    let cancelled = false
    setImgSrc(null)
    setCapturing(true)

    const capture = async () => {
      if (!containerRef.current) return
      try {
        const html2canvas = (await import('html2canvas')).default
        const canvas = await html2canvas(containerRef.current, { useCORS: true, scale: 2 })
        if (!cancelled) setImgSrc(canvas.toDataURL('image/png'))
      } catch {
        // จับภาพไม่สำเร็จ (เช่น รูปโหลดไม่ทัน/ติด CORS) — เหลือรูปสด (ยังมีกากบาททับอยู่) ให้ดูแทน
      } finally {
        if (!cancelled) setCapturing(false)
      }
    }

    // รอรูปต้นฉบับโหลดเสร็จก่อนจับภาพ
    const timer = setTimeout(capture, 400)
    return () => { cancelled = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateUrl, outOfStockKey])

  return (
    <div style={{ marginBottom: '14px' }}>
      {imgSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgSrc} alt="โปสเตอร์รถว่าง" style={{ width: '100%', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'block' }} />
      ) : (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={templateUrl} alt="โปสเตอร์" crossOrigin="anonymous" style={{ width: '100%', display: 'block', borderRadius: '12px' }} />
          {crossedHotspots.map((h, i) => (
            <div key={i} style={{
              position: 'absolute', left: `${h.xPct}%`, top: `${h.yPct}%`,
              width: `${h.widthPct}%`, height: `${h.heightPct}%`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg viewBox="0 0 100 100" style={{ width: '80%', height: '80%' }}>
                <line x1="10" y1="10" x2="90" y2="90" stroke="#dc2626" strokeWidth="14" strokeLinecap="round" />
                <line x1="90" y1="10" x2="10" y2="90" stroke="#dc2626" strokeWidth="14" strokeLinecap="round" />
              </svg>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', marginTop: '4px' }}>
        {capturing && !imgSrc ? 'กำลังเตรียมรูป...' : 'กดค้างที่รูปเพื่อเซฟส่งลูกค้า'}
      </div>
    </div>
  )
}
