-- เปลี่ยนวิธีนับ "วันเช่าสะสม" จากบวกยกก้อนตอนคืนรถ/ปิดสัญญา (นับซ้ำวันก่อนเปลี่ยนน้ำมัน + ไม่นับตอนต่อสัญญาเรื่อยๆ)
-- เป็นนับทีละ 1 วันทุกวันที่รถออกไปใช้งานจริงแทน ผ่าน cron รายวัน
ALTER TABLE bike_routines ADD COLUMN IF NOT EXISTS rented_days_last_ticked_date DATE;

-- รีเซ็ตค่าสะสมเดิมที่คำนวณผิดมาตลอด ให้เริ่มนับใหม่ที่ 0 ด้วยวิธีที่ถูกต้องตั้งแต่วันนี้เป็นต้นไป
UPDATE bike_routines SET rented_days_accumulated = 0 WHERE interval_rented_days IS NOT NULL;
