// ข้อความสรุปการเช่าให้พนักงานก๊อปส่งลูกค้า (เสียงผู้หญิง) — ใช้ตัวเดียวกันทั้งหน้าทำสัญญา หน้าสำเร็จ และหน้าสัญญา
// วัน-เวลาทั้งหมดเป็นเวลาไทย ('YYYY-MM-DDTHH:mm' หรือ 'YYYY-MM-DD') ไม่ใส่ราคา (ลูกค้ารู้ตอนมาเช่าแล้ว)
// ZAME (theme 'zame') ขึ้นสองภาษา ไทย / English เหมือนใบจอง

export type ContractSummaryInput = {
  theme: 'kuma' | 'zame'
  type: 'daily' | 'monthly'
  brand: string
  model: string
  plate: string
  startLocal: string            // เวลารับรถ รายเดือนอาจไม่มีเวลา (ส่งมาแค่วันที่)
  endLocal?: string | null      // เวลาคืน (รายวันเท่านั้น)
  paymentDay?: number | null    // วันครบกำหนดชำระ (รายเดือนเท่านั้น)
  fuelFull: boolean             // ตอนส่งรถ น้ำมันเต็มถังไหม (false = ไม่เต็ม ทางร้านแถมให้)
  returnType?: 'shop' | 'offsite' | null
  returnAddress?: string | null
  returnFee?: number | null
  emergencyPhone?: string | null
  todayLocal: string            // วันนี้ตามเวลาไทย 'YYYY-MM-DD' — ใช้เลือกคำว่า "วันนี้" กับ "วันที่"
}

const TZ = 'Asia/Bangkok'

const parts = (local: string) => ({
  date: local.slice(0, 10),
  time: local.length >= 16 ? local.slice(11, 16) : null,
})
const thDate = (date: string) => new Date(`${date}T00:00:00+07:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', timeZone: TZ })
const enDate = (date: string) => new Date(`${date}T00:00:00+07:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ })

export function bangkokTodayLocal(): string {
  return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10)
}

export function buildContractSummary(i: ContractSummaryInput): string {
  const zame = i.theme === 'zame'
  // อีโมจิหน้าบรรทัดมีที่ฝั่งไทยแล้ว ไม่ซ้ำฝั่งอังกฤษ
  const bi = (th: string, en: string) => zame ? `${th} / ${en.replace(/^[^\x00-\x7F]+\s*/, '')}` : th

  const start = parts(i.startLocal)
  const isToday = start.date === i.todayLocal

  const lines: (string | null)[] = []

  lines.push(`${bi(
    isToday ? 'ขอบคุณที่ใช้บริการค่ะ ขออนุญาตส่งสรุปการเช่าวันนี้นะคะ' : 'ขอบคุณที่ใช้บริการค่ะ ขออนุญาตส่งสรุปการเช่านะคะ',
    isToday ? "Thank you for choosing us. Here is today's rental summary" : 'Thank you for choosing us. Here is your rental summary',
  )} 🛵`)
  lines.push(bi(`รุ่น ${i.brand} ${i.model} ทะเบียน ${i.plate}`, `Model: ${i.brand} ${i.model}, Plate: ${i.plate}`))
  lines.push(bi(
    `${isToday ? 'รับรถวันนี้' : 'รับรถวันที่'} ${thDate(start.date)}${start.time ? ` เวลา ${start.time} น.` : ''}`,
    `Pick-up: ${enDate(start.date)}${start.time ? `, ${start.time}` : ''}`,
  ))

  if (i.type === 'daily' && i.endLocal) {
    const end = parts(i.endLocal)
    lines.push(bi(
      `คืนรถวันที่ ${thDate(end.date)}${end.time ? ` เวลา ${end.time} น.` : ''}`,
      `Return: ${enDate(end.date)}${end.time ? `, ${end.time}` : ''}`,
    ))
    const addr = (i.returnAddress ?? '').trim()
    if (i.returnType === 'offsite' && addr) {
      const paid = (i.returnFee ?? 0) > 0
      lines.push(bi(
        `📍 คืนรถนอกสถานที่ ทางร้านไปรับที่ ${addr} ในวันที่ ${thDate(end.date)}${end.time ? ` เวลา ${end.time} น.` : ''}${paid ? ' ชำระค่าบริการแล้วนะคะ' : ' นะคะ'}`,
        `📍 Off-site return: we will pick up the bike at ${addr} on ${enDate(end.date)}${end.time ? `, ${end.time}` : ''}.${paid ? ' Service fee paid.' : ''}`,
      ))
    }
    lines.push(bi('⏱ หากต้องการต่อเวลา มีค่าบริการชั่วโมงละ 50 บาทค่ะ', '⏱ Extension fee: 50 THB per hour'))
    lines.push(bi('📩 การต่อเวลาต้องสอบถามแอดมินก่อน เพื่อตรวจสอบว่าสามารถต่อได้ไหมนะคะ', '📩 Please ask our admin first to check if an extension is possible'))
  }

  if (i.type === 'monthly' && i.paymentDay) {
    lines.push(bi(`📅 ครบกำหนดชำระค่าเช่าทุกวันที่ ${i.paymentDay} ของเดือนนะคะ`, `📅 Rent is due on day ${i.paymentDay} of every month`))
  }

  lines.push(i.fuelFull
    ? bi('⛽ น้ำมันเติมแก๊สโซฮอล์ 95 ตอนรับรถน้ำมันเต็มถัง ตอนคืนลูกค้าเติมคืนทางร้านเต็มถังนะคะ', '⛽ Fuel: Gasohol 95. The tank is full at pick-up. Please refill it to full before returning it to us')
    : bi('⛽ น้ำมันเติมแก๊สโซฮอล์ 95 ตอนรับรถน้ำมันไม่เต็มถัง (ทางร้านแถมให้) ตอนคืนไม่ต้องเติมนะคะ', '⛽ Fuel: Gasohol 95. The tank is not full at pick-up (complimentary). No need to refill when returning'))

  const phone = (i.emergencyPhone ?? '').trim()
  if (phone) lines.push(bi(`🚨 เกิดเหตุฉุกเฉิน โทร ${phone}`, `🚨 Emergency: ${phone}`))

  return lines.filter((l): l is string => !!l).join('\n')
}

// ข้อความช่องทางติดต่อร้าน (พนักงานก๊อปส่งลูกค้าที่ทักมา) — ช่องไหนสาขาไม่ได้ตั้งไว้จะไม่ขึ้นบรรทัดนั้น
export function buildContactMessage(i: { theme: 'kuma' | 'zame'; lineId?: string | null; whatsapp?: string | null; phone?: string | null }): string | null {
  const zame = i.theme === 'zame'
  const rows = [
    i.lineId?.trim() ? `LINE: ${i.lineId.trim()}` : null,
    i.whatsapp?.trim() ? `WhatsApp: ${i.whatsapp.trim()}` : null,
    i.phone?.trim() ? `${zame ? 'โทร / Tel' : 'โทร'}: ${i.phone.trim()}` : null,
  ].filter((r): r is string => !!r)
  if (rows.length === 0) return null
  return [zame ? 'ช่องทางติดต่อร้านนะคะ / Contact us 💬' : 'ช่องทางติดต่อร้านนะคะ 💬', ...rows].join('\n')
}
