'use client'

import Link from 'next/link'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric',
  })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ContractView({ rental, shop }: { rental: any; shop: any }) {
  const bike = rental.bikes ?? {}
  const customer = rental.customers ?? {}

  // Parse fuel from notes: "น้ำมัน 6/8 แถบ • ไมล์ 1234"
  const fuelMatch = (rental.notes ?? '').match(/น้ำมัน\s*(\d+)\/8/)
  const fuelLevel = fuelMatch ? parseInt(fuelMatch[1]) : null
  const fuelPct = fuelLevel != null ? Math.round((fuelLevel / 8) * 100) : null

  const shopName = shop.shop_name ?? 'คุมะ'
  const shopPhone = shop.phone ?? ''
  const shopAddress = shop.address ?? ''

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .contract-wrap { padding: 0 !important; background: #fff !important; }
          .contract-card { box-shadow: none !important; border: none !important; max-width: 100% !important; border-radius: 0 !important; }
        }
        body { margin: 0; }
      `}</style>

      {/* Top bar */}
      <div className="no-print" style={{
        background: '#111827', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <Link href="/staff/jobs" style={{
          color: '#fff', textDecoration: 'none', fontSize: '20px',
          background: 'rgba(255,255,255,.15)', borderRadius: '8px',
          padding: '4px 10px', lineHeight: 1,
        }}>←</Link>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '16px', flex: 1 }}>📄 สัญญาเช่ารถ</span>
        <button
          onClick={async () => {
            const url = `${window.location.origin}/contract/${window.location.pathname.split('/').pop()}`
            if (navigator.share) {
              await navigator.share({ title: 'สัญญาเช่ารถ', url })
            } else {
              await navigator.clipboard.writeText(url)
              alert('คัดลอก link แล้ว!')
            }
          }}
          style={{
            background: 'rgba(255,255,255,.2)', color: '#fff', border: '1px solid rgba(255,255,255,.4)', borderRadius: '8px',
            padding: '8px 14px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', marginRight: '6px',
          }}
        >
          📤 ส่งให้ลูกค้า
        </button>
        <button
          onClick={() => window.print()}
          style={{
            background: '#fff', color: '#111827', border: 'none', borderRadius: '8px',
            padding: '8px 16px', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
          }}
        >
          🖨️ บันทึก PDF
        </button>
      </div>

      <div className="contract-wrap" style={{ background: '#f3f4f6', padding: '16px 12px 48px' }}>
        <div className="contract-card" style={{
          background: '#fff', borderRadius: '12px', maxWidth: '540px',
          margin: '0 auto', padding: '24px 24px',
          boxShadow: '0 1px 4px rgba(0,0,0,.1)', fontSize: '12px', lineHeight: 1.6, color: '#111',
        }}>

          {/* Header */}
          <div style={{ textAlign: 'center', borderBottom: '1.5px solid #111', paddingBottom: '10px', marginBottom: '12px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700 }}>สัญญาเช่ารถมอเตอร์ไซค์ / HIRING AGREEMENT MOTOR BIKE</div>
            <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>{shopName}</div>
          </div>

          {/* Intro */}
          <p style={{ marginBottom: '10px', fontSize: '11.5px', color: '#333' }}>
            สัญญาฉบับนี้ทำขึ้นระหว่าง <strong>{shopName}</strong>{shopAddress ? ` (${shopAddress})` : ''} ในฐานะ &quot;ผู้ให้เช่า&quot; กับผู้เช่าที่มีรายละเอียดดังต่อไปนี้:
          </p>

          {/* Details table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px', fontSize: '12px' }}>
            <tbody>
              <tr>
                <td style={tdLabel}>ชื่อผู้เช่า / Name:</td>
                <td style={tdValue}><strong>{customer.name ?? '—'}</strong></td>
                <td style={tdLabel}>บัตร/พาสปอร์ต:</td>
                <td style={tdValue}>{customer.phone ?? '—'}</td>
              </tr>
              <tr>
                <td style={tdLabel}>เบอร์โทร / Tel:</td>
                <td style={tdValue}>{customer.phone ?? '—'}</td>
                <td style={tdLabel}>ที่อยู่/โรงแรม:</td>
                <td style={tdValue}>{customer.workplace ?? '—'}</td>
              </tr>
              <tr>
                <td style={tdLabel}>รถทะเบียน:</td>
                <td style={tdValue}><strong>{bike.license_plate ?? '—'}</strong></td>
                <td style={tdLabel}>รุ่น / Model:</td>
                <td style={tdValue}>{bike.brand ?? ''} {bike.model ?? ''}</td>
              </tr>
              <tr>
                <td style={tdLabel}>สี / Color:</td>
                <td style={tdValue}>{bike.color ?? '—'}</td>
                <td style={tdLabel}></td>
                <td style={tdValue}></td>
              </tr>
              <tr>
                <td style={tdLabel}>วันที่เช่า / From:</td>
                <td style={tdValue}>{fmtDate(rental.start_datetime)} · {fmtTime(rental.start_datetime)} น.</td>
                <td style={tdLabel}>ถึงวันที่ / To:</td>
                <td style={tdValue}>{rental.expected_end_datetime ? `${fmtDate(rental.expected_end_datetime)} · ${fmtTime(rental.expected_end_datetime)} น.` : '—'}</td>
              </tr>
              <tr>
                <td style={tdLabel}>ราคาเช่า / Rate:</td>
                <td style={tdValue}>฿{Number(rental.daily_rate).toLocaleString()}/วัน</td>
                <td style={tdLabel}>รวมเงิน / Total:</td>
                <td style={tdValue}><strong>฿{Number(rental.total_amount).toLocaleString()}</strong></td>
              </tr>
              <tr>
                <td style={tdLabel}>เงินมัดจำ / Deposit:</td>
                <td colSpan={3} style={tdValue}>฿{Number(rental.deposit_amount ?? 0).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          {/* Terms header */}
          <div style={{ fontWeight: 700, fontSize: '12px', borderBottom: '0.5px solid #ccc', paddingBottom: '4px', marginBottom: '8px' }}>
            เงื่อนไขข้อตกลงการเช่า / RENTAL TERMS &amp; CONDITIONS
          </div>

          {/* Terms */}
          <div style={{ fontSize: '11px', color: '#333', lineHeight: 1.65, marginBottom: '14px' }}>
            <p style={{ margin: '0 0 5px' }}><strong>1. ขอบเขตพื้นที่และเวลาช่วยเหลือฉุกเฉิน:</strong> ห้ามนำรถไปใช้นอกรัศมี 15 กิโลเมตรจากร้านโดยเด็ดขาด การซัพพอร์ตช่วยเหลือนอกสถานที่ให้บริการเฉพาะช่วง 08.00–21.00 น. เท่านั้น คืนรถล่าช้าปรับ 50 บาท/ชั่วโมง ต้องนำรถกลับคืนภายใน 09.00–20.00 น. เท่านั้น</p>
            <p style={{ margin: '0 0 5px' }}><strong>2. สถานะประกันภัย (ไม่มีประกันภาคสมัครใจ):</strong> รถเช่าคันนี้ไม่มีประกันภาคสมัครใจ มีเพียงความคุ้มครองจาก พ.ร.บ. ภาคบังคับตามกฎหมายเท่านั้น ซึ่งคุ้มครองเฉพาะค่ารักษาพยาบาลเบื้องต้น ไม่คุ้มครองค่าซ่อมแซมตัวรถ</p>
            <p style={{ margin: '0 0 5px' }}><strong>3. ความรับผิดชอบต่ออุบัติเหตุและความเสียหาย:</strong> ผู้เช่าได้ตรวจสอบและยอมรับว่ารถมีสภาพสมบูรณ์ก่อนรับรถ หากเกิดอุบัติเหตุ ชำรุด บุบ รอยขีดข่วน หรือรถสูญหาย ผู้เช่าตกลงรับผิดชอบชดใช้ค่าเสียหายทั้งหมดแต่เพียงผู้เดียว</p>
            <p style={{ margin: '0 0 5px' }}><strong>4. นโยบายน้ำมันเชื้อเพลิง (แก๊สโซฮอล์ 95 เท่านั้น):</strong> ร้านส่งมอบรถพร้อมน้ำมันเต็มถัง ในวันคืนรถผู้เช่าต้องเติมน้ำมันกลับคืนให้เต็มถัง เติมได้เฉพาะแก๊สโซฮอล์ 95 เท่านั้น หากเติมผิดประเภทหรือไม่เติมกลับคืน ผู้เช่าต้องชดเชยค่าเสียหาย</p>
            <p style={{ margin: '0 0 5px' }}><strong>5. การต่ออายุสัญญาเช่า:</strong> หากสิ้นสุดกำหนดเวลาแต่ผู้เช่ามีการโอนเงินชำระค่าเช่าต่อเวลาและร้านได้รับแล้ว ให้ถือว่าสัญญาและเงื่อนไขฉบับนี้ยังมีผลบังคับใช้ต่อไปตลอดระยะเวลาที่ต่ออายุนั้น</p>
            <p style={{ margin: '0 0 5px' }}><strong>6. ข้อห้ามเช่าช่วงและอุปกรณ์สูญหาย:</strong> ไม่อนุญาตให้เช่าช่วง และห้ามใช้งานเชิงพาณิชย์ทุกประเภท ใช้เพื่อการท่องเที่ยวส่วนบุคคลเท่านั้น ค่าปรับ: กุญแจธรรมดา 500 บ. / รีโมท 2,000 บ. / หมวกกันน็อค 250 บ./ใบ</p>
            <p style={{ margin: '0 0 5px' }}><strong>7. เงื่อนไขราคาและการคืนรถก่อนกำหนด:</strong> ราคารายสัปดาห์/รายเดือนเป็นราคาเหมาจ่ายพิเศษ ชำระครั้งเดียว หากคืนรถก่อนกำหนดจะคำนวณตามราคารายวันปกติของรถรุ่นนั้นๆ ตามจริงและคืนส่วนที่เหลือ (ถ้ามี)</p>
            <p style={{ margin: '0' }}><strong>8. การบำรุงรักษาและนโยบายเรื่องยาง:</strong> ร้านดูแลปัญหาเครื่องยนต์ทั้งหมด ยางแบนจากสภาพเก่าหรือดอกหมด ร้านรับผิดชอบ (เปลี่ยนฟรี) ยางแบนจากของแหลมหรือขีบในพื้นที่ขรุขระ ผู้เช่ารับผิดชอบค่าปะ/เปลี่ยนยางเอง</p>
          </div>

          {/* Fuel gauge */}
          {fuelLevel != null && (
            <div style={{
              background: '#f9fafb', border: '0.5px solid #e0e0e0', borderRadius: '8px',
              padding: '10px 14px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <div style={{ fontSize: '11.5px', color: '#555', whiteSpace: 'nowrap' }}>
                ระดับน้ำมัน / Fuel &nbsp;<em style={{ fontSize: '10px', color: '#888' }}>(แก๊สโซฮอล์ 95)</em>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: '#888' }}>E</span>
                <div style={{ flex: 1, height: '10px', background: '#e5e7eb', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${fuelPct}%`, height: '100%', borderRadius: '5px',
                    background: (fuelPct ?? 0) > 50 ? '#16a34a' : (fuelPct ?? 0) > 25 ? '#d97706' : '#dc2626',
                  }} />
                </div>
                <span style={{ fontSize: '10px', color: '#888' }}>F</span>
              </div>
              <div style={{
                fontSize: '11px', fontWeight: 700, color: '#111',
                background: '#fff', border: '0.5px solid #ccc', borderRadius: '6px', padding: '2px 10px',
              }}>{fuelLevel}/8</div>
              <div style={{ fontSize: '11px', color: '#555' }}>☑ รับรถ &nbsp; ☐ คืนรถ</div>
            </div>
          )}

          {/* Acceptance statement */}
          <p style={{ fontSize: '11px', color: '#444', marginBottom: '14px', lineHeight: 1.7 }}>
            ข้าพเจ้าได้ตรวจสอบสภาพรถเช่าและระบบความปลอดภัยจนเป็นที่พอใจแล้ว และยอมรับเงื่อนไขข้อตกลงในสัญญานี้อย่างชัดเจนทุกประการ (รวมทั้งการจำกัดระยะ 15 กม. การรับผิดชอบต่ออุบัติเหตุ นโยบายคืนรถก่อนกำหนด และเรื่องยาง)<br />
            <em>I have inspected the vehicle, confirmed its safety mechanics, and agreed to all terms in this contract.</em>
          </p>

          {/* Signature section */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            {/* Customer signature */}
            <div style={{ border: '0.5px solid #ccc', borderRadius: '8px', padding: '10px' }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>ผู้เช่า / Renter</div>
              {rental.customer_signature ? (
                <div style={{
                  background: '#fafafa', border: '0.5px solid #e0e0e0', borderRadius: '6px',
                  height: '80px', overflow: 'hidden',
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={rental.customer_signature}
                    alt="ลายเซ็นลูกค้า"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
              ) : (
                <div style={{
                  background: '#fafafa', border: '0.5px dashed #ccc', borderRadius: '6px',
                  height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '11px', color: '#bbb' }}>ไม่มีลายเซ็น</span>
                </div>
              )}
              <div style={{ fontSize: '11px', color: '#555', marginTop: '6px', textAlign: 'center' }}>
                {customer.name ?? ''}
              </div>
            </div>

            {/* Shop signature */}
            <div style={{ border: '0.5px solid #ccc', borderRadius: '8px', padding: '10px' }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>ผู้ให้เช่า / Shop</div>
              <div style={{
                background: '#fafafa', border: '0.5px dashed #ccc', borderRadius: '6px',
                height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '11px', color: '#bbb' }}>ลายเซ็นพนักงาน</span>
              </div>
              <div style={{ fontSize: '11px', color: '#555', marginTop: '6px', textAlign: 'center' }}>
                {shopName}
              </div>
            </div>
          </div>

          {/* Warning box */}
          <div style={{
            background: '#fffbeb', border: '0.5px solid #fcd34d', borderRadius: '8px',
            padding: '8px 12px', marginBottom: '12px', fontSize: '11px', color: '#78350f',
          }}>
            <strong>ข้อพึงระวัง / REMARK:</strong> ห้ามขับขี่รถลงบนผืนหาดทรายโดยเด็ดขาด · ห้ามดื่มแอลกอฮอล์ขณะขับขี่ · ปฏิบัติตามกฎจราจรอย่างเคร่งครัด
          </div>

          {/* Footer */}
          <div style={{ fontSize: '11px', color: '#888', textAlign: 'center' }}>
            ★ เวลาทำการรับ-คืนรถ: 09.00 – 20.00 น. ★{shopPhone ? `  |  โทร ${shopPhone}` : ''}
          </div>

        </div>
      </div>
    </>
  )
}

const tdLabel: React.CSSProperties = {
  border: '0.5px solid #ccc', padding: '5px 8px',
  background: '#f7f7f7', color: '#555', width: '28%', fontSize: '11px',
}
const tdValue: React.CSSProperties = {
  border: '0.5px solid #ccc', padding: '5px 8px', fontSize: '11.5px',
}
