-- QR ไลน์ร้าน + LINE ID ต่อสาขา — โชว์ท้ายฟอร์มส่งรถ เตือนพนักงานให้ลูกค้าแอดไลน์
ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS line_qr_url TEXT;
ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS line_id TEXT;
