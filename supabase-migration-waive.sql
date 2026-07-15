-- =============================================
-- WAIVE (ยกเลิกรายการเงินที่บันทึกผิด — ขีดฆ่าไว้ ไม่ลบทิ้ง)
-- รายการที่ waive จะไม่ถูกนับใน Dashboard / รีพอร์ต LINE / ยอดค้างชำระ
-- =============================================

ALTER TABLE rental_payments  ADD COLUMN voided_at TIMESTAMPTZ, ADD COLUMN void_reason TEXT;
ALTER TABLE monthly_payments ADD COLUMN voided_at TIMESTAMPTZ, ADD COLUMN void_reason TEXT;
ALTER TABLE expenses         ADD COLUMN voided_at TIMESTAMPTZ, ADD COLUMN void_reason TEXT;
