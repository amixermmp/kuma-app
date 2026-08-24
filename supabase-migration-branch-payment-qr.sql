-- รูป QR รับเงินต่อสาขา แยกรายวัน/รายเดือน — โชว์ในสัญญาเช่าที่แชร์ให้ลูกค้า
ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS payment_qr_daily_url TEXT;
ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS payment_qr_monthly_url TEXT;
