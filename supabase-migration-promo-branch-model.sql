-- =============================================
-- PROMO: เลือกได้หลายสาขา + เลือกรถร่วมโปรแบบแบ่งตามรุ่นย่อย
-- branch_ids ว่าง/NULL = ใช้ได้ทุกสาขา (ของเดิมก่อนมี feature นี้)
-- eligible_models ว่าง/NULL = ร่วมทุกรุ่น เก็บเป็นรุ่น ไม่ใช่รายคัน
--   เพื่อให้รถคันใหม่ของรุ่นเดียวกันร่วมโปรอัตโนมัติโดยไม่ต้องมาติ๊กเพิ่ม
-- =============================================

ALTER TABLE promotions ADD COLUMN IF NOT EXISTS branch_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS eligible_models JSONB;
