-- =============================================
-- BLACKLIST (บัญชีดำของร้าน — มิจฉาชีพ/ขโมยรถ จากเครือข่ายร้านเช่า)
-- owner เป็นคนกรอกรายชื่อเอง ระบบเช็คตอน OCR บัตร/กรอกเบอร์ และกันตอนกดส่งรถ
-- =============================================

CREATE TABLE blacklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;
