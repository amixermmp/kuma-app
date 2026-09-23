'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { calcExcessHours, calcOvertimeCharge } from '@/lib/pricing'

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
  totalAmount: number | null
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
  theme?: 'kuma' | 'zame'
}

const ZAME_LOGO_WHITE = 'https://wvpeivfzeijzurfohtjr.supabase.co/storage/v1/object/sign/rental-photo/brand-assets/zame/zame-logo-vertical-white.png?token=eyJraWQiOiJhZDlmOTQ5OS1jMGMzLTQ4NDYtYWFlZC02ZTJhNWM2NjU5N2IiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJyZW50YWwtcGhvdG8vYnJhbmQtYXNzZXRzL3phbWUvemFtZS1sb2dvLXZlcnRpY2FsLXdoaXRlLnBuZyIsInNjb3BlIjoiZG93bmxvYWQiLCJpYXQiOjE3OTAxNzY0NjUsImV4cCI6MTk0Nzg1NjQ2NX0.9i9Ljixdqv9HudEYPzdAe8GVpC27McCjB393Bqt1D10'
const ZAME = { blue: '#1976D2', yellow: '#FFCB3E', red: '#D22524', black: '#000000' }
const KUMA_LOGO_WHITE = 'https://wvpeivfzeijzurfohtjr.supabase.co/storage/v1/object/sign/rental-photo/brand-assets/kuma/kuma-logo-vertical-white.png?token=eyJraWQiOiJhZDlmOTQ5OS1jMGMzLTQ4NDYtYWFlZC02ZTJhNWM2NjU5N2IiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJyZW50YWwtcGhvdG8vYnJhbmQtYXNzZXRzL2t1bWEva3VtYS1sb2dvLXZlcnRpY2FsLXdoaXRlLnBuZyIsInNjb3BlIjoiZG93bmxvYWQiLCJpYXQiOjE3OTAxNzg4NDEsImV4cCI6MTk0Nzg1ODg0MX0.DC-CbWvUapEbG04dyKOQZqlerhut5u7YZwOmpIVD9UY'
const KUMA = { red: '#FF0000', black: '#2F302B', white: '#FFFFFF' }

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
  const { bookingRef, createdAt, startDatetime, endDatetime, totalDays, dailyRate, totalAmount, displayBrand, displayModel,
    bike, customerName, customerPhone, customerHotel, deliveryType, deliveryAddress, notes,
    shop, contactPhone, contactLine, theme = 'kuma' } = props
  const isZame = theme === 'zame'
  // ZAME เจอลูกค้าต่างชาติเยอะ — ป้ายทุกจุดเลยขึ้นสองภาษา ไทย/อังกฤษ (KUMA ยังคงเป็นไทยล้วนเหมือนเดิม)
  const bi = (th: string, en: string) => isZame ? `${th} / ${en}` : th

  // >= 30 วัน = แพ็คเกจรายเดือน (คิดเป็นเดือนปฏิทิน ไม่ใช่ราคา/วัน x จำนวนวัน) — เทียบกับราคา/วันตรงๆ จะดูเหมือนลดเว่อร์เกินจริง
  const isMonthlyPackage = totalDays >= 30

  // ใช้ยอดจริงที่คำนวณไว้ตอนจอง (รวมโปรรายสัปดาห์/เดือนแล้ว) — คูณ dailyRate*totalDays ตรงๆ จะได้ราคาเต็มไม่ลด
  const estimatedTotal = totalAmount ?? (dailyRate ? dailyRate * totalDays : null)
  const fullPrice = dailyRate ? dailyRate * totalDays : null
  const discountAmount = !isMonthlyPackage && fullPrice != null && estimatedTotal != null ? Math.max(0, fullPrice - estimatedTotal) : 0

  // เกินวันเต็มไปกี่ชม. (เช่น 1 วัน 3 ชม.) — โชว์แยกให้ชัด กันลูกค้าเข้าใจผิดว่าชั่วโมงเกินฟรี
  const excessHours = calcExcessHours(new Date(startDatetime), new Date(endDatetime), totalDays)
  const overtimeCharge = dailyRate ? calcOvertimeCharge(excessHours, dailyRate) : 0
  const durationLabel = excessHours > 0 ? `${totalDays} วัน ${excessHours} ชม.` : `${totalDays} วัน`

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
          {isZame ? (
            <div style={{
              background: ZAME.blue, color: '#fff', padding: '20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: `6px solid ${ZAME.yellow}`, position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: 0, right: 0, width: '90px', height: '90px',
                background: ZAME.red, borderRadius: '0 0 0 100%', opacity: 0.5,
              }} />
              <div style={{ position: 'relative' }}>
                <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '1px', fontStyle: 'italic' }}>BOOKING!</div>
                <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '2px', fontWeight: 700 }}>{bi('ใบยืนยันการจอง', 'Booking Confirmation')}</div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ZAME_LOGO_WHITE} alt="ZAME" crossOrigin="anonymous" style={{ width: '64px', height: '64px', objectFit: 'contain', position: 'relative' }} />
            </div>
          ) : (
            <div style={{
              background: KUMA.red, color: '#fff', padding: '20px',
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
                // eslint-disable-next-line @next/next/no-img-element
                <img src={KUMA_LOGO_WHITE} alt={shop.shop_name} crossOrigin="anonymous" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
              )}
            </div>
          )}

          <div style={{ padding: '20px' }}>

            {/* Branch + booking meta */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', fontSize: '12px', lineHeight: 1.9 }}>
              <div>
                <div style={{ fontWeight: 700, color: isZame ? ZAME.blue : KUMA.red }}>{shop.shop_name}</div>
                {shop.phone && <div style={{ color: '#6b7280' }}>{shop.phone}</div>}
                {shop.address && <div style={{ color: '#6b7280' }}>{shop.address}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div><span style={{ color: '#6b7280' }}>{bi('เลขที่การจอง', 'Booking No.')}: </span><strong>#{bookingRef}</strong></div>
                <div><span style={{ color: '#6b7280' }}>{bi('วันที่จอง', 'Date')}: </span><strong>{fmtDate(createdAt)}</strong></div>
              </div>
            </div>

            <div style={{ borderTop: `2px solid ${isZame ? ZAME.yellow : KUMA.red}`, marginBottom: '12px' }} />

            {/* Bike */}
            <div style={{ fontSize: '12px', fontWeight: 700, color: isZame ? ZAME.blue : KUMA.red, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.5px' }}>{bi('รถที่จอง', 'Vehicle')}</div>
            <div style={{ marginBottom: '16px', fontSize: '13px', lineHeight: 1.8 }}>
              <div style={{ fontWeight: 700 }}>{displayBrand} {displayModel}</div>
              {bike ? (
                <div style={{ color: '#6b7280', fontSize: '12px' }}>
                  {bi('ทะเบียน', 'Plate')} {bike.license_plate}
                  {bike.color ? ` • ${bike.color}` : ''}
                  {bike.year ? ` • ${bi('ปี', 'Year')} ${bike.year}` : ''}
                </div>
              ) : (
                <div style={{ color: '#6b7280', fontSize: '12px' }}>{bi('รุ่นตามที่มี — กำหนดคันจริงก่อนส่งรถ', 'Model as available — exact unit confirmed before delivery')}</div>
              )}
            </div>

            {/* Schedule table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
              <thead>
                <tr style={{ background: isZame ? `${ZAME.yellow}33` : '#f3f4f6', borderBottom: `1px solid ${isZame ? ZAME.yellow : '#d1d5db'}` }}>
                  <th style={{ padding: '8px 6px', textAlign: 'left' }}>{bi('กำหนดการ', 'Schedule')}</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right' }}>{bi('วันที่ / เวลา', 'Date / Time')}</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '8px 6px', color: '#6b7280' }}>{bi('รับรถ', 'Pick-up')}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>{fmtDate(startDatetime)} · {fmtTime(startDatetime)} น.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '8px 6px', color: '#6b7280' }}>{bi('คืนรถ', 'Return')}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>{fmtDate(endDatetime)} · {fmtTime(endDatetime)} น.</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 6px', color: '#6b7280' }}>{bi('ระยะเวลา', 'Duration')}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700 }}>{durationLabel}</td>
                </tr>
              </tbody>
            </table>

            {estimatedTotal != null && (
              <div style={{
                marginBottom: '16px',
                ...(isZame ? { background: `${ZAME.red}10`, border: `1.5px solid ${ZAME.red}`, borderRadius: '10px', padding: '10px 12px' } : {}),
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, color: isZame ? ZAME.red : KUMA.red }}>
                  <span>{bi('ราคาเช่า', 'Rental Price')}</span>
                  <span>฿{estimatedTotal.toLocaleString('th-TH')}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                  {isMonthlyPackage ? (
                    <>
                      ราคาแพ็คเกจรายเดือน — ค่าเช่าเท่านั้น ไม่รวมค่าบริการส่วนอื่น
                      {overtimeCharge > 0 && ` (รวมค่าล่วงเวลาเกินกำหนด ${excessHours} ชม. ฿${overtimeCharge.toLocaleString('th-TH')})`}
                      {isZame && (
                        <>
                          <br />Monthly package price — rental fee only, other service fees not included
                          {overtimeCharge > 0 && ` (incl. overtime ${excessHours} hr(s), ฿${overtimeCharge.toLocaleString('th-TH')})`}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      ฿{dailyRate!.toLocaleString('th-TH')} × {totalDays} วัน
                      {overtimeCharge > 0 && ` + ค่าล่วงเวลา ${excessHours} ชม. ฿${overtimeCharge.toLocaleString('th-TH')}`}
                      {' '}— ค่าเช่าเท่านั้น ไม่รวมค่าบริการส่วนอื่น
                      {discountAmount > 0 && ` (ลดโปรโมชั่นแล้ว ฿${discountAmount.toLocaleString('th-TH')})`}
                      {isZame && (
                        <>
                          <br />฿{dailyRate!.toLocaleString('th-TH')} × {totalDays} day(s)
                          {overtimeCharge > 0 && ` + overtime ${excessHours} hr(s) ฿${overtimeCharge.toLocaleString('th-TH')}`}
                          {' '}— rental fee only, other service fees not included
                          {discountAmount > 0 && ` (promotion applied ฿${discountAmount.toLocaleString('th-TH')})`}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Customer */}
            <div style={{ fontSize: '12px', fontWeight: 700, color: isZame ? ZAME.blue : KUMA.red, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.5px' }}>{bi('ข้อมูลผู้จอง', 'Customer Info')}</div>
            <div style={{ marginBottom: '16px', fontSize: '12px', lineHeight: 1.9 }}>
              <div><span style={{ color: '#6b7280' }}>{bi('ชื่อ', 'Name')}: </span>{customerName}</div>
              <div><span style={{ color: '#6b7280' }}>{bi('เบอร์โทร', 'Phone')}: </span>{customerPhone}</div>
              {customerHotel && <div><span style={{ color: '#6b7280' }}>{bi('ที่พัก', 'Accommodation')}: </span>{customerHotel}</div>}
            </div>

            <div style={{ marginBottom: '16px', fontSize: '12px' }}>
              <span style={{ color: '#6b7280' }}>{bi('วิธีรับรถ', 'Delivery')}: </span>
              {deliveryType === 'offsite'
                ? `${bi('ส่งนอกสถานที่', 'Off-site delivery')} — ${deliveryAddress || bi('ไม่ระบุที่อยู่', 'No address specified')}`
                : bi('รับหน้าร้าน', 'Pick up at shop')}
            </div>

            {notes && (
              <div style={{ marginBottom: '16px', fontSize: '12px' }}>
                <span style={{ color: '#6b7280' }}>{bi('หมายเหตุ', 'Notes')}: </span>{notes}
              </div>
            )}

            {/* Footer */}
            <div style={{ borderTop: `1px solid ${isZame ? ZAME.yellow : KUMA.red}`, paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.7 }}>
                {contactPhone && <div>{bi('โทร', 'Tel')}: {contactPhone}</div>}
                {contactLine && <div>LINE: {contactLine}</div>}
              </div>
              <div style={isZame
                ? { fontSize: '12px', padding: '4px 12px', background: ZAME.yellow, borderRadius: '20px', color: ZAME.black, fontWeight: 800 }
                : { fontSize: '12px', padding: '4px 10px', border: `1px solid ${KUMA.red}`, borderRadius: '8px', color: KUMA.red, fontWeight: 700 }}>
                {bi('ยืนยันแล้ว', 'Confirmed')}
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
