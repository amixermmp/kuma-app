-- =============================================
-- RENTAL PAYMENTS (สมุดรายรับเช่ารายวัน — คิดเงินตามวันที่เก็บจริง)
-- เงินเข้า 3 จังหวะ: เปิดสัญญา (rental) / ต่อเวลา (extend) / ค่าล่วงเวลาตอนคืน (overtime)
-- Dashboard + รีพอร์ต LINE นับรายได้จากตารางนี้ ไม่ใช่ rentals.total_amount
-- =============================================

CREATE TABLE rental_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rental_id UUID NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),
  staff_id UUID REFERENCES staff(id),
  kind TEXT NOT NULL CHECK (kind IN ('rental', 'extend', 'overtime')),
  amount NUMERIC(10,2) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rental_payments_paid_at ON rental_payments(paid_at);
CREATE INDEX idx_rental_payments_rental ON rental_payments(rental_id);

ALTER TABLE rental_payments ENABLE ROW LEVEL SECURITY;

-- Backfill: สัญญาเดิมลงเป็นรายการเดียว ณ วันส่งรถ
-- (เงินต่อเวลาในอดีตแยกไม่ได้ — รวมอยู่ใน total_amount ของวันเริ่มสัญญา
--  ตั้งแต่ migrate แล้ว การต่อเวลา/ค่าล่วงเวลาใหม่จะลงตามวันที่เก็บเงินจริง)
INSERT INTO rental_payments (rental_id, branch_id, staff_id, kind, amount, paid_at, created_at)
SELECT id, branch_id, staff_id, 'rental', COALESCE(total_amount, 0), start_datetime, created_at
FROM rentals;
