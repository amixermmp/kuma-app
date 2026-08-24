-- ราคาแนะนำ (รายวัน/รายเดือน/โปรจ่ายกี่วัน) แยกตาม (สาขา x รุ่นรถ)
-- ตั้งไว้ล่วงหน้าได้แม้สาขานั้นยังไม่มีรถรุ่นนั้นจริง — ใช้ auto-fill ตอนย้ายรถไปสาขาใหม่
-- ค่าใดๆ เป็น NULL แปลว่า "ยังไม่ได้ตั้ง" ให้ fallback ไปราคาเดิมของรถ / ค่า promo global เดิม
CREATE TABLE IF NOT EXISTS branch_model_pricing (
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  daily_rate NUMERIC(10,2),
  monthly_rate NUMERIC(10,2),
  promo_pay_days INT,
  PRIMARY KEY (branch_id, brand, model)
);
