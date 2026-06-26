# Kuma App — Session Notes
อัปเดต: 2026-06-26

---

## ✅ งานที่ทำวันนี้

### 1. สิ้นสุดสัญญารายเดือน (Monthly End Contract)
Entry point: **Bike Menu page** (ข้อ 1) — เมื่อรถมีสัญญารายเดือนอยู่จะแสดงปุ่ม 2 ปุ่มทันที

**ไฟล์ที่แก้/สร้าง:**
- `src/app/staff/bikes/[bikeId]/menu/page.tsx` — query `monthly_rentals`, แสดงปุ่ม "เก็บค่าเช่ารายเดือน" + "สิ้นสุดสัญญา"
- `src/app/staff/monthly/end/[id]/page.tsx` — server component
- `src/app/staff/monthly/end/[id]/MonthlyEndClient.tsx` — ฟอร์ม (เลขไมล์, หมายเหตุ, รูปถ่าย, checkbox ยืนยัน)
- `src/app/api/staff/monthly/end/route.ts` — POST: set `monthly_rentals.status='ended'`, `bikes.status='available'`, update `end_date` + `notes`

**Logic:**
- เมื่อ bike menu โหลด จะ query `monthly_rentals` ควบคู่ไปด้วย
- ถ้ามี `activeMonthly` → `isMonthlyRented = true` → แสดงปุ่ม monthly
- `isRented` (daily) จะไม่ซ้อนกับ monthly (`&& !monthlyRentalId`)
- API ใช้ column ที่มีอยู่ใน schema: `end_date`, `return_photos`, `notes`

### 2. หน้า /owner/expenses (บันทึกรายจ่าย)
พบว่าสร้างไว้ครบแล้วจาก session ก่อน:
- `src/app/owner/expenses/page.tsx`
- `src/app/owner/expenses/ExpenseForm.tsx`
- `src/app/api/owner/expenses/create/route.ts`
- `src/app/api/owner/expenses/route.ts` (สร้างเพิ่มวันนี้)
- Link จาก dashboard ก็มีแล้ว `/owner/expenses`

---

## 🗒️ โน้ตสำคัญ

### ลายเซ็นลูกค้า — คุยพรุ่งนี้
- ปัจจุบัน: SignaturePad (canvas) ทำงานอยู่แล้ว บันทึกเป็น base64 ลงใน `customer_signature` column ของ `rentals` และ `monthly_rentals`
- พรุ่งนี้จะคุยเรื่อง: (รอ user อธิบาย — อาจเป็นเรื่องแสดงลายเซ็นในใบสัญญา / PDF / หน้า invoice)

---

## 🏗️ สถานะรวม

### Staff Flow ✅ ครบ
- Login PIN
- Home (job tasks)
- Bike Menu → ส่งรถ (รายวัน/รายเดือน)
- รับรถคืน (รายวัน)
- ต่อเวลา
- เก็บค่าเช่ารายเดือน
- **สิ้นสุดสัญญารายเดือน** ← ใหม่วันนี้
- แจ้งรถเสีย
- ค้นหา & จอง

### Owner Flow ✅ ครบ
- Login
- Dashboard (สรุปรายได้/รถ/tasks)
- สต็อครถทั้งหมด + รายละเอียดรถ (edit/โอนย้าย/deactivate)
- Settings (ข้อมูลร้าน, เอกสารร้าน)
- Promotions
- **รายจ่าย** ← confirm ว่ามีอยู่แล้ว

### Public
- `/bike/[bikeId]` — QR page (ข้อมูลรถ, เอกสาร, สัญญา)

---

## ⏳ เหลือ (ถ้าต้องการ)
- Invoice / ใบเสร็จ — mockup อยู่ที่ `/mockup/invoice.html`
- รายงาน/สรุปรายได้เจ้าของ (ถ้าต้องการเพิ่ม)

---

## 🔧 Tech Notes
- Deploy: `npx vercel --prod` (PowerShell แยก line, ไม่ใช้ `&&`)
- Auth staff: httpOnly cookie `kuma_staff_id`
- Auth owner: Supabase JWT session
- Admin client: `createAdminClient()` จาก `@/lib/supabase/admin`
- BRANCH_ID: `'00000000-0000-0000-0000-000000000001'`
- **ห้าม commit `.env.local` หรือ `SUPABASE_SERVICE_ROLE_KEY`**
