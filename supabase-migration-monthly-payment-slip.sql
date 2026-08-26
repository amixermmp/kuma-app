-- แนบรูปสลิป + ชื่อผู้โอนที่ OCR อ่านได้ ตอนเก็บเงินรายเดือนแต่ละงวด (เดิมมีแค่งวดแรกตอนสร้างสัญญา)
ALTER TABLE monthly_payments ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE monthly_payments ADD COLUMN IF NOT EXISTS slip_customer_name TEXT;
