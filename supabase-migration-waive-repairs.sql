-- waive ค่าซ่อมได้จากหน้า Statement (เหมือน รายรับ/รายจ่าย)
ALTER TABLE repairs ADD COLUMN voided_at TIMESTAMPTZ, ADD COLUMN void_reason TEXT;
