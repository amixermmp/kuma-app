-- แนบรูปสลิป + ชื่อผู้โอนที่ OCR อ่านได้ ตอนต่อเวลา (rental_payments kind='extend')
ALTER TABLE rental_payments ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE rental_payments ADD COLUMN IF NOT EXISTS slip_customer_name TEXT;
