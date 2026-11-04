// งวดค่าเช่ารายเดือน: วันครบกำหนดของแต่ละงวด + เพดานการจ่ายล่วงหน้า — ใช้ร่วมกันทั้งหน้าเก็บเงินและ API (กฎเดียวกันทั้งสองฝั่ง)
//
// งวดที่ i (เริ่มที่ 0) ครบกำหนด = วันที่ paymentDay ของเดือนที่ (เดือนเริ่มสัญญา + i [+1 ถ้า paymentDay น้อยกว่าวันที่เริ่ม])
// หน้าเก็บเงินแสดงงวดตั้งแต่เริ่มสัญญาถึงงวดของ "เดือนปฏิทินปัจจุบัน" + จ่ายล่วงหน้าได้อีก MAX_PERIODS_AHEAD งวด
// (เดิมหยุดที่เดือนปัจจุบัน → จ่ายงวดนี้เสร็จแล้วลูกค้าขอจ่ายล่วงหน้าต่อไม่ได้ จนกว่าจะขึ้นเดือนปฏิทินใหม่)
export const MAX_PERIODS_AHEAD = 1

export function getDueDate(startDate: Date, periodIndex: number, paymentDay: number): Date {
  // If payment_day < start day-of-month, first due date is in the next month
  const offset = paymentDay < startDate.getDate() ? 1 : 0
  // คำนวณเดือนปลายทางก่อน แล้วบีบวันให้พอดีเดือนนั้น ค่อยตั้งวันที่ทีเดียว
  // (ของเดิม setMonth ก่อนบีบวัน: เริ่มวันที่ 29-31 ไปตกเดือนที่สั้นกว่า เช่น 31 ต.ค. + 1 เดือน = "31 พ.ย." เด้งไป 1 ธ.ค. แล้วบีบผิดเดือน
  //  → งวดนั้นได้ 31 ธ.ค. แทน 30 พ.ย. และซ้ำกับงวดถัดไป)
  const total = startDate.getMonth() + periodIndex + offset
  const year = startDate.getFullYear() + Math.floor(total / 12)
  const month = ((total % 12) + 12) % 12
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const d = new Date(startDate)
  d.setFullYear(year, month, Math.min(paymentDay, daysInMonth))
  return d
}

// จำนวนเดือนปฏิทินที่ผ่านมาตั้งแต่เดือนเริ่มสัญญา (= ดัชนีงวดของเดือนปัจจุบัน)
export function monthsElapsed(startDate: Date, now: Date): number {
  return (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth())
}

// วันครบกำหนดของงวดสุดท้ายที่อนุญาตให้รับเงินได้ (งวดเดือนปัจจุบัน + จ่ายล่วงหน้า MAX_PERIODS_AHEAD งวด) เป็น YYYY-MM-DD
export function lastAllowedDueDate(startDate: Date, now: Date, paymentDay: number): string {
  return getDueDate(startDate, monthsElapsed(startDate, now) + MAX_PERIODS_AHEAD, paymentDay).toISOString().split('T')[0]
}
