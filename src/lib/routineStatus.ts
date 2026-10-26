// เกณฑ์ถึงกำหนดของรูทีนซ่อมบำรุง — ไฟล์นี้ต้องไม่ import อะไรฝั่งเซิร์ฟเวอร์ เพราะหน้า client ใช้ร่วมด้วย
// รูทีนหนึ่งมีได้ 3 เงื่อนไข (กม. / วันเช่าสะสม / ปฏิทิน) ถึงอันไหนก่อนก็ต้องทำ → ต้องตรวจครบทุกอัน
// เคยเช็คแบบเจอเงื่อนไขแรกแล้วจบ ทำให้ "ใกล้ถึง กม." ไปบัง "วันเช่าสะสมเกินแล้ว" จนไม่ขึ้นว่าเกินกำหนด

export type RoutineDueInput = {
  next_due_km: number | null
  next_due_date: string | null
  interval_rented_days?: number | null
  rented_days_accumulated?: number | null
}

export type RoutineReason = {
  kind: 'km' | 'rented' | 'date'
  text: string   // ข้อความเต็ม ใช้ในหน้ารูทีน
  short: string  // ข้อความสั้น ใช้บนป้าย/การ์ด
}

export function routineDueReasons(
  r: RoutineDueInput,
  odometer: number,
  now: number = Date.now(),
): { overdue: RoutineReason[]; warning: RoutineReason[] } {
  const overdue: RoutineReason[] = []
  const warning: RoutineReason[] = []

  if (r.next_due_km != null) {
    const diff = odometer - r.next_due_km
    if (diff >= 0) {
      overdue.push({
        kind: 'km',
        text: `ถึงกำหนดแล้ว! (${odometer.toLocaleString()} กม. / กำหนด ${r.next_due_km.toLocaleString()} กม.)`,
        short: diff === 0 ? 'ถึงกำหนดพอดี (กม.)' : `เกิน ${diff.toLocaleString()} กม.`,
      })
    } else if (diff >= -500) {
      const left = Math.abs(diff)
      warning.push({ kind: 'km', text: `อีก ${left} กม. จะถึงกำหนด`, short: `อีก ${left.toLocaleString()} กม.` })
    }
  }

  // วันเช่าสะสม — เฉพาะรูทีนที่ตั้งค่านี้ไว้แล้ว (ผ่านการบำรุงรอบใหม่มาอย่างน้อย 1 ครั้งหลังฟีเจอร์นี้ออก)
  if (r.interval_rented_days != null) {
    const rented = r.rented_days_accumulated ?? 0
    const diff = rented - r.interval_rented_days
    if (diff >= 0) {
      overdue.push({
        kind: 'rented',
        text: `ถึงกำหนดตามวันเช่าสะสม! (เช่าไปแล้ว ${rented} วัน / กำหนด ${r.interval_rented_days} วัน)`,
        short: diff === 0 ? `เช่าสะสมครบ ${rented}/${r.interval_rented_days} วัน` : `เช่าสะสมเกิน ${diff} วัน (${rented}/${r.interval_rented_days})`,
      })
    } else if (diff >= -7) {
      const left = Math.abs(diff)
      warning.push({ kind: 'rented', text: `อีก ${left} วันเช่า จะถึงกำหนด`, short: `อีก ${left} วันเช่า` })
    }
  }

  // เพดานปฏิทิน — กันของเสื่อมจากเวลาแม้ไม่ได้ใช้งาน
  if (r.next_due_date) {
    const dueMs = new Date(r.next_due_date).getTime()
    const days = Math.ceil((dueMs - now) / 86_400_000)
    const dateLabel = new Date(r.next_due_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
    if (days <= 0) {
      overdue.push({
        kind: 'date',
        text: `ถึงกำหนดตามวันที่ (${dateLabel})`,
        short: days < 0 ? `เลยกำหนด ${Math.abs(days)} วัน` : 'ครบกำหนดวันนี้',
      })
    } else if (days <= 14) {
      warning.push({ kind: 'date', text: `อีก ${days} วันจะถึงกำหนด`, short: `อีก ${days} วัน` })
    }
  }

  return { overdue, warning }
}
