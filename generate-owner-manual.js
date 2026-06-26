// คู่มือการใช้งาน Kuma Rental — สำหรับเจ้าของ (Owner)
// วิธีรัน: node generate-owner-manual.js
// ติดตั้ง docx ก่อน: npm install docx

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageNumber, Header, Footer, PageBreak,
} = require('docx')
const fs = require('fs')

// ─── helpers ───────────────────────────────────────────────────────────────

const PURPLE = '7C3AED'
const NAVY   = '0F172A'
const BLUE   = '1D4ED8'
const GREEN  = '15803D'
const GRAY   = '6B7280'
const LIGHT_PURPLE = 'EDE9FE'
const LIGHT_BLUE   = 'DBEAFE'
const LIGHT_YELLOW = 'FEF9C3'
const LIGHT_GREEN  = 'DCFCE7'
const LIGHT_RED    = 'FEE2E2'

const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
const borders = { top: border, bottom: border, left: border, right: border }

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, bold: true, size: 36, color: NAVY, font: 'Sarabun' })],
  })
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 28, color: PURPLE, font: 'Sarabun' })],
  })
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80 },
    children: [new TextRun({ text, bold: true, size: 24, color: NAVY, font: 'Sarabun' })],
  })
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, size: 22, font: 'Sarabun', ...opts })],
  })
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 22, font: 'Sarabun' })],
  })
}

function numbered(text) {
  return new Paragraph({
    numbering: { reference: 'numbers', level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 22, font: 'Sarabun' })],
  })
}

function note(text, fill = LIGHT_YELLOW) {
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const left = { style: BorderStyle.SINGLE, size: 12, color: 'A855F7' }
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({ children: [new TableCell({
      borders: { top: none, bottom: none, left, right: none },
      width: { size: 9360, type: WidthType.DXA },
      shading: { fill, type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 200, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text, size: 20, font: 'Sarabun', italics: true })] })],
    })]})],
  })
}

function infoTable(rows) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3000, 6360],
    rows: rows.map(([label, value], i) => new TableRow({ children: [
      new TableCell({
        borders, width: { size: 3000, type: WidthType.DXA },
        shading: { fill: i === 0 ? LIGHT_PURPLE : 'F8FAFC', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: label, size: 20, bold: true, font: 'Sarabun' })] })],
      }),
      new TableCell({
        borders, width: { size: 6360, type: WidthType.DXA },
        shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: value, size: 20, font: 'Sarabun' })] })],
      }),
    ]})),
  })
}

function spacer() {
  return new Paragraph({ children: [new TextRun('')], spacing: { before: 60, after: 60 } })
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] })
}

// ─── CONTENT ───────────────────────────────────────────────────────────────

const content = [

  // ── ปก ──
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 2000, after: 200 },
    children: [new TextRun({ text: '🏍️  คู่มือการใช้งาน', size: 52, bold: true, font: 'Sarabun', color: NAVY })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 100 },
    children: [new TextRun({ text: 'Kuma Rental System', size: 40, bold: true, font: 'Sarabun', color: PURPLE })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 400 },
    children: [new TextRun({ text: 'สำหรับเจ้าของ (Owner)', size: 32, font: 'Sarabun', color: GRAY })],
  }),
  spacer(), spacer(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'เอกสารนี้อธิบายวิธีบริหารจัดการร้านให้เช่ามอเตอร์ไซค์ครบทุกฟีเจอร์', size: 22, font: 'Sarabun', color: GRAY })],
  }),
  pageBreak(),

  // ── บทที่ 1: เข้าสู่ระบบ ──
  h1('บทที่ 1 — การเข้าสู่ระบบ (Owner Login)'),
  body('เจ้าของเข้าระบบด้วย Email และ Password (ต่างจากพนักงานที่ใช้ PIN)'),
  spacer(),
  h2('1.1 วิธีเข้าสู่ระบบ'),
  numbered('เปิดเว็บ → กด "Owner Login"'),
  numbered('กรอก Email ที่ลงทะเบียนไว้'),
  numbered('กรอก Password'),
  numbered('กด "เข้าสู่ระบบ" — ระบบจะพาไปหน้า Dashboard'),
  spacer(),
  note('💡 ลืมรหัสผ่าน? กด "ลืมรหัสผ่าน" เพื่อรับ Email รีเซ็ต Password'),
  spacer(),
  h2('1.2 ความแตกต่างระหว่าง Owner และ Staff'),
  infoTable([
    ['หัวข้อ', 'เจ้าของ (Owner) vs พนักงาน (Staff)'],
    ['วิธีล็อกอิน', 'Owner: Email + Password | Staff: PIN 6 หลัก'],
    ['หน้าหลัก', 'Owner: Dashboard | Staff: Home'],
    ['สิทธิ์พิเศษ', 'Owner เท่านั้น: ดูรายได้, ตั้งค่าระบบ, จัดการพนักงาน'],
    ['ส่งรถ', 'ทำได้ทั้ง Owner และ Staff'],
    ['รับรถคืน', 'Staff ทำได้, Owner ต้องไปหน้ารายการเช่า'],
  ]),

  // ── บทที่ 2: Dashboard ──
  pageBreak(),
  h1('บทที่ 2 — Dashboard (ภาพรวมธุรกิจ)'),
  body('Dashboard แสดงสถิติ รายได้ และสถานะรถแบบ Real-time — เป็นจุดศูนย์กลางของ Owner'),
  spacer(),
  h2('2.1 ส่วนประกอบ Dashboard'),
  infoTable([
    ['การ์ด', 'ข้อมูลที่แสดง'],
    ['💰 รายได้วันนี้', 'ยอดรวมการเช่าที่เริ่มวันนี้'],
    ['🛵 รถว่าง / ทั้งหมด', 'จำนวนรถที่ให้เช่าได้ตอนนี้'],
    ['📋 การเช่าที่ Active', 'จำนวนสัญญาเช่าที่ยังไม่คืนรถ'],
    ['🔧 รถที่ซ่อม', 'จำนวนรถที่อยู่ระหว่างซ่อม'],
    ['📊 รายได้เดือนนี้', 'ยอดรวมของเดือนปัจจุบัน'],
    ['⚠️ งานค้าง', 'สรุปงานที่ต้องดำเนินการ'],
  ]),
  spacer(),
  h2('2.2 เมนูหลักของ Owner'),
  bullet('🛵 รวมรถ — ดูและจัดการรถทุกคัน'),
  bullet('📋 ประวัติการเช่า — ดูรายการเช่าทั้งหมด'),
  bullet('💸 บันทึกค่าใช้จ่าย — บันทึกต้นทุน'),
  bullet('⚙️ ตั้งค่า — ข้อมูลร้าน, พนักงาน, สาขา'),
  bullet('📜 Activity Log — ดูว่าใครทำอะไรในระบบ'),

  // ── บทที่ 3: รวมรถ ──
  pageBreak(),
  h1('บทที่ 3 — รวมรถ (Fleet Management)'),
  body('หน้านี้แสดงรถทุกคันพร้อมสถานะ เป็นจุดเริ่มต้นของการส่งรถหรือดูข้อมูล'),
  spacer(),
  h2('3.1 สีสถานะรถ'),
  infoTable([
    ['สี', 'ความหมาย'],
    ['🟢 เขียว', 'ว่าง — รถพร้อมให้เช่า'],
    ['🔵 น้ำเงิน', 'กำลังเช่า — รถอยู่กับลูกค้า'],
    ['🔴 แดง', 'ซ่อม — รถระหว่างซ่อมบำรุง'],
    ['⚫ เทา', 'เลิกใช้ — ปิดการใช้งาน'],
  ]),
  spacer(),
  h2('3.2 การเพิ่มรถใหม่'),
  numbered('กด "+ เพิ่มรถ" (มุมขวาบน)'),
  numbered('กรอกทะเบียนรถ'),
  numbered('เลือกยี่ห้อ / รุ่น / สี / ปี'),
  numbered('ตั้งค่าเช่า/วัน และมัดจำ'),
  numbered('อัพโหลดรูปรถ (แนะนำ)'),
  numbered('กดบันทึก'),
  spacer(),
  note('💡 รถใหม่จะมีสถานะ "ว่าง" อัตโนมัติ พร้อมให้เช่าได้ทันที'),
  spacer(),
  h2('3.3 หน้าของรถแต่ละคัน'),
  body('กดรถใดๆ เพื่อเข้าหน้าละเอียด — แสดง:'),
  bullet('ข้อมูลรถ (ยี่ห้อ, รุ่น, เลขไมล์, สถานะ)'),
  bullet('เมนูการดำเนินการ: ส่งรถ | รับรถคืน | ทำงานรูทีน | งานเอกสาร'),
  bullet('สถิติการเช่า (จำนวนครั้ง, รายได้รวม)'),
  bullet('เอกสารรถ (พ.ร.บ., ภาษี, หน้าเล่ม)'),
  spacer(),

  // ── บทที่ 4: เมนูดำเนินการในหน้ารถ ──
  pageBreak(),
  h1('บทที่ 4 — เมนูดำเนินการในหน้ารายละเอียดรถ'),
  body('หน้ารายละเอียดรถมีเมนู 4 ปุ่มที่ Owner ใช้ได้เอง ไม่ต้องพึ่งพนักงาน'),
  spacer(),
  h2('4.1 ส่งรถ (🟦 สีน้ำเงิน)'),
  body('ปุ่มนี้จะ active เฉพาะเมื่อรถ "ว่าง" เท่านั้น'),
  spacer(),
  numbered('กดปุ่ม "ส่งรถ" (สีน้ำเงิน)'),
  numbered('ระบบจะเปิดฟอร์มสร้างการเช่า'),
  numbered('กรอกเบอร์โทรลูกค้า → ระบบค้นหาลูกค้าเก่าอัตโนมัติ'),
  numbered('กรอกชื่อลูกค้า และโรงแรม/ที่พัก (ถ้ามี)'),
  numbered('เลือกวันเริ่มต้น - วันคืน'),
  numbered('ตรวจสอบค่าเช่า (คำนวณอัตโนมัติ)'),
  numbered('เลือกวิธีชำระเงิน: เงินสด / โอน / บัตร'),
  numbered('กด "✅ ยืนยันส่งรถ"'),
  spacer(),
  note('ℹ️ การส่งรถโดย Owner จะบันทึกใน Activity Log ระบุว่า "Owner" ทำรายการ — ต่างจาก Staff'),
  spacer(),
  h2('4.2 รับรถคืน (🟩 สีเขียว)'),
  body('ปุ่มนี้จะ active เมื่อรถมีการเช่าที่ active อยู่'),
  body('การกดจะพาไปที่ "ประวัติการเช่า" เพื่อดำเนินการรับคืน'),
  spacer(),
  h2('4.3 ทำงานรูทีน (🔧)'),
  body('เลื่อนไปยังส่วน "งานเอกสาร" ของหน้านั้นอัตโนมัติ — ใช้ตรวจสอบเอกสารรถ'),
  spacer(),
  h2('4.4 งานเอกสาร (📄)'),
  body('เลื่อนไปยังส่วนเอกสารรถ — ดู พ.ร.บ., ภาษี พร้อมวันหมดอายุ'),

  // ── บทที่ 5: ประวัติการเช่า ──
  pageBreak(),
  h1('บทที่ 5 — ประวัติการเช่า'),
  body('ดูรายการเช่าทั้งหมด ทั้งที่กำลัง active และที่เสร็จแล้ว'),
  spacer(),
  h2('5.1 การกรองข้อมูล'),
  infoTable([
    ['ตัวกรอง', 'รายละเอียด'],
    ['สถานะ', 'active / completed / extended / cancelled'],
    ['ช่วงวันที่', 'เลือกวันเริ่ม-สิ้นสุด'],
    ['ค้นหา', 'ค้นด้วยชื่อลูกค้า, เบอร์, หรือทะเบียนรถ'],
  ]),
  spacer(),
  h2('5.2 การรับรถคืน (จากหน้าประวัติ)'),
  body('กดรายการเช่าที่ต้องรับคืน → กด "รับรถคืน":'),
  numbered('ตรวจสภาพรถ (กาเครื่องหมาย ✓ / ✗ ในแต่ละรายการ)'),
  numbered('บันทึกเลขไมล์ตอนรับคืน'),
  numbered('ระบุระดับน้ำมัน'),
  numbered('กรอกค่าเสียหาย (ถ้ามี)'),
  numbered('ระบบคำนวณเงินคืนอัตโนมัติ'),
  numbered('กด "ยืนยันรับรถคืน"'),

  // ── บทที่ 6: ค่าใช้จ่าย ──
  pageBreak(),
  h1('บทที่ 6 — บันทึกค่าใช้จ่าย'),
  body('บันทึกต้นทุนของธุรกิจเพื่อดูกำไร-ขาดทุนที่แม่นยำ'),
  spacer(),
  h2('6.1 ประเภทค่าใช้จ่าย'),
  bullet('🔧 ค่าซ่อมรถ — ค่าอะไหล่, ค่าแรงช่าง'),
  bullet('⛽ ค่าน้ำมัน — ค่าเติมน้ำมันรถ'),
  bullet('🏢 ค่าเช่าสถานที่ — ค่าเช่าที่จอดหรืออาคาร'),
  bullet('📋 ค่าเอกสาร — ค่าต่อ พ.ร.บ., ภาษีประจำปี'),
  bullet('อื่นๆ — ค่าใช้จ่ายที่ไม่อยู่ในหมวดหมู่ข้างต้น'),
  spacer(),
  h2('6.2 วิธีบันทึก'),
  numbered('กด "บันทึกค่าใช้จ่าย"'),
  numbered('เลือกประเภท'),
  numbered('กรอกจำนวนเงิน'),
  numbered('เลือกรถที่เกี่ยวข้อง (ถ้ามี เช่น ค่าซ่อมรถคันไหน)'),
  numbered('กรอกรายละเอียด'),
  numbered('อัพโหลดใบเสร็จ (ไม่บังคับ)'),
  numbered('กดบันทึก'),

  // ── บทที่ 7: ตั้งค่า ──
  pageBreak(),
  h1('บทที่ 7 — ตั้งค่าระบบ (Settings)'),
  body('จัดการข้อมูลร้าน พนักงาน และสาขาจากหน้านี้'),
  spacer(),
  h2('7.1 ข้อมูลร้าน (Shop Info)'),
  infoTable([
    ['ฟิลด์', 'คำอธิบาย'],
    ['ชื่อร้าน', 'ชื่อที่แสดงในระบบและหัวเอกสาร'],
    ['โลโก้ร้าน', 'อัพโหลดโลโก้ — บันทึกอัตโนมัติทันที'],
    ['เบอร์ติดต่อ', 'เบอร์โทรร้านสำหรับลูกค้า'],
    ['Line / Facebook', 'ช่องทาง social media ของร้าน'],
    ['ที่อยู่', 'ที่อยู่สาขา'],
  ]),
  spacer(),
  note('💡 หลังอัพโหลดโลโก้ ระบบจะบันทึกให้อัตโนมัติ ไม่ต้องกด "บันทึก" แยก', LIGHT_GREEN),
  spacer(),
  h2('7.2 จัดการพนักงาน'),
  body('เพิ่ม แก้ไข ปิด/เปิดการใช้งาน และรีเซ็ต PIN พนักงาน:'),
  numbered('กด "จัดการพนักงาน"'),
  numbered('กด "+ เพิ่มพนักงาน"'),
  numbered('กรอกชื่อ และตั้ง PIN 6 หลัก'),
  numbered('กดบันทึก — พนักงานล็อกอินได้ทันที'),
  spacer(),
  body('รีเซ็ต PIN:'),
  numbered('กดพนักงานที่ต้องการ'),
  numbered('กด "เปลี่ยน PIN"'),
  numbered('กรอก PIN ใหม่'),
  spacer(),
  h2('7.3 จัดการสาขา (Branch)'),
  body('ถ้ามีหลายสาขา สามารถเพิ่มและตั้งชื่อสาขาได้ในส่วนนี้'),

  // ── บทที่ 8: Activity Log ──
  pageBreak(),
  h1('บทที่ 8 — Activity Log (ประวัติการทำงาน)'),
  body('บันทึกทุกการกระทำในระบบ — ใครทำ อะไร เมื่อไหร่ ระบบเก็บหมด'),
  spacer(),
  h2('8.1 ประเภท Actor ใน Log'),
  infoTable([
    ['ประเภท', 'ความหมาย'],
    ['owner', 'เจ้าของร้านดำเนินการด้วยตัวเอง'],
    ['staff', 'พนักงาน (ระบุชื่อพนักงาน)'],
    ['system', 'ระบบดำเนินการอัตโนมัติ'],
  ]),
  spacer(),
  h2('8.2 การกรอง Log'),
  bullet('กรอง by วันที่'),
  bullet('กรอง by ประเภท actor (owner / staff / system)'),
  bullet('กรอง by ประเภท action (rental_created, return_completed, etc.)'),
  spacer(),
  h2('8.3 ประโยชน์ของ Activity Log'),
  bullet('ตรวจสอบว่าพนักงานทำรายการถูกต้องหรือไม่'),
  bullet('ย้อนดูเหตุการณ์ถ้ามีข้อพิพาทกับลูกค้า'),
  bullet('ดูว่ารถถูกส่งหรือรับคืนโดยใคร เมื่อไหร่'),
  bullet('ตรวจสอบการแก้ไขข้อมูล เช่น เปลี่ยนราคา'),

  // ── บทที่ 9: โลโก้และการแสดงผล ──
  pageBreak(),
  h1('บทที่ 9 — การแสดงโลโก้ร้าน'),
  body('โลโก้ที่อัพโหลดจะแสดงในจุดต่างๆ ของระบบ:'),
  spacer(),
  h2('9.1 จุดที่โลโก้แสดง'),
  bullet('หน้าล็อกอิน (Staff Login) — แสดงแทนไอคอนมอเตอร์ไซค์ default'),
  bullet('หน้า Home ของ Staff — มุมบนซ้าย'),
  bullet('หัว PDF เอกสาร (ถ้ามีการออกเอกสาร)'),
  spacer(),
  h2('9.2 วิธีอัพโหลดโลโก้'),
  numbered('ไปที่ ⚙️ ตั้งค่า → ข้อมูลร้าน'),
  numbered('กดที่รูป หรือกด "อัพโหลดโลโก้"'),
  numbered('เลือกไฟล์รูป (PNG หรือ JPG, ขนาดแนะนำ 200×200 px ขึ้นไป)'),
  numbered('ระบบอัพโหลดและบันทึกอัตโนมัติ — ไม่ต้องกด "บันทึก"'),
  numbered('รีเฟรชหน้า — โลโก้จะแสดงทันที'),

  // ── บทที่ 10: FAQ ──
  pageBreak(),
  h1('บทที่ 10 — คำถามที่พบบ่อย (FAQ)'),
  spacer(),
  h3('Q: จะดูว่าเดือนนี้รายได้เท่าไหร่?'),
  body('ดูที่การ์ด "รายได้เดือนนี้" บน Dashboard หรือกรอง "ประวัติการเช่า" ตามช่วงวันที่'),
  spacer(),
  h3('Q: พนักงานทำรายการผิด จะแก้ไขได้ไหม?'),
  body('ตอนนี้ยังไม่มีหน้าแก้ไขโดยตรง — ให้ดูใน Activity Log ก่อน แล้วติดต่อ developer เพื่อแก้ข้อมูล'),
  spacer(),
  h3('Q: จะเพิ่มสาขาที่ 2 ได้ไหม?'),
  body('ได้ — ไปที่ ตั้งค่า → สาขา → เพิ่มสาขา แล้วตั้งชื่อสาขาใหม่'),
  spacer(),
  h3('Q: ลูกค้าบอกว่าคืนรถแล้ว แต่ระบบยังแสดงว่ากำลังเช่า?'),
  body('พนักงานอาจยังไม่ได้กด "ยืนยันรับรถคืน" — ตรวจสอบใน Activity Log แล้วให้พนักงานดำเนินการให้ครบ'),
  spacer(),
  h3('Q: จะเปลี่ยนราคาเช่า/วัน ของรถได้ไหม?'),
  body('กดรถที่ต้องการ → กด "แก้ไขข้อมูลรถ" → เปลี่ยนราคา → บันทึก — ราคาใหม่จะใช้กับการจองถัดไป'),
  spacer(),
  h3('Q: ดูได้ไหมว่าพนักงานคนไหนส่งรถ?'),
  body('ได้ — ดูใน Activity Log → กรอง by action "rental_created" — จะเห็นชื่อ Staff ที่ทำรายการ'),
  spacer(),
  spacer(),
  note('📞 หากพบปัญหาที่ไม่อยู่ในคู่มือ กรุณาติดต่อทีม developer เพื่อรับการสนับสนุน', LIGHT_BLUE),
  spacer(),
  spacer(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400 },
    children: [new TextRun({ text: '— จบคู่มือเจ้าของ —', size: 24, font: 'Sarabun', color: GRAY, italics: true })],
  }),
]

// ─── BUILD DOC ─────────────────────────────────────────────────────────────

const doc = new Document({
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  styles: {
    default: { document: { run: { font: 'Sarabun', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: 'Sarabun', color: NAVY },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Sarabun', color: PURPLE },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: 'Sarabun', color: NAVY },
        paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 } },
    ],
  },
  sections: [{
    properties: {
      page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
    },
    headers: { default: new Header({ children: [new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '7C3AED', space: 1 } },
      children: [new TextRun({ text: 'Kuma Rental — คู่มือเจ้าของ (Owner)', size: 18, font: 'Sarabun', color: GRAY })],
    })] }) },
    footers: { default: new Footer({ children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ text: 'หน้า ', size: 18, font: 'Sarabun', color: GRAY }),
        new TextRun({ children: [PageNumber.CURRENT], size: 18, font: 'Sarabun', color: GRAY }),
      ],
    })] }) },
    children: content,
  }],
})

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('คู่มือ-Owner-Kuma-Rental.docx', buf)
  console.log('✅ สร้างไฟล์ คู่มือ-Owner-Kuma-Rental.docx เรียบร้อยแล้ว')
}).catch(err => {
  console.error('❌ Error:', err.message)
})
