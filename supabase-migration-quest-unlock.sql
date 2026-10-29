-- ปลดล็อกนัดไกลกว่าลิมิต: พนักงานโทรถามพี่เจ้าของร้านก่อน แล้วติ๊กยืนยัน + กรอกเหตุผล
-- เก็บไว้ที่แถวติดตาม เจ้าของดูได้ที่หน้าสรุปเควส (ไม่ต้องกดอนุมัติ)
ALTER TABLE quest_followups
  ADD COLUMN IF NOT EXISTS owner_approved BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS approval_reason TEXT;
