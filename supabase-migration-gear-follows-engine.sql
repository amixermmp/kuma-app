-- น้ำมันเฟืองท้ายตามรอบน้ำมันเครื่อง (รอบที่ 1, 2, 3 = เครื่อง+เฟืองท้าย แล้ววนใหม่)
-- เฟืองท้ายของรถที่เปิดโหมดนี้ไม่นับ กม./วันเช่าสะสมของตัวเอง เหลือแค่เพดานปฏิทิน 365 วัน

-- 1) คอลัมน์ใหม่ที่แถว "เปลี่ยนน้ำมันเฟืองท้าย" ของแต่ละคัน
--    follows_engine = เปิดโหมดตามรอบน้ำมันเครื่องหรือยัง (ค่าเริ่ม = ปิด → ทำงานเหมือนเดิมทุกอย่าง)
--    engine_changes_since = นับว่าเปลี่ยนน้ำมันเครื่องมากี่ครั้งในรอบปัจจุบัน
ALTER TABLE bike_routines ADD COLUMN IF NOT EXISTS follows_engine BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE bike_routines ADD COLUMN IF NOT EXISTS engine_changes_since INTEGER NOT NULL DEFAULT 0;

-- 2) สำรองแถวเฟืองท้ายทั้งหมดไว้ก่อนมีการแก้ค่าใดๆ — ใช้ย้อนกลับ
CREATE TABLE IF NOT EXISTS bike_routines_gear_backup AS
  SELECT * FROM bike_routines WHERE task_name = 'เปลี่ยนน้ำมันเฟืองท้าย';

ALTER TABLE bike_routines_gear_backup ENABLE ROW LEVEL SECURITY;
