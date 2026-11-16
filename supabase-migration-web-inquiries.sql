-- เว็บหน้าร้าน (เช่น zamebikerental.com): โซนค่าส่ง / การตั้งค่ารุ่นที่โชว์บนเว็บ / คำขอจองจากเว็บ
-- ทุกตารางเข้าถึงผ่านเซิร์ฟเวอร์ (service role) เท่านั้น — เปิด RLS ไว้โดยไม่มี policy

-- 1) โซนค่าส่งต่อสาขา (เจ้าของตั้งในหลังบ้าน)
--    short_fee = ค่าส่ง/รับต่อเที่ยว สำหรับเช่ารายวัน/สัปดาห์ (NULL = โซนนี้ไม่ให้บริการแบบสั้น)
--    long_fee  = ค่าส่ง/รับต่อเที่ยว สำหรับเช่ารายเดือน (NULL = ยังไม่ตั้ง เว็บจะบอกให้สอบถาม)
CREATE TABLE IF NOT EXISTS delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name_th TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ja TEXT,
  name_zh TEXT,
  short_fee NUMERIC(10,2),
  long_fee NUMERIC(10,2),
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_branch ON delivery_zones(branch_id);
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

-- 2) รุ่นรถที่โชว์บนเว็บ ต่อสาขา — ไม่มีแถว = โชว์ (ถ้าสาขามีรถรุ่นนั้นจริง) ใช้รูปจากรถคันที่มีรูป
CREATE TABLE IF NOT EXISTS web_model_settings (
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT true,
  photo_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (branch_id, brand, model)
);
ALTER TABLE web_model_settings ENABLE ROW LEVEL SECURITY;

-- 3) คำขอจองจากเว็บ (ไม่ใช่ใบจอง — ไม่กันรถ ไม่กระทบคิว)
--    status: clicked=กดปุ่มจองบนเว็บ / chatted=ทักมาจริง / confirmed=ยืนยันแล้ว / unavailable=ไม่ว่าง /
--            moved_branch=โยกไปสาขาอื่น / silent=ลูกค้าเงียบ / cancelled=ยกเลิก
CREATE TABLE IF NOT EXISTS web_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  branch_id UUID NOT NULL REFERENCES branches(id),
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INT NOT NULL,
  pickup_time TEXT,
  send_type TEXT NOT NULL DEFAULT 'shop' CHECK (send_type IN ('shop', 'delivery')),
  send_zone_name TEXT,
  return_type TEXT NOT NULL DEFAULT 'shop' CHECK (return_type IN ('shop', 'delivery')),
  return_zone_name TEXT,
  est_rent NUMERIC(10,2),
  est_delivery_fee NUMERIC(10,2),
  delivery_fee_unknown BOOLEAN NOT NULL DEFAULT false,
  est_total NUMERIC(10,2),
  deposit NUMERIC(10,2),
  lang TEXT,
  status TEXT NOT NULL DEFAULT 'clicked'
    CHECK (status IN ('clicked', 'chatted', 'confirmed', 'unavailable', 'moved_branch', 'silent', 'cancelled')),
  staff_note TEXT,
  handled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_web_inquiries_branch_created ON web_inquiries(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_inquiries_status ON web_inquiries(status);
ALTER TABLE web_inquiries ENABLE ROW LEVEL SECURITY;
