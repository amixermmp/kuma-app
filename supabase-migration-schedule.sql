-- ตารางเวรพนักงานพาร์ทไทม์ (ก้อน 1) — ตารางใหม่ทั้งหมด ไม่แตะตารางเดิม

-- 1) ตั้งค่ารายสาขา: สวิตช์เปิด/ปิด (ปิดไว้ก่อนทุกสาขา) + จำนวนคนต่อวัน
--    min = ขั้นต่ำ (ต่ำกว่านี้ = วันแดง "ขาดคน")  target = จำนวนที่อยากได้ (ต่ำกว่า = วันเหลือง)
CREATE TABLE IF NOT EXISTS schedule_settings (
  branch_id UUID PRIMARY KEY REFERENCES branches(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  weekday_min INTEGER NOT NULL DEFAULT 2,
  weekday_target INTEGER NOT NULL DEFAULT 2,
  weekend_min INTEGER NOT NULL DEFAULT 2,
  weekend_target INTEGER NOT NULL DEFAULT 3
);

-- 2) แบบแผนรายสัปดาห์ของแต่ละคน ต่อช่วงวัน (เทอม) — weekdays: 0=อาทิตย์ ... 6=เสาร์
CREATE TABLE IF NOT EXISTS schedule_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  weekdays INTEGER[] NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_schedule_patterns_branch ON schedule_patterns(branch_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_schedule_patterns_staff ON schedule_patterns(staff_id);

-- 3) กำหนดประเภทวันพิเศษ (เช่น วันหยุดนักขัตฤกษ์ให้นับเป็นวันหยุดสุดสัปดาห์ 3 คน)
CREATE TABLE IF NOT EXISTS schedule_day_overrides (
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  day_type TEXT NOT NULL CHECK (day_type IN ('weekday', 'weekend')),
  PRIMARY KEY (branch_id, day)
);

ALTER TABLE schedule_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_day_overrides ENABLE ROW LEVEL SECURITY;
