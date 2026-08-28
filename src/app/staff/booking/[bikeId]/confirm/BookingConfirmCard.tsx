'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Shop = {
  shop_name: string
  address: string | null | undefined
  phone: string | null | undefined
  logo_url: string | null | undefined
}

type Bike = {
  license_plate: string
  color: string | null
  year: number | null
}

type Props = {
  bookingRef: string
  createdAt: string
  startDatetime: string
  endDatetime: string
  totalDays: number
  dailyRate: number | null
  displayBrand: string
  displayModel: string
  bike: Bike | null
  customerName: string
  customerPhone: string
  customerHotel: string | null
  deliveryType: string
  deliveryAddress: string | null
  notes: string | null
  shop: Shop
  contactPhone: string | null
  contactLine: string | null
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function BookingConfirmCard(props: Props) {
  const { bookingRef, createdAt, startDatetime, endDatetime, totalDays, dailyRate, displayBrand, displayModel,
    bike, customerName, customerPhone, customerHotel, deliveryType, deliveryAddress, notes,
    shop, contactPhone, contactLine } = props

  const estimatedTotal = dailyRate ? dailyRate * totalDays : null

  const cardRef = useRef<HTMLDivElement>(null)
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(true)

  useEffect(() => {
    let cancelled = false

    const capture = async () => {
      if (!cardRef.current) return
      try {
        const html2canvas = (await import('html2canvas')).default
        const canvas = await html2canvas(cardRef.current, {
          backgroundColor: '#ffffff',
          useCORS: true,
          scale: 2,
        })
        if (!cancelled) setImgSrc(canvas.toDataURL('image/png'))
      } catch {
        // เจนรูปไม่สำเร็จ (เช่น โลโก้โหลดไม่ทัน/ติด CORS) — เหลือใบต้นฉบับให้แคปหน้าจอแทน
      } finally {
        if (!cancelled) setCapturing(false)
      }
    }

    // รอเฟรมถัดไปให้ layout + โลโก้ (ถ้ามี) วาดเสร็จก่อนจับภาพ
    const timer = setTimeout(capture, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [])

  return (
    <div className="section-pad" style={{ paddingTop: '12px' }}>

      {imgSrc && (
        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '10px', textAlign: 'center' }}>
          กดค้างที่รูปด้านล่างเพื่อบันทึกส่งลูกค้า
        </div>
      )}
      {capturing && !imgSrc && (
        <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '10px', textAlign: 'center' }}>
          กำลังเตรียมรูป...
        </div>
      )}

      {imgSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgSrc} alt="ใบยืนยันการจอง" style={{ width: '100%', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'block' }} />
      ) : (
        <div ref={cardRef} className="card" style={{ padding: 0, overflow: 'hidden', fontSize: '13px' }}>

          {/* Header bar */}
          <div style={{
            background: '#111827', color: '#fff', padding: '20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          }}>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '1px' }}>BOOKING</div>
              <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '2px' }}>ใบยืนยันการจอง</div>
            </div>
            {shop.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.logo_url} alt={shop.shop_name} crossOrigin="anonymous" style={{
                width: '68px', height: '68px', objectFit: 'contain',
                background: '#fff', borderRadius: '8px', padding: '4px',
              }} />
            ) : (
              <div style={{
                width: '52px', height: '52px', border: '1px dashed rgba(255,255,255,.4)',
                borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', color: 'rgba(255,255,255,.6)',
              }}>
                LOGO
              </div>
            )}
          </div>

          <div style={{ padding: '20px' }}>

            {/* Branch + booking meta */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', fontSize: '12px', lineHeight: 1.9 }}>
              <div>
                <div style={{ fontWeight: 700, color: '#111827' }}>{shop.shop_name}</div>
                {shop.phone && <div style={{ color: '#6b7280' }}>{shop.phone}</div>}
                {shop.address && <div style={{ color: '#6b7280' }}>{shop.address}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div><span style={{ color: '#6b7280' }}>เลขที่การจอง: </span><strong>#{bookingRef}</strong></div>
                <div><span style={{ color: '#6b7280' }}>วันที่จอง: </span><strong>{fmtDate(createdAt)}</strong></div>
              </div>
            </div>

            <div style={{ borderTop: '2px solid #111827', marginBottom: '12px' }} />

            {/* Bike */}
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#111827', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.5px' }}>รถที่จอง</div>
            <div style={{ marginBottom: '16px', fontSize: '13px', lineHeight: 1.8 }}>
              <div style={{ fontWeight: 700 }}>{displayBrand} {displayModel}</div>
              {bike ? (
                <div style={{ color: '#6b7280', fontSize: '12px' }}>
                  ทะเบียน {bike.license_plate}
                  {bike.color ? ` • ${bike.color}` : ''}
                  {bike.year ? ` • ปี ${bike.year}` : ''}
                </div>
              ) : (
                <div style={{ color: '#6b7280', fontSize: '12px' }}>รุ่นตามที่มี — กำหนดคันจริงก่อนส่งรถ</div>
              )}
            </div>

            {/* Schedule table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', borderBottom: '1px solid #d1d5db' }}>
                  <th style={{ padding: '8px 6px', textAlign: 'left' }}>กำหนดการ</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right' }}>วันที่ / เวลา</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '8px 6px', color: '#6b7280' }}>รับรถ</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>{fmtDate(startDatetime)} · {fmtTime(startDatetime)} น.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '8px 6px', color: '#6b7280' }}>คืนรถ</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>{fmtDate(endDatetime)} · {fmtTime(endDatetime)} น.</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 6px', color: '#6b7280' }}>ระยะเวลา</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700 }}>{totalDays} วัน</td>
                </tr>
              </tbody>
            </table>

            {estimatedTotal != null && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                  <span>ราคาเช่าโดยประมาณ</span>
                  <span>฿{estimatedTotal.toLocaleString('th-TH')}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                  ฿{dailyRate!.toLocaleString('th-TH')} × {totalDays} วัน — ค่าเช่าเท่านั้น ไม่รวมค่าบริการส่วนอื่น ราคาสุดท้ายยืนยันอีกครั้งตอนรับรถ
                </div>
              </div>
            )}

            {/* Customer */}
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#111827', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.5px' }}>ข้อมูลผู้จอง</div>
            <div style={{ marginBottom: '16px', fontSize: '12px', lineHeight: 1.9 }}>
              <div><span style={{ color: '#6b7280' }}>ชื่อ: </span>{customerName}</div>
              <div><span style={{ color: '#6b7280' }}>เบอร์โทร: </span>{customerPhone}</div>
              {customerHotel && <div><span style={{ color: '#6b7280' }}>ที่พัก: </span>{customerHotel}</div>}
            </div>

            <div style={{ marginBottom: '16px', fontSize: '12px' }}>
              <span style={{ color: '#6b7280' }}>วิธีรับรถ: </span>
              {deliveryType === 'offsite'
                ? `ส่งนอกสถานที่ — ${deliveryAddress || 'ไม่ระบุที่อยู่'}`
                : 'รับหน้าร้าน'}
            </div>

            {notes && (
              <div style={{ marginBottom: '16px', fontSize: '12px' }}>
                <span style={{ color: '#6b7280' }}>หมายเหตุ: </span>{notes}
              </div>
            )}

            {/* Footer */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.7 }}>
                {contactPhone && <div>โทร: {contactPhone}</div>}
                {contactLine && <div>LINE: {contactLine}</div>}
              </div>
              <div style={{ fontSize: '12px', padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: '8px', color: '#111827' }}>
                ยืนยันแล้ว
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: '16px', display: 'flex', gap: '10px', marginBottom: '80px' }}>
        <Link href="/staff/home" style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#f1f5f9', color: '#475569', textAlign: 'center', textDecoration: 'none', fontWeight: 700, fontSize: '14px' }}>
          กลับหน้าหลัก
        </Link>
        <Link href="/staff/search" style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#111827', color: '#fff', textAlign: 'center', textDecoration: 'none', fontWeight: 700, fontSize: '14px' }}>
          ค้นหาเพิ่ม
        </Link>
      </div>

    </div>
  )
}
