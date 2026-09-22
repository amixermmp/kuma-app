-- ลบรถแล้วต้องไม่กระทบยอดรายได้ย้อนหลัง — เปลี่ยนจาก "ลบสัญญาเช่าทิ้งทั้งคู่กับใบเสร็จ" เป็น
-- "ตัดขาดอ้างอิงรถออกจากสัญญาเช่า แต่เก็บสัญญา+ใบเสร็จเดิมไว้ทั้งหมด" แทน
ALTER TABLE rentals ALTER COLUMN bike_id DROP NOT NULL;
ALTER TABLE monthly_rentals ALTER COLUMN bike_id DROP NOT NULL;

-- เก็บทะเบียน/ยี่ห้อ/รุ่นสำรองไว้ตอนตัดขาด เพื่อให้ใบเสร็จ/รายงานเก่ายังรู้ว่าเป็นรถคันไหน แม้รถจะถูกลบไปแล้ว
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS deleted_bike_info TEXT;
ALTER TABLE monthly_rentals ADD COLUMN IF NOT EXISTS deleted_bike_info TEXT;
