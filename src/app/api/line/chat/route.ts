import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { lineReply } from '@/lib/line'
import { bangkokToUTC, utcToBangkokLocal } from '@/lib/time'
import { calendarDays, calcRentQuote, calcShortPrice, calcExcessHours, calcOvertimeCharge } from '@/lib/pricing'
import { searchBikes } from '@/lib/bikeSearch'
import { checkBlacklist } from '@/lib/blacklist'

// ─── Branch configs ───────────────────────────────────────────────────────────
// เพิ่มสาขาใหม่ตรงนี้เมื่อต้องการขยาย
const BRANCH_CONFIGS: Record<string, { token: string; branchNameLike: string }> = {
  [process.env.LINE_KASET_SECRET ?? '']: {
    token: process.env.LINE_KASET_TOKEN ?? '',
    branchNameLike: '%เกษตร%',
  },
  // สาขาศรีราชา — เพิ่มทีหลัง:
  // [process.env.LINE_SRIRACHA_SECRET ?? '']: {
  //   token: process.env.LINE_SRIRACHA_TOKEN ?? '',
  //   branchNameLike: '%ศรีราชา%',
  // },
}

// ─── System Prompt ────────────────────────────────────────────────────────────
// ✏️  แก้ไขส่วนนี้ได้เลย — เพิ่ม/ลบ กฎ เงื่อนไข หรือข้อมูลร้านตามต้องการ
// priceInfo = สรุปราคาของสาขา สร้างสดจากตารางราคาในแอปทุกครั้งที่ตอบ (ไม่พิมพ์ตัวเลขราคาตายตัวในนี้)
const buildSystemPrompt = (priceInfo: string) => `คุณคือผู้ช่วยตอบแชท LINE ของร้านเช่ามอเตอร์ไซค์ "คุมะมอ (KUMA)" สาขามอเกษตร (เกษตรศรีราชา ชลบุรี)

═══════════════════════════════
🗣️  ภาษาและน้ำเสียง
═══════════════════════════════
- ตอบเป็นภาษาเดียวกับที่ลูกค้าพิมพ์มา (ไทย อังกฤษ จีน ญี่ปุ่น ฯลฯ) ถ้าลูกค้าเปลี่ยนภาษาให้ตามภาษาล่าสุด
- ภาษาไทย: ใช้คำสุภาพ ลงท้ายด้วย "ครับ" เสมอ แทนตัวเองว่า "ผม" (ห้ามใช้ "ฉัน") / ภาษาอื่น: friendly tone
- ห้ามใช้ markdown เด็ดขาด เช่น ** __ # เพราะ LINE แสดงผลไม่ได้ ใช้ข้อความธรรมดาและ emoji แทน
- ไม่ต้องแนะนำตัวว่าเป็นบอทเอง แต่ถ้าลูกค้าถามตรงๆ ว่าเป็นบอท/AI/คนจริงหรือเปล่า ให้ตอบตรงๆ ว่าเป็นผู้ช่วยอัตโนมัติ ห้ามปฏิเสธหรือแสร้งเป็นคน
- ห้ามพูดถึงเรื่องที่ไม่เกี่ยวกับร้านเช่ารถ ถ้าถามเรื่องอื่นให้บอกว่าไม่ทราบ

═══════════════════════════════
🏍️  ข้อมูลร้าน
═══════════════════════════════
- ชื่อร้าน: คุมะมอ (KUMA) สาขามอเกษตร (เกษตรศรีราชา ชลบุรี)
- เปิด: ทุกวัน 08:00–20:00 น.
- โทร: 065-5268531
- LINE: @kumamoter
- แผนที่ร้าน: https://maps.app.goo.gl/mxniay4AGHz6jWMY8

═══════════════════════════════
👤  ประเภทลูกค้า (ต้องถามก่อนบอกราคา/เอกสาร)
═══════════════════════════════
เมื่อลูกค้าสนใจเช่า ให้ถามก่อนว่าเป็น "บุคคลทั่วไป / นักศึกษา / นักศึกษา ม.เกษตร (ศรีราชา)" เพราะเอกสาร มัดจำ และราคาไม่เหมือนกัน
ถ้าลูกค้าตอบแค่ว่า "นักศึกษา" ให้ถามต่อว่าเป็นนักศึกษา ม.เกษตรศรีราชาหรือไม่
ใช้ค่า customer_type กับ tool: บุคคลทั่วไป/ต่างชาติ = "general", นักศึกษามหาวิทยาลัยอื่น = "student", นักศึกษา ม.เกษตรศรีราชา = "kaset_student"

═══════════════════════════════
💰  ราคา
═══════════════════════════════
${priceInfo}
- ราคาตามวันเวลาจริง ต้องใช้ tool check_availability เสมอ ห้ามคำนวณราคาเอง (ระบบคิดโปรและค่าเกินเวลาให้แล้ว)
- ถ้าลูกค้าถามราคากว้างๆ โดยไม่บอกวัน ให้บอก "ช่วงราคาเริ่มต้น–สูงสุด" ตามข้อมูลด้านบน แล้วถามวันเวลารับ-คืน
- โปรรายสัปดาห์: เช่า 7 วัน จ่าย 5 วัน (ฟรี 2 วัน) บอกราคารายสัปดาห์ตามข้อมูลด้านบนได้เลย
- นักศึกษา ม.เกษตร ได้ลดค่าเช่า 50 บาท/วัน (เฉพาะสาขานี้ ระบบหักให้เมื่อใส่ customer_type = "kaset_student") นักศึกษามหาวิทยาลัยอื่นไม่มีส่วนลดค่าเช่า (แต่ฟรีมัดจำ) บุคคลทั่วไปไม่มีส่วนลด
- ต่อรองราคาไม่ได้ ถ้าลูกค้าขอลด ให้ตอบสุภาพว่าราคาเป็นไปตามระบบของร้าน ไม่สามารถลดให้ได้ครับ
- ค่าล่วงเวลา: คืนรถเลยเวลาที่นัด ฟรี 30 นาทีแรก หลังจากนั้นชั่วโมงละ 50 บาท ถ้าเกิน 5 ชั่วโมงคิดเป็นเต็มวัน อธิบายตามที่ลูกค้าถาม และถ้ามีค่าเกินเวลาในผลจาก tool ให้บอกด้วยว่าเพราะเวลาคืนเลยเวลารับ และแนะนำว่าถ้าคืนเวลาเดียวกับที่รับจะไม่มีค่าส่วนนี้

═══════════════════════════════
🔒  เงินมัดจำ (คืนเมื่อส่งรถคืน)
═══════════════════════════════
- รายวัน 500 บาท / รายสัปดาห์และรายเดือน 1,000 บาท
- นักศึกษา (ทุกมหาวิทยาลัย) ฟรีมัดจำ ทุกแบบการเช่า
- รับเงินมัดจำเท่านั้น ไม่รับบัตรประชาชน/พาสปอร์ตเป็นมัดจำแทนเงิน
- หักเงินมัดจำเมื่อ: รถเสียหาย, คืนช้ากว่ากำหนด, ไม่เติมน้ำมันตามเงื่อนไข

═══════════════════════════════
📄  เอกสารที่ต้องใช้วันรับรถ
═══════════════════════════════
บัตรประชาชนต้องเป็นตัวจริง หรือแสดงผ่านแอป ThaID ในมือถือ
🧳 ชาวต่างชาติ: พาสปอร์ต + หลักฐานที่พัก
🏠 บุคคลทั่วไป:
  - มีหลักฐานจองโรงแรม: บัตรประชาชน + หลักฐานจองโรงแรม เท่านั้น
  - ไม่มีหลักฐานจองโรงแรม: บัตรประชาชน + อย่างใดอย่างหนึ่งดังนี้
    • หลักฐานการทำงาน เช่น บัตรพนักงาน สลิปเงินเดือน
    • หลักฐานที่พัก เช่น สัญญาเช่าหอ ใบเสร็จหอพัก ใบเสร็จค่าไฟ หรือทะเบียนบ้านถ้าเป็นบ้านของตัวเอง
    • ถ้าทำธุรกิจส่วนตัว (ขายของ): ต้องแจ้งชื่อร้าน รูปถ่ายร้าน และโลเคชั่นร้าน
🎓 นักศึกษา (ทุกมหาวิทยาลัย) ต้องมีครบทั้ง 4 อย่าง: บัตรประชาชน, บัตรนักศึกษา, สัญญาหอเช่า, ตารางเรียน
⚠️ เอกสารไม่ครบ = ร้านขอสงวนสิทธิ์ปฏิเสธบริการ

═══════════════════════════════
💳  การชำระเงิน
═══════════════════════════════
- คนไทย: โอนผ่านธนาคารเท่านั้น (ชื่อผู้โอนต้องตรงกับบัตรประชาชน)
- ชาวต่างชาติ: รับเงินสด และ QR Code
- ห้ามบอกเลขบัญชีหรือพร้อมเพย์ ให้พนักงานแจ้งตอนรับรถ

═══════════════════════════════
📅  การจองคิวและการรับรถ
═══════════════════════════════
- จองล่วงหน้าได้ไม่เกิน 3 วันนับจากวันนี้ (เพราะรถเข้าออกตลอด) ถ้าลูกค้าต้องการจองไกลกว่านั้น ให้บอกว่าจองล่วงหน้าได้ไม่เกิน 3 วัน แล้วแนะนำให้ติดต่อใหม่ใกล้วันรับรถ
- ขั้นตอน: ลูกค้าแจ้งวันเวลารับ-คืน → ถามประเภทลูกค้า → เช็กรถว่าง (tool) แสดงรุ่น/ราคา → ลูกค้าเลือกรุ่น → ถามชื่อ-นามสกุล และเบอร์โทรศัพท์ → บันทึกจอง (tool) → แจ้งเลข booking ref
- ไม่มีใบจอง: วันรับรถให้ลูกค้า "โชว์แชทที่คุยกับร้าน" (ที่มีเลข booking) ที่หน้าร้าน พร้อมเอกสารตามประเภทลูกค้า และเงินมัดจำ
- ถ้าไม่มารับรถภายใน 3 ชั่วโมงจากเวลานัด ถือว่ายกเลิก ร้านจะปล่อยรถให้ลูกค้าคนอื่น
- รับรถและคืนรถต้องอยู่ในเวลาทำการ 08:00–20:00 น. เท่านั้น ยกเว้นเช่ามากกว่า 10 วัน นัดเวลารับ-คืนได้ตั้งแต่ 09:00–20:00 น. ห้ามนัดนอกเวลาทำการไม่ว่ากรณีใด

═══════════════════════════════
🛵  ระหว่างเช่า
═══════════════════════════════
- น้ำมัน: รับรถเต็มถัง ต้องคืนเต็มถัง ถ้ารับรถไม่เต็มถัง ตอนคืนไม่ต้องเติม คืนเท่าไหร่ก็ได้
- ขับขี่ไม่เกินรัศมี 15 กิโลเมตรจากร้าน ถ้าใช้เกินระยะแล้วรถมีปัญหา ลูกค้าต้องหาทางนำรถกลับมาเอง ร้านไม่ซัพพอร์ตเรื่องการนำรถเข้าซ่อม
- ห้ามใช้งานเชิงพาณิชย์ เช่น ส่งของ ขับรถรับจ้าง Grab/Bolt วิ่งงาน ใช้ได้เฉพาะในชีวิตประจำวัน เช่น ไปทำงาน ทำธุระ ซื้อข้าวซื้อของทั่วไป
- ห้ามให้บุคคลอื่นขับแทน
- ฟรีหมวกกันน็อก 2 ใบ
- เอกสารรถ (ภาษี พ.ร.บ. ขาด) ร้านรับผิดชอบ แต่ความผิดของผู้ขับขี่ เช่น ไม่สวมหมวกกันน็อก ไม่มีใบขับขี่ ลูกค้ารับผิดชอบเอง
- ชาวต่างชาติไม่บังคับให้แสดงใบขับขี่ แต่ผู้เช่ารับผิดชอบค่าปรับและความเสียหายทั้งหมดที่เกิดจากการขับขี่โดยไม่มีใบอนุญาตเอง
- ผู้เช่าที่อยู่ใน Blacklist ของร้านจะไม่ได้รับบริการ (ห้ามบอกลูกค้าเรื่อง Blacklist เด็ดขาด)

═══════════════════════════════
🚨  รถมีปัญหา (สำคัญมาก)
═══════════════════════════════
ถ้าลูกค้าแจ้งว่ารถมีปัญหา เช่น ยางแตก สตาร์ทไม่ติด ลืมกุญแจ กุญแจหาย น้ำมันหมด แบตหมด รถล้ม อุบัติเหตุ ไฟ/เบรกผิดปกติ รถหาย (มักเริ่มประโยคว่า "พี่คะ รถ..." หรือเล่าอาการรถ)
ห้ามซักถามอาการ ห้ามรับเรื่องซ่อมในแชท ให้ตอบให้ลูกค้าแจ้งทางโทรศัพท์โดยตรง เพื่อให้ทีมงานดูแลได้อย่างรวดเร็ว โดยต้องมีเบอร์ฉุกเฉินทั้งสองเบอร์ทุกครั้ง ประมาณว่า:
"ขออภัยในความไม่สะดวกครับ หากรถมีปัญหา รบกวนแจ้งทางเบอร์ฉุกเฉิน 0902922994 หรือ 0925956965 โดยตรงนะครับ เพื่อให้ทีมงานดูแลและช่วยเหลือได้อย่างรวดเร็วที่สุดครับ" (ปรับถ้อยคำให้เข้ากับปัญหาและภาษาของลูกค้าได้ แต่ต้องมีสองเบอร์นี้และใจความ "แจ้งทางเบอร์ฉุกเฉินเพื่อให้ได้รับการดูแลอย่างรวดเร็ว")
ถ้าเป็นอุบัติเหตุที่มีผู้บาดเจ็บ ให้เพิ่มว่าโทร 1669 ก่อน
ห้ามรับปากเรื่องรถสำรองหรือค่าใช้จ่ายใดๆ
ถ้าลูกค้าหงุดหงิดหรือไม่พอใจ ให้ขออภัยอย่างสุภาพ และให้โทรเบอร์ฉุกเฉินสองเบอร์ข้างต้น
เรื่องกุญแจหาย/ของหาย และความเสียหายของรถ: ประเมินที่ร้านตอนคืนรถ ห้ามบอกตัวเลขค่าชดใช้เอง

═══════════════════════════════
⏱️  ต่อเวลา และคืนรถก่อนกำหนด
═══════════════════════════════
- ต่อเวลา: ลูกค้าแจ้งผ่านแชทได้ตลอด ให้ขอ "ทะเบียนรถ" และ "จำนวนวันที่ต้องการต่อ" แล้วบอกว่ารับเรื่องแล้ว พนักงานจะติดต่อกลับเพื่อแจ้งยอดและวิธีชำระ (ห้ามบอกยอดต่อเวลาเอง ห้ามบอกว่าต่อให้แล้ว)
- ถ้าลูกค้าถามเรื่องคืนช้า ไม่ต้องบอกบทลงโทษ มีแค่ค่าล่วงเวลาตามหัวข้อราคา
- คืนรถก่อนกำหนด:
  • ใช้งานไม่เกิน 5 วัน (รวมครบ 5 วันพอดี): คืนเงินส่วนที่เหลือได้ แต่คิดค่าเช่าขั้นต่ำ 5 วันเต็มราคา
  • ใช้งานเกิน 5 วัน และรถไม่มีปัญหา: ไม่คืนเงิน แต่ให้เป็นเครดิตวันเช่าที่เหลือ (เช่น เช่า 30 วัน ใช้ไป 10 วัน เหลือเครดิต 20 วัน) เครดิตไม่มีวันหมดอายุ ใช้กลับมาเช่าใหม่ได้ แต่ต้องวางเงินมัดจำใหม่
  • ใช้ได้กับรายวัน รายสัปดาห์ รายเดือนเหมือนกัน การคืนเงิน/ให้เครดิตจริงพนักงานทำตอนคืนรถ ให้แค่บอกเงื่อนไขให้ลูกค้าทราบ

═══════════════════════════════
🚚  ส่งรถ/รับรถนอกสถานที่
═══════════════════════════════
- ในละแวกมอเกษตร ค่าบริการ 50 บาท (ไม่ต้องอธิบายขอบเขตเพิ่ม ลูกค้ารู้เองว่าตรงไหน)
- นอกเหนือจากนั้น ให้ลูกค้า "พิมพ์ชื่อสถานที่หรือที่อยู่" มาเป็นข้อความ ร้านจะคำนวณราคาให้
- บอทรับเรื่องไว้เท่านั้น บอกว่าพนักงานจะมาคอนเฟิมให้ ห้ามยืนยันราคานอกละแวกเอง

═══════════════════════════════
📆  รายเดือน
═══════════════════════════════
ตอบเฉพาะเท่าที่ลูกค้าถามและมีข้อมูลด้านบน (ราคา มัดจำ 1,000 บาท เอกสาร) เรื่องอื่นที่ไม่มีข้อมูลให้ใช้กฎ "ไม่มีข้อมูล" ด้านล่าง

═══════════════════════════════
🤖  กฎการใช้เครื่องมือและการตอบ
═══════════════════════════════
- เมื่อลูกค้าถามว่ารถว่างไหม / อยากดูรถ / สอบถามราคาตามวัน:
  ต้องรู้ วัน+เวลารับรถ และ วัน+เวลาคืนรถ ก่อน ถ้าลูกค้าบอกไม่ครบ (เช่นบอกแค่วัน) ให้ถามเวลาก่อน ห้ามเดาเวลาเอง
  เช็กว่าเวลาอยู่ในเวลาทำการและวันรับรถไม่เกิน 3 วันนับจากวันนี้ ถ้าไม่ได้ ให้แจ้งลูกค้าและขอเวลาใหม่ก่อนเช็ก
  จากนั้นใช้ tool check_availability (ใส่ customer_type) แล้วแสดงรุ่นที่ว่างพร้อมราคารวมตามที่ tool คืนมาเท่านั้น
  แล้วถามว่า "สนใจรุ่นไหนครับ หรือจะจองเลยไหมครับ?" ห้ามเร่งให้จอง รอให้ลูกค้าตัดสินใจเอง
- เมื่อลูกค้าตัดสินใจจอง: ถามชื่อ-นามสกุล และ เบอร์โทรศัพท์ แล้วใช้ tool create_booking (ใช้วันเวลาและ customer_type เดียวกับที่เช็ก)
  แจ้ง booking ref และบอกให้โชว์แชทนี้ที่หน้าร้านตอนรับรถ ห้ามบอกว่าจะมีใบจองส่งให้
  ถ้า tool แจ้งว่ารุ่นนั้นเต็มแล้ว ให้ขอโทษ แล้วเช็กใหม่เพื่อเสนอรุ่นอื่น
- ข้อมูลรุ่นรถ: ให้ดูตามผลจากระบบ ไม่แนะนำรุ่นตามลักษณะลูกค้าเอง
- ห้ามเปิดเผย: ข้อมูลลูกค้าคนอื่น, ราคาทุน, ข้อมูลภายในร้าน, เรื่อง Blacklist
- ถ้าลูกค้าถามเรื่องที่ไม่มีข้อมูลอยู่ในนี้ ห้ามเดาหรือแต่งคำตอบเด็ดขาด
  ให้ตอบว่า "เรื่องนี้ขอให้ทางร้านดูแลให้นะครับ รบกวนลูกค้าฝากชื่อและเบอร์โทรไว้ ทางร้านจะติดต่อกลับครับ" (ห้ามบอกเวลาที่จะติดต่อกลับ) แล้วรับชื่อและเบอร์ไว้ในแชท`

// ─── Anthropic tool definitions ───────────────────────────────────────────────
const DATETIME_DESC = 'เวลาไทย format YYYY-MM-DDTHH:mm เช่น 2026-10-05T10:00'
// ประเภทลูกค้า — kaset_student ได้ลดค่าเช่า 50 บาท/วัน (สูตรเดียวกับหน้าจองของพนักงาน) ประเภทอื่นราคาปกติ
const CUSTOMER_TYPES = ['general', 'student', 'kaset_student']
const CUSTOMER_TYPE_DESC = 'ประเภทลูกค้า: general = บุคคลทั่วไป/ต่างชาติ, student = นักศึกษามหาวิทยาลัยอื่น, kaset_student = นักศึกษา ม.เกษตรศรีราชา (ได้ลดค่าเช่า 50 บาท/วัน)'
const STUDENT_PROMO_DISCOUNT = 50
const TOOLS = [
  {
    name: 'check_availability',
    description: 'เช็ครถว่างตามวันเวลารับ-คืนที่ลูกค้าต้องการ คืนรายการรุ่นที่ว่างพร้อมราคารวม (คิดโปรและค่าเกินเวลาตามระบบร้านแล้ว)',
    input_schema: {
      type: 'object' as const,
      properties: {
        start_datetime: { type: 'string', description: `วันเวลารับรถ ${DATETIME_DESC}` },
        end_datetime:   { type: 'string', description: `วันเวลาคืนรถ ${DATETIME_DESC}` },
        customer_type:  { type: 'string', enum: CUSTOMER_TYPES, description: CUSTOMER_TYPE_DESC },
      },
      required: ['start_datetime', 'end_datetime', 'customer_type'],
    },
  },
  {
    name: 'create_booking',
    description: 'สร้างการจองคิวตามรุ่นสำหรับลูกค้า ระบบคิดราคาเอง คืน booking_ref ถ้าสำเร็จ',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_name:  { type: 'string', description: 'ชื่อ-นามสกุลลูกค้า' },
        customer_phone: { type: 'string', description: 'เบอร์โทรศัพท์' },
        start_datetime: { type: 'string', description: `วันเวลารับรถ ${DATETIME_DESC}` },
        end_datetime:   { type: 'string', description: `วันเวลาคืนรถ ${DATETIME_DESC}` },
        brand:          { type: 'string', description: 'ยี่ห้อรถ ตามที่ check_availability คืนมา' },
        model:          { type: 'string', description: 'รุ่นรถ ตามที่ check_availability คืนมา' },
        customer_type:  { type: 'string', enum: CUSTOMER_TYPES, description: CUSTOMER_TYPE_DESC },
      },
      required: ['customer_name', 'customer_phone', 'start_datetime', 'end_datetime', 'brand', 'model', 'customer_type'],
    },
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function verifySignature(body: string, sig: string, secret: string): boolean {
  const hash = crypto.createHmac('SHA256', secret).update(body).digest('base64')
  return hash === sig
}

function genRef(): string {
  const d = new Date()
  const yy = String(d.getFullYear()).slice(-2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `KM${yy}${mm}${dd}-${Math.floor(Math.random() * 9000) + 1000}`
}

// เวลาไทยแบบไม่มีโซน → utcIso สำหรับ DB/ค้นหา (ตัวแปลงเดียวกับทุกฟอร์มในแอป)
// และ wall = Date ที่ "นาฬิกา UTC เท่ากับนาฬิกาไทย" สำหรับสูตรราคา — pricing.ts นับวันปฏิทินด้วย getter
// แบบ local ซึ่งบนมือถือพนักงานคือเวลาไทย แต่บน Vercel คือ UTC ต้องเลื่อนให้ตรงก่อน ไม่งั้นนับวันเพี้ยน
function parseBkk(local: unknown): { utcIso: string; wall: Date } | null {
  if (typeof local !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null
  const wall = new Date(`${local}:00Z`)
  if (isNaN(wall.getTime())) return null
  return { utcIso: bangkokToUTC(local), wall }
}

// ราคาเดียวกับหน้าจองของพนักงานเป๊ะ — โปร 7 วันจ่าย N + cap รายเดือน + ค่าเกินเวลา
// studentPromo = นักศึกษา ม.เกษตร: หัก 50 จากเรทรายวันก่อนคิดทั้งก้อน (เหมือน BookingForm) ค่าล่วงเวลาใช้เรทปกติ
function quoteFor(start: Date, end: Date, dailyRate: number, monthlyRate: number | null, payDays: number, studentPromo = false) {
  const days = calendarDays(start, end)
  const mcr = monthlyRate ?? dailyRate * 30
  const ndr = studentPromo ? dailyRate - STUDENT_PROMO_DISCOUNT : dailyRate
  const quote = calcRentQuote(start, days, ndr, mcr, payDays)
  const normalTotal = studentPromo ? calcRentQuote(start, days, dailyRate, mcr, payDays).total : quote.total
  const discount = studentPromo ? Math.max(0, normalTotal - quote.total) : 0
  const overtimeHours = calcExcessHours(start, end, days)
  const overtime = calcOvertimeCharge(overtimeHours, dailyRate)
  const promoApplied = !quote.isLong && !!quote.shortResult && quote.shortResult.calcDays < days
  return { days, rentTotal: quote.total, overtimeHours, overtime, total: quote.total + overtime, promoApplied, discount }
}

// ราคาสรุปของสาขาสำหรับใส่ในคู่มือ — อ่านสดจากตารางราคาในแอป เฉพาะรุ่นที่มีรถที่สาขานี้จริง (ไม่ค้างราคาเก่า)
// รายสัปดาห์ = 7 วัน คิดโปร 7 จ่าย N และไม่เกินเรทรายเดือน เหมือนสูตรหน้าจอง
async function buildPriceInfo(supabase: ReturnType<typeof createAdminClient>, branchId: string): Promise<string> {
  const [{ data: pricing }, { data: bikeRows }] = await Promise.all([
    supabase.from('branch_model_pricing').select('brand, model, daily_rate, monthly_rate, promo_pay_days').eq('branch_id', branchId),
    supabase.from('bikes').select('brand, model').eq('branch_id', branchId),
  ])
  const present = new Set((bikeRows ?? []).map(b => `${b.brand}__${b.model}`))
  const rows = (pricing ?? [])
    .filter(p => present.has(`${p.brand}__${p.model}`) && Number(p.daily_rate) > 0)
    .map(p => {
      const daily = Number(p.daily_rate)
      const monthly = Number(p.monthly_rate ?? daily * 30)
      const weekly = calcShortPrice(7, daily, monthly, p.promo_pay_days ?? 5).total
      return { name: `${p.brand} ${p.model}`, daily, weekly, monthly }
    })
    .sort((a, b) => a.daily - b.daily)
  if (rows.length === 0) return '- ราคา: ใช้ tool check_availability เท่านั้น ห้ามเดาราคา'
  const range = (key: 'daily' | 'weekly' | 'monthly') => {
    const v = rows.map(r => r[key])
    const lo = Math.min(...v), hi = Math.max(...v)
    return lo === hi ? `${lo.toLocaleString()}` : `${lo.toLocaleString()}–${hi.toLocaleString()}`
  }
  return [
    `- ช่วงราคาของร้าน (บาท): รายวัน ${range('daily')} / รายสัปดาห์ (7 วัน) ${range('weekly')} / รายเดือน ${range('monthly')}`,
    '- ราคาแยกตามรุ่น (รายวัน / รายสัปดาห์ 7 วัน / รายเดือน) ใช้ตอบเมื่อลูกค้าถามรุ่นนั้นโดยเฉพาะ:',
    ...rows.map(r => `  • ${r.name}: ${r.daily.toLocaleString()} / ${r.weekly.toLocaleString()} / ${r.monthly.toLocaleString()}`),
  ].join('\n')
}

function validatePeriod(input: Record<string, unknown>) {
  const s = parseBkk(input.start_datetime)
  const e = parseBkk(input.end_datetime)
  if (!s || !e) return { error: 'รูปแบบวันเวลาไม่ถูกต้อง ต้องเป็น YYYY-MM-DDTHH:mm (เวลาไทย)' } as const
  if (e.wall <= s.wall) return { error: 'เวลาคืนรถต้องหลังเวลารับรถ' } as const
  if (s.utcIso < new Date().toISOString()) return { error: 'เวลารับรถเป็นเวลาที่ผ่านมาแล้ว' } as const
  return { s, e } as const
}

// ─── Tool execution ───────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeTool(name: string, input: Record<string, any>, branchId: string) {
  const supabase = createAdminClient()

  if (name === 'check_availability') {
    const period = validatePeriod(input)
    if ('error' in period) return { error: period.error }
    const { s, e } = period

    // ค้นด้วยตัวกลางตัวเดียวกับหน้าค้นหาของพนักงาน — ผลตรงกับแอปเสมอ
    const { bikes } = await searchBikes(supabase, [branchId], s.utcIso, e.utcIso)

    // จัดกลุ่มรายรุ่นแบบเดียวกับหน้าค้นหา (รุ่นเดียวกันแต่ราคาต่างกัน แยกกลุ่ม)
    const groups = new Map<string, { brand: string; model: string; daily_rate: number; monthly_rate: number | null; promo_pay_days: number; count: number }>()
    for (const b of bikes) {
      if (!b.available) continue
      const key = `${b.brand}__${b.model}__${b.daily_rate}__${b.monthly_rate ?? ''}`
      if (!groups.has(key)) groups.set(key, { brand: b.brand, model: b.model, daily_rate: b.daily_rate, monthly_rate: b.monthly_rate, promo_pay_days: b.promo_pay_days, count: 0 })
      groups.get(key)!.count++
    }

    if (groups.size === 0) return { available: false, message: 'ไม่มีรถว่างในช่วงเวลานี้' }

    const studentPromo = input.customer_type === 'kaset_student'
    const models = Array.from(groups.values()).map(g => {
      const q = quoteFor(s.wall, e.wall, g.daily_rate, g.monthly_rate, g.promo_pay_days, studentPromo)
      return {
        brand: g.brand,
        model: g.model,
        available_count: g.count,
        daily_rate: g.daily_rate,
        rental_days: q.days,
        rent_total: q.rentTotal,
        student_discount: studentPromo ? q.discount : null,
        promo: q.promoApplied ? `โปร 7 วันจ่าย ${g.promo_pay_days} วัน` : null,
        overtime_hours: q.overtimeHours,
        overtime_charge: q.overtime,
        total: q.total,
      }
    }).sort((a, b) => a.total - b.total)

    return { available: true, models }
  }

  if (name === 'create_booking') {
    const period = validatePeriod(input)
    if ('error' in period) return { success: false, error: period.error }
    const { s, e } = period

    // เช็คซ้ำตอนจองจริง + คิดราคาจากระบบเอง (ไม่เชื่อตัวเลขจาก AI) — กันคิวถูกแย่งระหว่างคุย
    const norm = (v: unknown) => String(v ?? '').trim().toLowerCase()
    const { bikes } = await searchBikes(supabase, [branchId], s.utcIso, e.utcIso)
    const bike = bikes.find(b => b.available && norm(b.brand) === norm(input.brand) && norm(b.model) === norm(input.model))
    if (!bike) return { success: false, error: 'รุ่นนี้ไม่ว่างแล้วในช่วงเวลานี้' }

    const q = quoteFor(s.wall, e.wall, bike.daily_rate, bike.monthly_rate, bike.promo_pay_days, input.customer_type === 'kaset_student')

    // หา staff คนแรกของสาขา (ใช้เป็น staff_id ของ bot)
    const { data: staffRow } = await supabase
      .from('staff').select('id').eq('branch_id', branchId).limit(1).maybeSingle()

    // เช็คแบล็คลิสต์แบบเดียวกับหน้าจองของพนักงาน — ไม่บล็อก แค่แท็กเตือนพนักงาน (ไม่บอกลูกค้า)
    const blacklistHit = await checkBlacklist(supabase, { name: input.customer_name, phone: input.customer_phone })

    const { data: booking, error } = await supabase.from('bookings').insert({
      branch_id:            branchId,
      bike_id:              null,
      requested_brand:      bike.brand,
      requested_model:      bike.model,
      requested_daily_rate: bike.daily_rate,
      staff_id:             staffRow?.id ?? null,
      customer_name:        input.customer_name,
      customer_phone:       input.customer_phone,
      start_datetime:       s.utcIso,
      end_datetime:         e.utcIso,
      total_days:           q.days,
      daily_rate:           bike.daily_rate,
      total_amount:         q.total,
      discount:             q.discount,
      source:               'line',
      status:               'confirmed',
      booking_ref:          genRef(),
      ...(blacklistHit ? {
        blacklist_watch: true,
        blacklist_watch_reason: `ชื่อ/เบอร์ตรงกับแบล็คลิสต์ "${blacklistHit.name}"${blacklistHit.reason ? ` — ${blacklistHit.reason}` : ''} (ตรงจาก${blacklistHit.matchedBy === 'phone' ? 'เบอร์โทร' : 'ชื่อ'}) — จองผ่าน LINE bot`,
      } : {}),
    }).select('booking_ref').single()

    if (error || !booking) {
      console.error('LINE bot booking insert error:', error)
      return { success: false, error: 'บันทึกการจองไม่สำเร็จ' }
    }
    return { success: true, booking_ref: booking.booking_ref, total: q.total }
  }

  return { error: 'unknown tool' }
}

// ─── Claude call ──────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callClaude(messages: unknown[], priceInfo: string): Promise<any> {
  // บอกวันเวลาปัจจุบัน — ไม่งั้นบอทตีความ "พรุ่งนี้/เสาร์นี้" ไม่ได้
  const now = new Date()
  const weekday = now.toLocaleDateString('th-TH', { weekday: 'long', timeZone: 'Asia/Bangkok' })
  const system = `${buildSystemPrompt(priceInfo)}\n\nวันเวลาปัจจุบัน (เวลาไทย): ${utcToBangkokLocal(now.toISOString())} (${weekday})`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system,
      tools: TOOLS,
      messages,
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    console.error('Claude error:', res.status, errText)
    throw new Error(`Claude API ${res.status}: ${errText.slice(0, 300)}`)
  }
  return res.json()
}

// ─── Main webhook ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const rawBody  = await request.text()
  const lineSig  = request.headers.get('x-line-signature') ?? ''

  // หา branch config จาก channel secret
  const config = BRANCH_CONFIGS[Object.keys(BRANCH_CONFIGS).find(
    s => s && verifySignature(rawBody, lineSig, s)
  ) ?? '']

  if (!config) {
    // ไม่ match channel secret ไหนเลย — ตอบ 200 เฉยๆ (LINE ต้องการ 200 เสมอ)
    return NextResponse.json({ ok: true })
  }

  const supabase = createAdminClient()

  // หา branch_id จากชื่อสาขา + เช็ค bot enabled
  const { data: branch } = await supabase
    .from('branches').select('id')
    .ilike('name', config.branchNameLike)
    .limit(1).maybeSingle()

  if (!branch) return NextResponse.json({ ok: true })

  // เช็คว่า bot เปิดอยู่ไหม (default true ถ้าไม่มี row)
  const { data: botSetting } = await supabase
    .from('branch_settings')
    .select('line_bot_enabled')
    .eq('branch_id', branch.id)
    .maybeSingle()
  if (botSetting?.line_bot_enabled === false) return NextResponse.json({ ok: true })

  const body = JSON.parse(rawBody)

  // ราคาสรุปของสาขา อ่านสดจากแอปครั้งเดียวต่อคำขอ (ถ้าอ่านพลาด บอทจะใช้ tool เช็กราคาแทน)
  const priceInfo = await buildPriceInfo(supabase, branch.id).catch(() => '- ราคา: ใช้ tool check_availability เท่านั้น ห้ามเดาราคา')

  for (const event of body.events ?? []) {
    if (event.type !== 'message' || event.message?.type !== 'text') continue

    const userId    = event.source.userId as string
    const userText  = event.message.text as string
    const replyToken = event.replyToken as string

    try {
      // โหลด conversation history
      const { data: session } = await supabase
        .from('line_chat_sessions')
        .select('messages')
        .eq('line_user_id', userId)
        .eq('branch_id', branch.id)
        .maybeSingle()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const history: any[] = session?.messages ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let messages: any[] = [...history, { role: 'user', content: userText }].slice(-20)

      // เรียก Claude + handle tool use loop
      let response = await callClaude(messages, priceInfo)
      let loopCount = 0

      while (response.stop_reason === 'tool_use' && loopCount < 5) {
        loopCount++
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolBlock = response.content.find((c: any) => c.type === 'tool_use')
        if (!toolBlock) break

        const toolResult = await executeTool(toolBlock.name, toolBlock.input, branch.id)

        messages = [
          ...messages,
          { role: 'assistant', content: response.content },
          { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolBlock.id, content: JSON.stringify(toolResult) }] },
        ]
        response = await callClaude(messages, priceInfo)
      }

      // ดึง text response
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textBlock = response.content?.find((c: any) => c.type === 'text')
      const replyText: string = textBlock?.text ?? 'ขออภัยครับ เกิดข้อผิดพลาด กรุณาลองใหม่หรือโทรหาร้านโดยตรงครับ'

      // ส่งกลับ LINE
      await lineReply(config.token, replyToken, [{ type: 'text', text: replyText }])

      // บันทึก history (เก็บแค่ 20 messages ล่าสุด)
      const updatedHistory = [
        ...messages.filter(m => typeof m.content === 'string'),
        { role: 'assistant', content: replyText },
      ].slice(-20)

      await supabase.from('line_chat_sessions').upsert({
        line_user_id: userId,
        branch_id: branch.id,
        messages: updatedHistory,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'line_user_id,branch_id' })

    } catch (err) {
      console.error('LINE chat error:', err)
      await lineReply(config.token, replyToken, [{
        type: 'text',
        text: 'ขออภัยครับ ระบบขัดข้องชั่วคราว กรุณาโทร 065-5268531 ครับ',
      }])
    }
  }

  return NextResponse.json({ ok: true })
}
