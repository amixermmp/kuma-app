-- ปิดร้าน (close shop) — คู่ตรงข้ามของ staff_checkins

ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS close_time_earliest TEXT; -- '18:45', NULL = ยังไม่ตั้ง

CREATE TABLE IF NOT EXISTS staff_closeshops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  selfie_photo_url TEXT NOT NULL,
  plate_photos JSONB NOT NULL DEFAULT '[]',
  expected_plates TEXT[] NOT NULL DEFAULT '{}',
  found_plates TEXT[] NOT NULL DEFAULT '{}',
  missing_plates TEXT[] NOT NULL DEFAULT '{}',
  explanation TEXT,
  closed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_closeshops_staff_date ON staff_closeshops(staff_id, closed_at);
CREATE INDEX IF NOT EXISTS idx_staff_closeshops_branch_date ON staff_closeshops(branch_id, closed_at);

ALTER TABLE staff_closeshops ENABLE ROW LEVEL SECURITY;
