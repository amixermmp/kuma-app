-- ราคารถเป็นค่าว่างได้ — ว่าง = ไม่ override ให้อิงราคามาตรฐานสาขา+รุ่นจาก branch_model_pricing แบบ real-time
ALTER TABLE bikes ALTER COLUMN daily_rate DROP NOT NULL;
ALTER TABLE bikes ALTER COLUMN daily_rate DROP DEFAULT;
ALTER TABLE bikes ALTER COLUMN monthly_rate DROP DEFAULT;
