-- =============================================
-- STAFF CHECK-IN (ลงทะเบียนเข้างาน)
-- พนักงานถ่ายรูปคู่ป้ายร้านยืนยันตัวตน+เวลาเข้างาน — บังคับถ่ายสด ไม่ให้แนบไฟล์เก่า
-- เจ้าของดูรายงานได้ที่ /owner/attendance
-- =============================================

CREATE TABLE staff_checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  photo_url TEXT NOT NULL,
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_staff_checkins_staff_date ON staff_checkins(staff_id, checked_in_at);
CREATE INDEX idx_staff_checkins_branch_date ON staff_checkins(branch_id, checked_in_at);

ALTER TABLE staff_checkins ENABLE ROW LEVEL SECURITY;
