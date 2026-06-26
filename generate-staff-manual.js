// คู่มือการใช้งาน Kuma Rental — สำหรับพนักงาน (Staff)
// วิธีรัน: node generate-staff-manual.js
// ติดตั้ง docx ก่อน: npm install docx

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageNumber, Header, Footer, PageBreak,
} = require('docx')
const fs = require('fs')

// ─── helpers ───────────────────────────────────────────────────────────────

const BLUE  = '1D4ED8'
const NAVY  = '0F172A'
const GREEN = '15803D'
const RED   = 'DC2626'
const GRAY  = '6B7280'
const LIGHT_BLUE = 'DBEAFE'
const LIGHT_GREEN = 'DCFCE7'
const LIGHT_YELLOW = 'FEF9C3'

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
    children: [new TextRun({ text, bold: true, size: 28, color: BLUE, font: 'Sarabun' })],
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

function bullet(text, bold = false) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 22, font: 'Sarabun', bold })],
  })
}

function numbered(text) {
  return new Paragraph({
    numbering: { reference: 'numbers', level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 22, font: 'Sarabun' })],
  })
}

function note(text, color = LIGHT_YELLOW) {
  const cellBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    margins: { top: 80, bottom: 80, left: 0, right: 0 },
    rows: [new TableRow({ children: [new TableCell({
      borders: { top: cellBorder, bottom: cellBorder, left: { style: BorderStyle.SINGLE, size: 12, color: 'F59E0B' }, right: cellBorder },
      width: { size: 9360, type: WidthType.DXA },
      shading: { fill: color, type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 200, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text, size: 20, font: 'Sarabun', italics: true })] })],
    })]})],
  })
}

function infoTable(rows, headerFill = LIGHT_BLUE) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3000, 6360],
    rows: [
      ...rows.map(([label, value], i) => new TableRow({ children: [
        new TableCell({
          borders,
          width: { size: 3000, type: WidthType.DXA },
          shading: { fill: i === 0 ? headerFill : 'F8FAFC', type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: label, size: 20, bold: true, font: 'Sarabun' })] })],
        }),
        new TableCell({
          borders,
          width: { size: 6360, type: WidthType.DXA },
          shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: value, size: 20, font: 'Sarabun' })] })],
        }),
      ]})),
    ],
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
    children: [new TextRun({ text: '🛵  คู่มือการใช้งาน', size: 52, bold: true, font: 'Sarabun', color: NAVY })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 100 },
    children: [new TextRun({ text: 'Kuma Rental System', size: 40, bold: true, font: 'Sarabun', color: BLUE })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 400 },
    children: [new TextRun({ text: 'สำหรับพนักงาน (Staff)', size: 32, font: 'Sarabun', color: GRAY })],
  }),
  spacer(), spacer(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'เอกสารนี้อธิบายวิธีการใช้งานระบบบริหารจัดการมอเตอร์ไซค์ให้เช่า', size: 22, font: 'Sarabun', color: GRAY })],
  }),
  pageBreak(),

  // ── บทที่ 1: เข้าสู่ระบบ ──
  h1('บทที่ 1 — การเข้าสู่ระบบ (Login)'),
  body('พนักงานทุกคนมี PIN 6 หลัก สำหรับเข้าใช้งานระบบ ไม่ต้องจำ username หรือรหัสผ่านยาวๆ'),
  spacer(),
  h2('1.1 วิธีเข้าสู่ระบบ'),
  numbered('เปิดเว็บเบราว์เซอร์ไปที่ URL ของร้าน'),
  numbered('กด "Staff Login" (ปุ่มสีขาว)'),
  numbered('กรอก PIN 6 หลักที่ได้รับจากเจ้าของร้าน'),
  numbered('กด "เข้าสู่ระบบ" — ระบบจะพาไปหน้า Home ทันที'),
  spacer(),
  note('💡 ถ้า PIN ผิด ระบบจะแจ้ง "PIN ไม่ถูกต้อง" — ให้ตรวจสอบกับเจ้าของร้าน'),
  spacer(),

  // ── บทที่ 2: หน้า Home ──
  pageBreak(),
  h1('บทที่ 2 — หน้า Home'),
  body('หน้า Home แสดงภาพรวมงานของวันนั้น และเมนูด่วน สำหรับเข้าถึงฟีเจอร์หลัก'),
  spacer(),
  h2('2.1 ส่วนประกอบหน้า Home'),
  infoTable([
    ['ส่วน', 'คำอธิบาย'],
    ['📷 สแกน QR รถ', 'กดเพื่อเปิดกล้องสแกน QR Code บนรถ เป็นวิธีที่เร็วที่สุด'],
    ['📌 งานค้าง', 'แสดงจำนวนงานที่ต้องทำ เช่น ส่งรถ คืนรถ เอกสารหมดอายุ'],
    ['🔍 ค้นหารถ', 'ค้นหารถที่ว่างสำหรับจองหรือเช่า'],
    ['🛵 รวมรถ', 'ดูรถทุกคันและสถานะปัจจุบัน'],
    ['🔧 แจ้งรถเสีย', 'รายงานรถที่มีปัญหา ต้องซ่อม'],
    ['📄 งานเอกสาร', 'ดูเอกสารรถที่กำลังจะหมดอายุ'],
  ]),
  spacer(),
  h2('2.2 การอ่านงานค้าง'),
  body('กล่อง "งานค้าง" จะเปลี่ยนสีตามความเร่งด่วน:'),
  bullet('🟣 สีม่วง — มีงานค้าง (ตัวเลขสีแดงบอกจำนวน)'),
  bullet('⚪ สีเทา — ไม่มีงานค้าง ทุกอย่างเรียบร้อย'),
  spacer(),
  body('ประเภทงานค้างที่แสดง:'),
  bullet('🛵➡️ ส่งรถ — มีการจองที่ต้องส่งรถภายใน 24 ชั่วโมง'),
  bullet('⬅️ รับคืน — รถที่ครบกำหนดหรือเกินกำหนดคืน'),
  bullet('🔧 ซ่อม — รถที่รอซ่อมหรืออยู่ระหว่างซ่อม'),
  bullet('💰 รายเดือน — ค่าเช่ารายเดือนที่ค้างชำระ'),
  bullet('📋 เอกสาร — เอกสารรถที่จะหมดอายุใน 30 วัน'),

  // ── บทที่ 3: สแกน QR และส่งรถ ──
  pageBreak(),
  h1('บทที่ 3 — การส่งรถ (ส่งรถรายวัน)'),
  body('การส่งรถมี 2 วิธี: สแกน QR Code บนรถ หรือค้นหาจากทะเบียน'),
  spacer(),
  h2('3.1 วิธีที่ 1 — สแกน QR Code (แนะนำ)'),
  numbered('กด "📷 สแกน QR รถ" ในหน้า Home'),
  numbered('เปิดกล้องไปที่ QR Code บนรถ'),
  numbered('ระบบจะแสดงข้อมูลรถและเมนู — กด "ส่งรถ (รายวัน)"'),
  numbered('กรอกข้อมูลลูกค้าและช่วงเวลา'),
  numbered('กด "ยืนยันการจอง"'),
  spacer(),
  h2('3.2 วิธีที่ 2 — ค้นหารถ'),
  numbered('กด "🔍 ค้นหารถ" ในหน้า Home'),
  numbered('กรอกวันที่เริ่มต้นและสิ้นสุด'),
  numbered('กดค้นหา — ระบบจะแสดงรถที่ว่างในช่วงนั้น'),
  numbered('กดรถที่ต้องการ → กด "จองรถนี้"'),
  numbered('กรอกข้อมูลและยืนยัน'),
  spacer(),
  h2('3.3 ข้อมูลที่ต้องกรอก'),
  infoTable([
    ['ข้อมูล', 'รายละเอียด'],
    ['เบอร์โทรลูกค้า *', 'กรอกก่อน — ถ้าเคยเช่ามาแล้ว ระบบจะดึงชื่อให้อัตโนมัติ'],
    ['ชื่อ - นามสกุล *', 'ชื่อเต็มของลูกค้า'],
    ['โรงแรม/ที่พัก', 'ไม่บังคับ แต่มีประโยชน์สำหรับติดต่อ'],
    ['วันเริ่ม - วันคืน *', 'วันเวลาที่ลูกค้าจะรับและคืนรถ'],
    ['ช่องทางติดต่อ', 'LINE / Facebook / โทรศัพท์ / Walk-in'],
    ['โปรโมชั่น', 'เลือกถ้ามีโค้ดส่วนลด'],
  ]),
  spacer(),
  note('⚠️ หลังจองแล้ว รถจะถูก "ล็อก" ไม่ให้คนอื่นจองซ้อน — ตรวจสอบวันให้ถูกต้องก่อนยืนยัน'),

  // ── บทที่ 4: ส่งรถรายเดือน ──
  pageBreak(),
  h1('บทที่ 4 — การส่งรถรายเดือน'),
  body('สำหรับลูกค้าที่เช่าระยะยาว ชำระรายเดือน ไม่ต้องกำหนดวันคืนชัดเจน'),
  spacer(),
  h2('4.1 วิธีส่งรถรายเดือน'),
  numbered('สแกน QR รถ หรือค้นหารถ'),
  numbered('กด "ส่งรถ (รายเดือน)"'),
  numbered('กรอกข้อมูลลูกค้า'),
  numbered('เลือกวันที่เริ่มต้น'),
  numbered('ตั้งวันชำระเงินรายเดือน (เช่น วันที่ 1 ของทุกเดือน)'),
  numbered('กรอกค่าเช่า/เดือน'),
  numbered('กดยืนยัน'),
  spacer(),
  h2('4.2 การรับชำระค่าเช่ารายเดือน'),
  body('เมื่อถึงกำหนดชำระ จะขึ้นในงานค้าง "💰 รายเดือน":'),
  numbered('กดงานค้างรายเดือน'),
  numbered('เลือกรายการที่ต้องชำระ'),
  numbered('ยืนยันการรับเงิน'),
  spacer(),
  note('💡 ระบบจะแสดงเตือนล่วงหน้าก่อนถึงกำหนดชำระ 30 วัน'),

  // ── บทที่ 5: รับรถคืน (รายวัน) ──
  pageBreak(),
  h1('บทที่ 5 — การรับรถคืน (รายวัน)'),
  body('เมื่อลูกค้านำรถมาคืน พนักงานต้องดำเนินการรับคืนในระบบ'),
  spacer(),
  h2('5.1 ขั้นตอนรับรถคืน'),
  numbered('สแกน QR Code บนรถ → กด "รับรถคืน"'),
  numbered('ตรวจสอบรายการในหัวข้อ "ตรวจสภาพรถตอนรับคืน" (แตะเพื่อ ✓ / ✗)'),
  numbered('กรอกเลขไมล์ตอนรับคืน'),
  numbered('ตั้งระดับน้ำมัน (แถบสีเขียว)'),
  numbered('ถ่ายรูปรถตอนรับคืน (ถ้ามี)'),
  numbered('กรอกค่าเสียหายเพิ่มเติม (ถ้ามี) พร้อมหมายเหตุ'),
  numbered('ระบบจะคำนวณเงินคืนให้อัตโนมัติ'),
  numbered('กด "✅ ยืนยันรับรถคืน"'),
  spacer(),
  h2('5.2 การคำนวณเงินอัตโนมัติ'),
  infoTable([
    ['รายการ', 'สูตรคำนวณ'],
    ['ค่าเช่าทั้งหมด', 'ค่าเช่า/วัน × จำนวนวัน (+ค่าล่าช้าถ้าเกินกำหนด)'],
    ['ค่าเสียหาย', 'กรอกเอง (ถ้ามี)'],
    ['เงินมัดจำ', 'ยอดที่รับไว้ตอนส่งรถ'],
    ['เงินคืนลูกค้า', 'มัดจำ - ค่าเช่า - ค่าเสียหาย'],
  ]),
  spacer(),
  note('⚠️ ถ้าคืนรถช้า ระบบจะคิดค่าเช่าเพิ่มโดยอัตโนมัติ พร้อมแสดง "เกิน X วัน"'),
  spacer(),
  h2('5.3 สิ่งที่เกิดขึ้นหลังรับคืน'),
  bullet('รูปภาพที่ส่งมาพร้อมรถจะถูกลบออกจากระบบอัตโนมัติ'),
  bullet('รถจะกลับมาสถานะ "ว่าง" ให้จองได้ทันที'),
  bullet('ประวัติการเช่ายังคงอยู่ในระบบ (ไม่ถูกลบ)'),

  // ── บทที่ 6: แจ้งรถเสีย ──
  pageBreak(),
  h1('บทที่ 6 — การแจ้งรถเสีย / ส่งซ่อม'),
  body('เมื่อพบรถที่มีปัญหา ให้แจ้งในระบบทันที เพื่อให้เจ้าของรับทราบ'),
  spacer(),
  h2('6.1 วิธีแจ้งรถเสีย'),
  numbered('กด "🔧 แจ้งรถเสีย" ในหน้า Home'),
  numbered('ค้นหาหรือสแกน QR รถที่มีปัญหา'),
  numbered('เลือกประเภทปัญหา'),
  numbered('อธิบายอาการ'),
  numbered('ถ่ายรูปความเสียหาย (แนะนำ)'),
  numbered('กดยืนยัน'),
  spacer(),
  note('⚠️ รถที่แจ้งซ่อมจะเปลี่ยนสถานะเป็น "ซ่อม" และไม่สามารถจองได้จนกว่าจะซ่อมเสร็จ'),

  // ── บทที่ 7: งานเอกสาร ──
  pageBreak(),
  h1('บทที่ 7 — งานเอกสาร'),
  body('ระบบติดตามวันหมดอายุของเอกสารรถอัตโนมัติ พนักงานต้องอัพเดทเมื่อต่ออายุ'),
  spacer(),
  h2('7.1 ประเภทเอกสารที่ระบบดูแล'),
  bullet('🛡️ พ.ร.บ. ประกันภัย — ต้องต่ออายุทุกปี'),
  bullet('💰 ภาษีประจำปี (ป้ายวงกลม) — ต้องต่ออายุทุกปี'),
  bullet('📘 สำเนาหน้าเล่มทะเบียน — ไม่มีวันหมดอายุ'),
  spacer(),
  h2('7.2 ระดับความเร่งด่วน'),
  infoTable([
    ['สีแสดง', 'ความหมาย'],
    ['🔴 แดง — หมดแล้ว', 'เอกสารหมดอายุแล้ว ห้ามส่งรถออกไป'],
    ['🟠 ส้ม — วิกฤต', 'เหลือไม่ถึง 8 วัน ต้องดำเนินการด่วน'],
    ['🟡 เหลือง — เตือน', 'เหลือ 8-30 วัน ควรเตรียมต่ออายุ'],
    ['🟢 เขียว — ปกติ', 'เอกสารยังมีอายุเกิน 30 วัน'],
  ]),
  spacer(),
  h2('7.3 วิธีอัพเดทเอกสาร'),
  numbered('กด "📄 งานเอกสาร"'),
  numbered('กดรถที่ต้องอัพเดท'),
  numbered('กด "อัพเดทเอกสาร"'),
  numbered('อัพโหลดรูปเอกสารใหม่'),
  numbered('กรอกวันหมดอายุใหม่'),
  numbered('กดบันทึก'),

  // ── บทที่ 8: รวมรถ ──
  pageBreak(),
  h1('บทที่ 8 — รวมรถ (Fleet)'),
  body('หน้ารวมรถแสดงสถานะรถทุกคันในสาขา ช่วยให้รู้ว่ามีรถว่างกี่คัน'),
  spacer(),
  h2('8.1 สีสถานะรถ'),
  infoTable([
    ['สี / ไอคอน', 'ความหมาย'],
    ['🟢 เขียว — ว่าง', 'รถพร้อมให้เช่าได้ทันที'],
    ['🔵 น้ำเงิน — กำลังเช่า', 'รถอยู่กับลูกค้า'],
    ['🔴 แดง — ซ่อม', 'รถอยู่ระหว่างซ่อมบำรุง'],
    ['⚫ เทา — เลิกใช้', 'รถที่ถูกปิดการใช้งาน'],
  ]),
  spacer(),
  h2('8.2 การใช้งาน'),
  body('กดรถใดๆ เพื่อดูเมนูดำเนินการ:'),
  bullet('ส่งรถ (รายวัน / รายเดือน) — ถ้ารถว่าง'),
  bullet('รับรถคืน — ถ้ารถถูกเช่าอยู่'),
  bullet('แจ้งซ่อม — ถ้าพบปัญหา'),
  bullet('ดูเอกสาร — ตรวจสอบวันหมดอายุ'),

  // ── บทที่ 9: ข้อควรระวัง ──
  pageBreak(),
  h1('บทที่ 9 — ข้อควรระวังและ FAQ'),
  spacer(),
  h2('9.1 ข้อควรระวัง'),
  note('❌ อย่ากดยืนยันรับรถคืนก่อนตรวจสอบสภาพรถจริง', LIGHT_YELLOW),
  spacer(),
  note('❌ อย่าส่งรถออกโดยไม่บันทึกในระบบ — จะทำให้รถแสดงสถานะว่างผิด', LIGHT_YELLOW),
  spacer(),
  note('❌ อย่าแชร์ PIN กับผู้อื่น — PIN ใช้ระบุตัวตนใน Activity Log', LIGHT_YELLOW),
  spacer(),
  h2('9.2 คำถามที่พบบ่อย'),
  spacer(),
  h3('Q: ลืม PIN ต้องทำอย่างไร?'),
  body('ติดต่อเจ้าของร้านให้รีเซ็ต PIN ใหม่ในหน้าตั้งค่า'),
  spacer(),
  h3('Q: กดยืนยันผิด จะยกเลิกได้ไหม?'),
  body('ไม่สามารถยกเลิกเองได้ ให้แจ้งเจ้าของร้านผ่านหน้า Owner เพื่อดำเนินการแก้ไข'),
  spacer(),
  h3('Q: รถแสดงว่าง แต่ลูกค้าบอกว่าเพิ่งเช่าไป?'),
  body('อาจเกิดจากการไม่บันทึกในระบบ ให้แจ้งเจ้าของร้านทันที'),
  spacer(),
  h3('Q: เอกสารรถหมดอายุ ยังส่งรถได้ไหม?'),
  body('ไม่ควรส่งรถที่ พ.ร.บ. หรือภาษีหมดอายุ — แจ้งเจ้าของร้านให้ต่ออายุก่อน'),
  spacer(),
  spacer(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400 },
    children: [new TextRun({ text: '— จบคู่มือพนักงาน —', size: 24, font: 'Sarabun', color: GRAY, italics: true })],
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
        run: { size: 28, bold: true, font: 'Sarabun', color: BLUE },
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
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1D4ED8', space: 1 } },
      children: [new TextRun({ text: 'Kuma Rental — คู่มือพนักงาน (Staff)', size: 18, font: 'Sarabun', color: GRAY })],
    })] }) },
    footers: { default: new Footer({ children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: 'หน้า ', size: 18, font: 'Sarabun', color: GRAY }), new TextRun({ children: [PageNumber.CURRENT], size: 18, font: 'Sarabun', color: GRAY })],
    })] }) },
    children: content,
  }],
})

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('คู่มือ-Staff-Kuma-Rental.docx', buf)
  console.log('✅ สร้างไฟล์ คู่มือ-Staff-Kuma-Rental.docx เรียบร้อยแล้ว')
}).catch(err => {
  console.error('❌ Error:', err.message)
})
