-- =============================================
-- MARKETING PHOTOS (รูปคู่รถ → ใส่กรอบ+ปิดหน้า พร้อมโพสรีวิว)
-- คัดลอกรูป with_bike จากทุกสัญญา (รายวัน+รายเดือน) มาเก็บแยกทันทีตอนสร้างสัญญา
-- กันโดนลบตอนคืนรถ (send_photos ถูกลบทิ้งอัตโนมัติ) — เก็บหมุนเวียนสูงสุด 50 รูปต่อสาขา
-- กรอบ/สติ๊กเกอร์ปิดหน้า ตั้งค่าแยกรายสาขาได้ที่ branch_settings
-- =============================================

ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS frame_url TEXT;
ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS sticker_url TEXT;

CREATE TABLE marketing_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  rental_id UUID NOT NULL,
  rental_type TEXT NOT NULL, -- 'daily' | 'monthly'
  original_photo_url TEXT NOT NULL,
  processed_photo_url TEXT,
  sticker_x REAL, -- ตำแหน่งสติ๊กเกอร์ปิดหน้า (0-1 สัดส่วนของรูป)
  sticker_y REAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_marketing_photos_branch ON marketing_photos(branch_id, created_at);

ALTER TABLE marketing_photos ENABLE ROW LEVEL SECURITY;
