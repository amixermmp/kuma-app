// คู่มือการใช้งาน Kuma App (Staff) — Node.js generator
// Run: node make_manual.js
const fs = require('fs')
const path = require('path')

// ── Try to load docx ────────────────────────────────────────────────────────
let docxLib
try {
  docxLib = require('docx')
} catch {
  console.error('❌ ยังไม่ได้ติดตั้ง docx library')
  console.error('กรุณารัน: npm install docx')
  process.exit(1)
}

const {
  Document, Packer, Paragraph, TextRun, ImageRun,
  HeadingLevel, AlignmentType, BorderStyle, WidthType,
  Table, TableRow, TableCell,
  Header, Footer, PageNumber, PageBreak, LevelFormat,
} = docxLib

const CAPTION_DIR = path.join(__dirname, 'caption')
const OUT = path.join(__dirname, 'คู่มือการใช้งาน_Kuma_Staff.docx')

// ── helpers ─────────────────────────────────────────────────────────────────
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 120 },
    children: [new TextRun({ text, bold: true, size: 34, font: 'Sarabun', color: '1d4ed8' })],
  })
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text, bold: true, size: 26, font: 'Sarabun', color: '374151' })],
  })
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 160, after: 60 },
    children: [new TextRun({ text, bold: true, size: 22, font: 'Sarabun', color: '4b5563' })],
  })
}
function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 22, font: 'Sarabun', ...opts })],
  })
}
function bul(text) {
  return new Paragraph({
    spacing: { after: 60 },
    numbering: { reference: 'bullets', level: 0 },
    children: [new TextRun({ text, size: 22, font: 'Sarabun' })],
  })
}
function note(text) {
  return new Paragraph({
    spacing: { after: 80 },
    indent: { left: 400 },
    children: [new TextRun({ text: `📌 ${text}`, size: 20, font: 'Sarabun', color: '7c3aed', italics: true })],
  })
}
function divider() {
  return new Paragraph({
    spacing: { before: 160, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'e5e7eb', space: 1 } },
    children: [],
  })
}
function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] })
}
function imgFile(filename, widthPt = 240) {
  const fpath = path.join(CAPTION_DIR, filename)
  if (!fs.existsSync(fpath)) {
    return p(`[รูป: ${filename}]`, { color: '9ca3af' })
  }
  const data = fs.readFileSync(fpath)
  // Approx height for phone screenshot (ratio ~2:1 height:width)
  const w = Math.round(widthPt * 0.75)
  const h = Math.round(w * 1.95)
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 120 },
    children: [
      new ImageRun({
        type: 'jpg',
        data,
        transformation: { width: w, height: h },
        altText: { title: filename, description: filename, name: filename },
      }),
    ],
  })
}
function imgRow(files, widthEach = 200) {
  const cells = files.map(f => {
    const fpath = path.join(CAPTION_DIR, f)
    let child
    if (fs.existsSync(fpath)) {
      const data = fs.readFileSync(fpath)
      const w = Math.round(widthEach * 0.75)
      const h = Math.round(w * 1.95)
      child = new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 60 },
        children: [new ImageRun({ type: 'jpg', data, transformation: { width: w, height: h }, altText: { title: f, description: f, name: f } })],
      })
    } else {
      child = p(`[${f}]`, { color: '9ca3af' })
    }
    return new TableCell({
      borders: {
        top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      },
      children: [child],
    })
  })
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [new TableRow({ children: cells })],
  })
}

// ── cover page ───────────────────────────────────────────────────────────────
const cover = [
  new Paragraph({ spacing: { before: 1800, after: 300 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: '🛵  Kuma Rental', bold: true, size: 72, font: 'Sarabun', color: '1d4ed8' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
    children: [new TextRun({ text: 'คู่มือการใช้งานระบบสำหรับพนักงาน', bold: true, size: 40, font: 'Sarabun', color: '374151' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 },
    children: [new TextRun({ text: '(Staff Manual)', size: 28, font: 'Sarabun', color: '6b7280', italics: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
    children: [new TextRun({ text: 'ระบบบริหารจัดการมอเตอร์ไซค์ให้เช่า', size: 26, font: 'Sarabun', color: '9ca3af' })] }),
  pageBreak(),
]

// ── main content ────────────────────────────────────────────────────────────
const content = [

  /* ── 1. Login ────────────────────────────────────────────────────────── */
  h1('1. การเข้าสู่ระบบ'),
  p('เมื่อเปิดแอพ Kuma Rental จะพบหน้าแรกมีสองตัวเลือก: Staff Login และ Owner Login พนักงานให้เลือก "Staff Login"'),
  imgRow(['1782831809197.jpg', '1782831886732.jpg'], 200),
  h2('ขั้นตอนการ Login'),
  bul('กดปุ่ม "Staff Login" ที่หน้าแรก'),
  bul('ระบบจะแสดงหน้ากรอก PIN 6 หลัก'),
  bul('กรอกตัวเลข PIN ที่ได้รับจากผู้จัดการ แล้วกดปุ่ม ✓'),
  note('PIN แต่ละคนไม่เหมือนกัน ห้ามแชร์ PIN ให้ผู้อื่น'),
  divider(),

  /* ── 2. Home ──────────────────────────────────────────────────────────── */
  h1('2. หน้าหลัก (Home Dashboard)'),
  p('หลัง Login สำเร็จจะเข้าสู่หน้าหลัก แสดงภาพรวมงานและเมนูลัดที่ใช้บ่อย'),
  imgFile('1782831918662.jpg', 220),
  h2('ส่วนประกอบของหน้าหลัก'),
  h3('📷 สแกน QR รถ'),
  p('แตะที่ส่วนนี้เพื่อเปิดกล้องสแกน QR Code บนตัวรถ ระบบจะพาไปที่เมนูของรถคันนั้นทันที'),
  h3('🔴 แถบแจ้งเตือนงานค้าง'),
  p('แสดงจำนวนงานทั้งหมดที่รอดำเนินการ เช่น "มีงานค้าง 8 รายการ" แตะเพื่อเข้าสู่หน้า Job Tasks'),
  h3('📋 เมนูด่วน'),
  bul('ค้นหารถ — ค้นหารถว่างตามช่วงวันที่'),
  bul('รวมรถ — ดูสถานะรถทุกคันในสาขา'),
  bul('แจ้งรถเสีย — รายงานปัญหารถ'),
  bul('งานเอกสาร — ติดตามภาษีและ พรบ. รถทุกคัน'),
  bul('งานรูทีน — ติดตามการซ่อมบำรุงตามระยะ'),
  divider(),

  /* ── 3. Job Tasks ─────────────────────────────────────────────────────── */
  h1('3. Job Tasks — ภาพรวมงานทั้งหมด'),
  p('หน้า Job Tasks รวมงานทุกประเภทไว้ในที่เดียว แบ่งเป็นแท็บให้เลือกดูตามหมวดหมู่'),
  imgRow(['1782831958196.jpg', '1782832001029.jpg'], 200),

  h2('แท็บในหน้า Job Tasks'),
  h3('📦 ทั้งหมด'),
  p('แสดงภาพรวมงานทุกประเภทรวมกัน ดูยอดรวมจากตัวเลขที่แท็บ'),

  h3('📞 ติดต่อลูกค้า'),
  p('แสดงรถรายเดือนที่ใกล้ครบกำหนดชำระ (0–2 วัน) หรือเกินกำหนดแล้ว เพื่อติดต่อลูกค้าเรื่องค่าเช่า'),
  imgFile('1782832030229.jpg', 180),

  h3('🛵 ส่งรถ'),
  p('แสดงรายการจองที่ถึงเวลาส่งรถ แต่ละการ์ดแสดงชื่อลูกค้า เบอร์โทร วันที่รับรถ และเวลานับถอยหลัง'),
  imgFile('1782832041519.jpg', 180),
  bul('สถานะ "รอส่งรถ" — จองที่กำหนดรถแล้ว พร้อมส่ง'),
  bul('สถานะ "ยังไม่ได้เลือกรถ" — ต้องเลือกรถก่อนส่ง'),
  bul('ปุ่ม "ยกเลิก" — ยกเลิกการจองนั้น'),
  bul('ปุ่ม "เปิด →" — เข้าหน้าส่งรถ หรือเลือกรถที่จะส่ง'),
  note('การ์ดจะคงอยู่จนกว่าจะกดยกเลิก ไม่หายไปเองแม้เลยเวลา'),

  h3('📥 รับคืน'),
  p('แสดงรถที่ครบกำหนดคืนภายในวันนี้ มีปุ่มดูสัญญาและปุ่มเปิดหน้ารับรถคืน'),
  imgFile('1782832051569.jpg', 180),

  h3('🏠 เช่าอยู่'),
  p('แสดงรายการรถทุกคันที่กำลังถูกเช่าอยู่ พร้อมชื่อลูกค้าและวันครบกำหนด'),
  imgFile('1782832061500.jpg', 180),

  h3('💥 รถเสีย'),
  p('แสดงรายการรถที่มีการแจ้งปัญหา รอการซ่อม'),

  h3('🔧 รูทีน'),
  p('แสดงรายการซ่อมบำรุงที่เกินกำหนดหรือใกล้ถึงกำหนด เช่น เปลี่ยนน้ำมันเครื่อง'),
  imgFile('1782832088132.jpg', 180),

  h3('📄 เอกสาร'),
  p('แสดงรถที่ภาษีประจำปีหรือ พรบ. ใกล้หมดอายุหรือหมดอายุแล้ว'),

  h3('📋 รายเดือน'),
  p('แสดงรายชื่อรถในสัญญาเช่ารายเดือนทั้งหมด พร้อมวันครบกำหนดชำระ'),
  imgFile('1782832112573.jpg', 180),
  divider(),

  /* ── 4. ค้นหา ────────────────────────────────────────────────────────── */
  h1('4. ค้นหารถว่าง และ จองคิว'),
  p('ใช้เมื่อต้องการค้นหารถว่างในช่วงเวลาที่กำหนด ทั้งสำหรับส่งรถทันที (Walk-in) หรือจองคิวล่วงหน้า'),
  imgRow(['1782832133555.jpg', '1782832154018.jpg'], 200),
  h2('ขั้นตอนการค้นหา'),
  bul('กรอก "วันเริ่มเช่า" และ "วันที่คืนรถ" พร้อมเวลา'),
  bul('กด "ค้นหารถว่าง"'),
  bul('ระบบแสดงรุ่นรถที่มี พร้อมจำนวนว่าง'),
  h2('ปุ่มในผลการค้นหา'),
  bul('🛵 ส่งรถเลย — ลูกค้า Walk-in ที่เดินเข้ามาหน้าร้าน'),
  bul('📅 จองคิว — จองล่วงหน้า กรอกข้อมูลลูกค้าและยืนยัน'),
  note('ตัวเลขในวงกลมสีเขียว = จำนวนรถว่าง / ตัวเลขรวม = รถทั้งหมดของรุ่นนั้น'),
  divider(),

  /* ── 5. Walk-in ──────────────────────────────────────────────────────── */
  h1('5. Walk-in — ส่งรถให้ลูกค้าที่เดินเข้ามาทันที'),
  p('เมื่อลูกค้าเดินเข้ามาหน้าร้านโดยไม่ได้จองล่วงหน้า ใช้ขั้นตอนนี้'),
  imgRow(['1782832173971.jpg', '1782832196431.jpg'], 200),
  h2('ขั้นตอน Walk-in'),
  bul('ไปที่หน้าค้นหา → กรอกช่วงเวลา → กด "ค้นหารถว่าง"'),
  bul('กดปุ่ม "🛵 ส่งรถเลย" ที่รุ่นที่ลูกค้าต้องการ'),
  bul('ระบบแสดงรายการรถว่างของรุ่นนั้น ให้เลือกทะเบียนที่จะส่ง'),
  bul('กด "ยืนยัน — ไปหน้าส่งรถ →"'),
  note('ถ้ามีลูกค้าหลายคนพร้อมกัน สามารถเปิดหลาย Tab ได้ ข้อมูลแต่ละ Tab จะไม่ปนกัน'),
  divider(),

  /* ── 6. ส่งรถ ────────────────────────────────────────────────────────── */
  h1('6. ส่งรถให้ลูกค้า'),
  p('หน้าส่งรถใช้บันทึกข้อมูลการเช่าใหม่ทุกประเภท มีหลายส่วนที่ต้องกรอกให้ครบก่อนบันทึก'),
  imgRow(['1782832394164.jpg', '1782832409064.jpg'], 200),

  h2('ส่วนที่ 1: ข้อมูลลูกค้า'),
  bul('เบอร์โทรศัพท์ * — ระบบค้นหาชื่อลูกค้าเดิมให้อัตโนมัติ'),
  bul('ชื่อ - นามสกุล *'),
  bul('โรงแรม / ที่พัก'),

  h2('ส่วนที่ 2: ช่วงเวลาเช่า'),
  bul('วันที่รับรถ * และ วันที่กำหนดคืน *'),
  bul('เวลารับรถ'),
  bul('ระบบคำนวณราคารวมให้อัตโนมัติตามจำนวนวัน'),
  note('มีโปรโมชั่น "ราคานักศึกษา" ลด ฿50/วัน และโปรแพ็กเกจ (ฟรี 2 วันทุก 7 วัน)'),

  h2('ส่วนที่ 3: รูปภาพ (จำเป็นทุกรูป)'),
  bul('📄 รูปบัตรประชาชน / พาสปอร์ต'),
  bul('🤳 รูปคู่บัตรประชาชน (ลูกค้าถือบัตรพร้อมเห็นหน้า)'),
  bul('🛵 รูปคู่รถ (ลูกค้ายืนคู่รถก่อนรับ)'),
  bul('🔍 รูปตำหนิรถก่อนเช่า (ถ่ายรอบคัน)'),

  h2('ส่วนที่ 4: สภาพรถตอนส่ง'),
  bul('เลขไมล์ตอนส่งรถ'),
  bul('ระดับน้ำมัน (แถบสีเขียว 1–8)'),
  imgFile('1782832428948.jpg', 200),

  h2('ส่วนที่ 5: การชำระเงิน'),
  bul('วิธีชำระ: เงินสด หรือ สลิปโอน'),
  bul('เงินมัดจำ (บาท)'),
  bul('หลักฐานการชำระ (รูปเงินสดหรือสลิป)'),

  h2('ส่วนที่ 6: ล็อครถ'),
  p('ต้องเลือกว่าจะล็อครถหรือไม่ หากไม่เลือกระบบจะไม่ยอมให้บันทึก'),
  bul('🔒 ล็อครถ — ซ่อนรถจากผลค้นหา ลูกค้ารายอื่นจะไม่เห็น จนกว่าจะรับรถคืน'),
  bul('🔓 ไม่ล็อค — รถยังแสดงในระบบ (ใช้กรณีรถกลับมาแล้วให้เช่าต่อได้)'),

  h2('ส่วนที่ 7: ลายเซ็นลูกค้า'),
  p('ให้ลูกค้าเซ็นชื่อบนหน้าจอก่อนส่งรถ ลายเซ็นจะถูกบันทึกในสัญญาเช่า'),
  imgRow(['1782832447633.jpg', '1782832465463.jpg'], 200),
  bul('แตะกล่อง "✏️ แตะเพื่อเซ็นชื่อ"'),
  bul('ลูกค้าเซ็นในกล่อง แล้วกด "✅ ยืนยันลายเซ็น"'),
  bul('กด "เซ็นใหม่" หากต้องการล้างและเซ็นอีกครั้ง'),
  note('ลายเซ็นจะถูกบันทึกไว้แม้สลับไป Tab อื่น สามารถกลับมาบันทึกต่อได้'),
  imgFile('1782832477550.jpg', 200),

  h2('บันทึกการเช่า'),
  p('กดปุ่ม "💾 บันทึกการเช่า" เพื่อยืนยัน ระบบจะสร้างสัญญาและใบเสร็จอัตโนมัติ'),

  h2('การทำงานพร้อมกันหลายคัน (Multi-Tab)'),
  p('เมื่อลูกค้าหลายคนมาพร้อมกัน สามารถเปิดฟอร์มส่งรถหลายคันผ่านแท็บด้านบน'),
  imgFile('1782832552094.jpg', 220),
  bul('แต่ละแท็บเก็บข้อมูลแยกกัน ไม่ปนกัน'),
  bul('สลับแท็บได้อิสระ ข้อมูลและลายเซ็นจะไม่หาย'),
  divider(),

  /* ── 7. รับรถคืน ─────────────────────────────────────────────────────── */
  h1('7. รับรถคืน'),
  p('เมื่อลูกค้านำรถมาคืน เข้าหน้า Job Tasks → แท็บ รับคืน หรือเข้าผ่านเมนูรถ'),
  imgRow(['1782832624799.jpg', '1782832636359.jpg'], 200),
  h2('ขั้นตอนรับรถคืน'),
  bul('ตรวจสอบข้อมูลสรุปการเช่า: ชื่อลูกค้า, วันเริ่ม, กำหนดคืน, ค่าเช่า'),
  bul('ติ๊กรายการตรวจสภาพรถ: ไฟหน้า/ท้าย, กระจก, ตัวรถ, กุญแจ, ป้ายทะเบียน'),
  bul('กรอกเลขไมล์ตอนรับคืน'),
  bul('กรอกระดับน้ำมันตอนรับคืน'),
  bul('อัพโหลดรูปภาพตอนรับคืน'),
  bul('ถ้ามีความเสียหาย — กรอกค่าเสียหายและรายละเอียด'),
  bul('ตรวจสอบสรุปการเงิน (ค่าเช่า + ค่าเสียหาย - มัดจำ = ยอดที่ลูกค้าต้องจ่ายเพิ่ม)'),
  bul('กด "✅ ยืนยันรับรถคืน"'),
  note('ระบบจะปลดล็อครถอัตโนมัติหลังรับคืน รถจะกลับมาเป็นสถานะ "ว่าง"'),
  divider(),

  /* ── 8. เมนูรถ ────────────────────────────────────────────────────────── */
  h1('8. เมนูรถ (Bike Menu)'),
  p('เข้าได้โดยสแกน QR ที่รถ หรือเลือกจากหน้า รวมรถ เมนูรถแสดงข้อมูลและฟังก์ชั่นเฉพาะรถคันนั้น'),
  imgFile('1782833172247.jpg', 220),
  h2('ปุ่มในเมนูรถ'),
  bul('➡️ ส่งรถให้ลูกค้า — ใช้ได้เมื่อรถว่าง เปิดหน้ากรอกข้อมูลส่งรถ'),
  bul('⬅️ รับรถคืน — ใช้ได้เมื่อรถกำลังถูกเช่า เปิดหน้ารับรถคืน'),
  bul('🔍 ค้นหา & ลงคิวจอง — ไปหน้าค้นหารถว่าง'),
  bul('⏱️ ต่อเวลา — ขยายวันเช่าสำหรับรถที่กำลังถูกเช่าอยู่'),
  bul('🛵💥 แจ้งรถเสีย — รายงานปัญหาของรถคันนี้'),
  bul('🔧 งานรูทีน — ดูและบันทึกการซ่อมบำรุงรถคันนี้'),
  bul('📄 งานเอกสาร — ดูสถานะภาษีและ พรบ. ของรถคันนี้'),
  bul('📋 Job Tasks — งานทั้งหมดที่เกี่ยวข้องกับรถคันนี้'),
  note('ปุ่มสีเทา/จางๆ คือปุ่มที่ใช้ไม่ได้ในสถานะปัจจุบันของรถ'),
  divider(),

  /* ── 9. Fleet ────────────────────────────────────────────────────────── */
  h1('9. รวมรถ (Fleet)'),
  p('หน้ารวมรถแสดงรายชื่อรถทุกคันในสาขา พร้อมสถานะปัจจุบัน ค้นหาได้ด้วยเลขทะเบียน'),
  imgFile('1782832228163.jpg', 200),
  h2('สัญลักษณ์สถานะรถ'),
  bul('🟢 ว่าง — รถพร้อมให้เช่า'),
  bul('🔵 เช่าอยู่ — รถกำลังถูกเช่า'),
  bul('🟣 รายเดือน — รถอยู่ในสัญญาเช่ารายเดือน'),
  bul('🔴 ซ่อม — รถอยู่ระหว่างซ่อม ไม่พร้อมให้เช่า'),
  divider(),

  /* ── 10. แจ้งรถเสีย ─────────────────────────────────────────────────── */
  h1('10. แจ้งรถเสีย'),
  p('ใช้เมื่อพบว่ารถมีปัญหาหรือเสีย ระบบจะสร้าง Job Task และเปลี่ยนสถานะรถเป็น "ซ่อม"'),
  imgRow(['1782832247045.jpg', '1782832585199.jpg'], 200),
  h2('ขั้นตอน'),
  bul('เลือกรถที่มีปัญหาจากรายการ'),
  bul('อธิบายอาการ เช่น เครื่องไม่ติด, ยางแบน'),
  bul('เลือกระดับความรุนแรง: ปานกลาง หรือ วิกฤต'),
  bul('อัพโหลดรูปจุดที่เสีย'),
  bul('ระบุตำแหน่งรถ / หมายเหตุ'),
  bul('กด "บันทึกแจ้งรถเสีย"'),
  divider(),

  /* ── 11. งานรูทีน ────────────────────────────────────────────────────── */
  h1('11. งานซ่อมบำรุงรูทีน'),
  p('ระบบแจ้งเตือนการบำรุงรักษาตามระยะกิโลเมตรหรือตามวันที่กำหนด เช่น เปลี่ยนน้ำมันเครื่องทุก 1,000 กม.'),
  imgRow(['1782832300009.jpg', '1782833188014.jpg'], 200),
  h2('สถานะของงานรูทีน'),
  bul('🔴 เกินกำหนดแล้ว — เลยระยะที่กำหนด ต้องทำด่วน'),
  bul('⚠️ ใกล้ถึงกำหนด — เหลืออีกไม่กี่วัน/กิโลเมตร'),
  bul('✅ ปกติ — ยังไม่ถึงกำหนด'),
  h2('บันทึกว่าทำเสร็จแล้ว'),
  bul('กดเข้าที่รายการนั้น'),
  bul('กรอกเลขไมล์ที่ทำ'),
  bul('กรอกชื่อร้านซ่อม / ผู้ดำเนินการ'),
  bul('กรอกค่าใช้จ่าย (บาท)'),
  bul('อัพโหลดใบเสร็จ (ถ้ามี)'),
  bul('กด "✅ บันทึกว่าเสร็จแล้ว"'),
  note('ระบบจะรีเซ็ตระยะถัดไปอัตโนมัติหลังบันทึก'),
  divider(),

  /* ── 12. งานเอกสาร ───────────────────────────────────────────────────── */
  h1('12. งานเอกสาร (ภาษี / พรบ.)'),
  p('ติดตามวันหมดอายุของภาษีประจำปีและ พรบ. ประกันภัย ของรถทุกคันในสาขา'),
  imgFile('1782833213898.jpg', 200),
  h2('สถานะเอกสาร'),
  bul('✅ เหลือ 161+ วัน — ปกติ ยังไม่ต้องดำเนินการ'),
  bul('⚠️ ใกล้หมดอายุ — เหลือน้อยกว่า 30 วัน ควรรีบต่ออายุ'),
  bul('🔴 เกินกำหนดแล้ว — หมดอายุแล้ว ต้องต่ออายุทันที'),
  note('สามารถเข้าดูเฉพาะรถคันที่ต้องการได้จาก เมนูรถ → งานเอกสาร'),
  divider(),

  /* ── สรุป ──────────────────────────────────────────────────────────────── */
  pageBreak(),
  h1('สรุปขั้นตอนการทำงานประจำวัน'),
  p('ขั้นตอนแนะนำสำหรับ Staff ทุกวัน', { bold: true }),
  bul('1. เปิดแอพ → Login ด้วย PIN'),
  bul('2. ดูหน้าหลัก → เช็คแถบแจ้งเตือนงานค้าง'),
  bul('3. เข้า Job Tasks → แท็บ "ส่งรถ" ดูการจองที่ต้องส่งวันนี้'),
  bul('4. เช็คแท็บ "รับคืน" ว่ามีรถครบกำหนดวันนี้ไหม'),
  bul('5. ลูกค้า Walk-in มา → ค้นหา → ส่งรถเลย → กรอกข้อมูล → บันทึก'),
  bul('6. ลูกค้าโทรจอง → ค้นหา → จองคิว → กรอกข้อมูล → ยืนยัน'),
  bul('7. พบรถเสีย → แจ้งรถเสียทันที'),
  new Paragraph({ spacing: { before: 600 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: '— จบคู่มือการใช้งาน Kuma App สำหรับพนักงาน —', size: 22, font: 'Sarabun', color: '9ca3af', italics: true })] }),
]

// ── build document ───────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: '•',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    }],
  },
  styles: {
    default: {
      document: { run: { font: 'Sarabun', size: 22 } },
    },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 34, bold: true, font: 'Sarabun', color: '1d4ed8' },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: 'Sarabun', color: '374151' },
        paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: 'Sarabun', color: '4b5563' },
        paragraph: { spacing: { before: 160, after: 60 }, outlineLevel: 2 } },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'e5e7eb', space: 1 } },
          children: [new TextRun({ text: 'Kuma Rental — คู่มือพนักงาน', size: 18, font: 'Sarabun', color: '9ca3af' })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'หน้า ', size: 18, font: 'Sarabun', color: '9ca3af' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, font: 'Sarabun', color: '9ca3af' }),
            new TextRun({ text: ' / ', size: 18, font: 'Sarabun', color: '9ca3af' }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: 'Sarabun', color: '9ca3af' }),
          ],
        })],
      }),
    },
    children: [...cover, ...content],
  }],
})

console.log('⏳ กำลังสร้างไฟล์...')
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf)
  console.log('✅ สำเร็จ! ไฟล์อยู่ที่:')
  console.log('   ' + OUT)
}).catch(e => {
  console.error('❌ Error:', e.message)
  process.exit(1)
})
