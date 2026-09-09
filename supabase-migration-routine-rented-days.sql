ALTER TABLE bike_routines ADD COLUMN IF NOT EXISTS interval_rented_days INTEGER;
ALTER TABLE bike_routines ADD COLUMN IF NOT EXISTS rented_days_accumulated INTEGER NOT NULL DEFAULT 0;

-- ขยายเพดานปฏิทินของงานที่มีอยู่แล้ว (interval_days เดิมทำหน้าที่นี้อยู่แล้ว แค่อัพค่า)
-- ไม่แตะ next_due_date ที่คำนวณไว้แล้ว — จะมีผลตอนบำรุงรอบถัดไปของแต่ละคันเท่านั้น
UPDATE bike_routines SET interval_days = 90 WHERE task_name = 'เปลี่ยนน้ำมันเครื่อง';
UPDATE bike_routines SET interval_days = 180 WHERE task_name = 'เปลี่ยนน้ำมันเฟืองท้าย';
