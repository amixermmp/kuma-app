-- ชื่อร้าน/ที่อยู่/เบอร์โทร ที่จะขึ้นในใบเสร็จ แยกต่อสาขา (ว่าง = ใช้ค่าจาก shop_settings กลางแทน)
ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS receipt_shop_name TEXT;
ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS receipt_address TEXT;
ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS receipt_phone TEXT;
