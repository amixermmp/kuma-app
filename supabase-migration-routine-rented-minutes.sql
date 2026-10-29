-- วันเช่าสะสมเปลี่ยนมานับจากเวลาที่รถอยู่กับลูกค้าจริง (24 ชม. = 1 วัน) แทนการบวก 1 ต่อวันที่มีสัญญาเปิดอยู่ตอน cron รัน
-- เก็บเศษที่ยังไม่ครบ 24 ชม. เป็นนาที (0-1439) ตัวเลขวันสะสมเดิมไม่ถูกแตะ
ALTER TABLE bike_routines ADD COLUMN IF NOT EXISTS rented_minutes_carry INTEGER NOT NULL DEFAULT 0;
