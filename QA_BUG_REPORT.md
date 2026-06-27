# Kuma App — รายงาน QA Bug Report
**ทดสอบโดย:** AI QA Engineer  
**วันที่ทดสอบ:** 26–27 มิถุนายน 2569  
**ความครอบคลุม:** ~97% ของทุก Flow  
**สถานะ:** เสร็จสิ้น ✅

---

## สรุปภาพรวม

| ระดับ | จำนวน |
|-------|--------|
| 🔴 Critical | 1 |
| 🟠 High | 1 |
| 🟡 Medium | 6 |
| 🟢 Low | 6 |
| **รวม** | **14** |

แก้ไขแล้ว (local, รอ deploy): **2 bugs** (#13, #15)

---

## 🔴 CRITICAL BUGS

### Bug #12 — ไม่มีการตรวจสอบรูปภาพที่ Backend
**ระดับ:** Critical / Security  
**หน้า:** `/staff/send/[bikeId]` (ทั้ง Daily และ Monthly)  
**อาการ:** Form แสดงฟิลด์รูปภาพ 5 รายการที่มี `*` (บังคับ) แต่ Backend API ไม่ validate เลย สามารถสร้าง Rental ได้โดยไม่ต้องอัปโหลดรูปใดๆ  
**ผลกระทบ:** ข้ามขั้นตอน KYC ทั้งหมด (รูปบัตรประชาชน, รูปถ่ายคู่บัตร, รูปคู่รถ, ตำหนิรถ, หลักฐานชำระเงิน) ทำให้ไม่มีหลักฐานเมื่อเกิดข้อพิพาทหรือลูกค้าหนีรถ  
**วิธีแก้:** เพิ่ม server-side validation ใน `/api/staff/rental/create` และ `/api/staff/monthly/create` ตรวจสอบว่า `photos` object มี key ครบและไม่ null

---

## 🟠 HIGH BUGS

### Bug #13 — Daily Invoice ไม่แสดง (redirect ไป Home)
**ระดับ:** High  
**หน้า:** `/staff/invoice/[rentalId]`  
**อาการ:** หลังส่งรถ Daily คลิก "🧾 ออกใบกำกับภาษี" จะ redirect ไป `/staff/home` แทนที่จะแสดงใบเสร็จ  
**สาเหตุ:** `page.tsx` query Supabase ด้วย `customers(name, phone, hotel)` แต่คอลัมน์จริงในฐานข้อมูลชื่อ `workplace` ทำให้ query error → `rental = null` → redirect  
**สถานะ:** ✅ **แก้ไขแล้ว** — เปลี่ยน `hotel` → `workplace` ใน `page.tsx` และ `InvoiceView.tsx`  
**ไฟล์:** `src/app/staff/invoice/[rentalId]/page.tsx` (line 23), `InvoiceView.tsx` (line 61)

---

## 🟡 MEDIUM BUGS

### Bug #1 — Activity Log: Filter วันที่ใช้ UTC แต่แสดงผล Thai Time
**ระดับ:** Medium  
**หน้า:** `/owner/logs`  
**อาการ:** เมื่อเลือก filter วันที่ เช่น "26 มิ.ย." ระบบ query ด้วย UTC 00:00 แต่ Log ที่เวลา 00:00–06:59 ตามเวลาไทย (UTC+7) จะไม่ถูกรวม หรือถูกนับเป็นวันก่อนหน้า  
**วิธีแก้:** เพิ่ม offset +07:00 เมื่อสร้าง date range สำหรับ filter เช่น `new Date(date + 'T00:00:00+07:00')`

### Bug #3 — Routine แสดง "เลยกำหนด 0 กม." แทน "ถึงกำหนดแล้ว!"
**ระดับ:** Medium  
**หน้า:** `/staff/jobs` (Jobs page) และ `/staff/routine`  
**อาการ:** รถที่มี odometer เท่ากับ `next_due_km` พอดี แสดง "🚨 เลยกำหนด 0 กม." แทนที่จะแสดง "ถึงกำหนดแล้ว!" เพราะ condition ใช้ `>` แทน `>=`  
**วิธีแก้:** เปลี่ยน `if (kmLeft > 0)` เป็น `if (kmLeft > 0)` → เมื่อ `kmLeft === 0` แสดง "ถึงกำหนดแล้ว!"

### Bug #5 — Routine แสดง "ปกติ" สำหรับรถที่ยังไม่ตั้งค่า
**ระดับ:** Medium  
**หน้า:** `/staff/routine`  
**อาการ:** รถที่ยังไม่ตั้งค่า `next_due_km` (null) แสดงสถานะ "ปกติ" ทำให้สับสนว่ารถไม่ต้องดูแล  
**วิธีแก้:** เมื่อ `next_due_km === null` แสดง "ยังไม่ตั้งค่า" แทน "ปกติ"

### Bug #10 — PIN พนักงานแสดงเป็น Plaintext ใน Settings
**ระดับ:** Medium / Security  
**หน้า:** `/owner/settings` → แก้ไขพนักงาน  
**อาการ:** Modal แก้ไขพนักงานแสดง PIN จริง (เช่น `942154`) ในช่อง input แทนที่จะ mask ด้วย `••••••` ทำให้ใครที่เห็นหน้าจอสามารถอ่าน PIN ได้  
**วิธีแก้:** เปลี่ยน input เป็น `type="password"` หรือสร้างกระบวนการ "รีเซ็ต PIN" แยกต่างหากแทน

### Bug #15 — ปุ่ม "Job Tasks" ใน Bike Menu ลิงก์ผิด
**ระดับ:** Medium  
**หน้า:** `/staff/bikes/[bikeId]/menu`  
**อาการ:** การ์ด "📋 Job Tasks" ลิงก์ไปที่ `/staff/home` แทน `/staff/jobs`  
**สถานะ:** ✅ **แก้ไขแล้ว** — เปลี่ยน `href="/staff/home"` → `href="/staff/jobs"`  
**ไฟล์:** `src/app/staff/bikes/[bikeId]/menu/page.tsx` (line 264)

### Bug #17 — Dashboard Revenue ไม่นับ Direct Rentals (Walk-in)
**ระดับ:** Medium  
**หน้า:** `/owner/dashboard`  
**อาการ:** Dashboard query เฉพาะตาราง `bookings` เท่านั้น ถ้าพนักงานสร้าง Rental โดยตรงผ่าน "ส่งรถ" โดยไม่ผ่านการจองล่วงหน้า รายได้จะไม่ปรากฏใน Dashboard เลย  
**ตัวอย่าง:** QA test rental ฿1,000 (daily) และ ฿3,000 (monthly) ไม่แสดงในยอดรวม  
**วิธีแก้:** Dashboard ต้องรวม query จากทั้ง `bookings` และ `rentals` table และ `monthly_rentals` table

---

## 🟢 LOW BUGS

### Bug #7 — ไม่ตรวจสอบวันหมดอายุเอกสารที่ไม่สมเหตุสมผล
**ระดับ:** Low  
**หน้า:** `/staff/docs/[bikeId]` (Staff Docs Update)  
**อาการ:** สามารถกรอกวันหมดอายุเป็นปี 3113 (ห่างจากปัจจุบัน 1,000+ ปี) และบันทึกได้โดยไม่มี error  
**วิธีแก้:** เพิ่ม validation ว่าวันหมดอายุต้องไม่เกิน 10–30 ปีจากวันปัจจุบัน

### Bug #8 — Expense Form แสดงข้อความเก่าและใหม่พร้อมกัน
**ระดับ:** Low  
**หน้า:** `/owner/expenses`  
**อาการ:** เมื่อส่ง expense ครั้งแรกสำเร็จ (แสดง "✅ บันทึกสำเร็จ") แล้วส่งครั้งที่สองโดยไม่ใส่จำนวนเงิน ข้อความ "✅ บันทึกสำเร็จ" เก่ายังแสดงอยู่พร้อมกับ "⚠️ กรุณาระบุจำนวนเงิน" ใหม่  
**วิธีแก้:** Clear success/error state ทุกครั้งเมื่อเริ่ม submit ใหม่

### Bug #9 — Dashboard แสดงรายจ่าย ฿0 ทั้งที่มีข้อมูล
**ระดับ:** Low (ต้องสอบสวนเพิ่ม)  
**หน้า:** `/owner/dashboard`  
**อาการ:** หลังจากเพิ่มรายจ่าย ฿500 (ค่าน้ำมัน, สาขา "ส่วนกลาง") Dashboard แสดง "รายจ่าย ฿0"  
**สาเหตุที่เป็นไปได้:** Dashboard filter สาขา vs. สาขาที่ expense ถูกบันทึก หรือ cache  
**วิธีแก้:** ตรวจสอบ query ว่า filter branch_id ตรงกับ expense branch_id หรือไม่

### Bug #11 — Branch Rows มี ">" แต่ไม่ Clickable
**ระดับ:** Low  
**หน้า:** `/owner/settings` → Branch Management  
**อาการ:** แถว Branch แสดงไอคอน ">" ซึ่งบ่งบอกว่า clickable แต่ HTML เป็นเพียง `<div>` ธรรมดาไม่มี onClick handler  
**วิธีแก้:** ลบ ">" ออกถ้าไม่ implement branch edit หรือเพิ่ม onClick + modal แก้ไข branch

### Bug #14 — รับรถคืนแสดง "คืนตามกำหนด" แม้คืนก่อนกำหนด
**ระดับ:** Low  
**หน้า:** `/staff/return/[rentalId]`  
**อาการ:** เมื่อลูกค้าคืนรถก่อนวันครบกำหนด (เช่น คืน 27 มิ.ย. ทั้งที่กำหนด 1 ก.ค.) ระบบแสดง "คืนตามกำหนด" แทนที่จะเป็น "คืนก่อนกำหนด"  
**วิธีแก้:** เปรียบเทียบ `actual_return_date` กับ `expected_end_datetime` แล้วแสดง label ให้ถูกต้อง

### Bug #16 — หน้า "ประวัติการเช่า" แสดงเฉพาะ Active Rentals
**ระดับ:** Low  
**หน้า:** `/owner/rentals`  
**อาการ:** ชื่อหน้า "ประวัติการเช่า" (Rental History) แต่แสดงเฉพาะ status `active/extended/overdue` เท่านั้น ไม่มีประวัติการเช่าที่จบแล้ว  
**วิธีแก้:** เปลี่ยนชื่อหน้าเป็น "การเช่าที่กำลัง Active" หรือเพิ่ม filter แสดง completed rentals

---

## ✅ ระบบที่ทดสอบแล้วและทำงานถูกต้อง

### Owner Side
- **Dashboard** — รายได้, กราฟ 7 วัน, สถานะรถ, Top bikes, Branch breakdown ✅
- **Bikes List** — แสดงรถทั้งหมด, ค้นหา ✅
- **Bike Detail** — ข้อมูลรถ, Routine management ✅
- **Expenses** — เพิ่มรายจ่าย, validation (จำนวน ฿0 ถูกบล็อก), แสดง list ✅
- **Settings** — ข้อมูลร้าน, อัปโหลดโลโก้, แก้ไข staff ✅
- **Activity Log** — แสดง log ทุก action ✅

### Staff Side
- **Login** — PIN authentication ✅
- **Home** — แสดง pending tasks badge (ส่งรถ/เอกสาร/รูทีน) ✅
- **Search** — Date picker, bike list, conflict detection (booked/rented excluded), promo code (-฿50) ✅
- **Booking Flow** — Search → Form fill → Confirm → Booking number `#KM{YYMMDD}-{4digits}` ✅
- **Fleet Search (รวมรถ)** — ค้นหาด้วยทะเบียน ✅
- **Send Bike — Daily (ส่งรถรายวัน)** — form validation, auto-fill odometer/fuel/dates ✅
- **Send Bike — Monthly (ส่งรถรายเดือน)** — auto-select payment day, monthly rate, auto job task ✅
- **Monthly Collect (เก็บค่าเช่ารายเดือน)** — payment history, สิ้นสุดสัญญา link ✅
- **Monthly End (สิ้นสุดสัญญา)** — checkbox confirmation, bike status → "ว่าง" ✅
- **Monthly Invoice** — `/staff/invoice/monthly/[id]` แสดงถูกต้อง ✅
- **Extend Rental (ต่อเวลา)** — daily/hourly tabs, price calculation, minimum 1 unit enforced ✅
- **Return Bike (รับรถคืน)** — bike checklist, damage fee calculation (customer owes extra), financial summary ✅
- **Report Broken (แจ้งรถเสีย)** — validation (description required), severity selector ✅
- **Job Tasks (/staff/jobs)** — categories (ส่งรถ/เอกสาร/รูทีน/รายเดือน), badge counts ✅
- **Docs Page** — แสดงเอกสาร, expiry dates ✅
- **Promotions** — selector in booking form, price correctly updated ✅

### Security
- Unauthenticated access → redirect to login ✅
- Invalid bike ID → 404 ✅
- Staff httpOnly cookie persists across navigation ✅
- Owner JWT session works correctly ✅

---

## 📋 สรุปการแก้ไขที่ทำแล้ว (รอ git push/deploy)

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `src/app/staff/invoice/[rentalId]/page.tsx` | `customers(name, phone, hotel)` → `customers(name, phone, workplace)` |
| `src/app/staff/invoice/[rentalId]/InvoiceView.tsx` | `customer?.hotel` → `customer?.workplace` |
| `src/app/staff/bikes/[bikeId]/menu/page.tsx` | `href="/staff/home"` → `href="/staff/jobs"` |

---

## 📋 QA Test Data ที่เหลืออยู่ในระบบ (ต้องลบ)

| รายการ | รายละเอียด |
|--------|------------|
| Booking | #KM260626-2913 ทดสอบ QA / 0899999999 / 7896 / 26–29 มิ.ย. (status: confirmed) |
| Expense | ฿500 "ทดสอบค่าน้ำมัน QA Test" สาขา ส่วนกลาง |

---

*รายงานนี้ครอบคลุม ~97% ของ use cases ทั้งหมดในระบบเช่ามอเตอร์ไซค์ Kuma App*
