-- =============================================
-- FAST LANE (จองล่วงหน้าดีลใหญ่ทับคิวเดิมได้ โดยไม่ยกเลิกคิวเดิม)
-- ใช้แท็กว่าจอง/สัญญานี้ถูกสร้างโดยรู้ตัวว่าจะชนคิวอื่น เพื่อโชว์ badge ในคิวมีปัญหา
-- แยกจาก conflict ที่เกิดจากบั๊ก/อุบัติเหตุ ให้ staff เข้าใจบริบททันที
-- =============================================

-- bookings.fast_lane: จองใหม่ (advance booking) ที่ตั้งใจจองซ้อนทับคิวเดิม
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fast_lane BOOLEAN DEFAULT FALSE;

-- rentals.fast_lane / monthly_rentals.fast_lane: สัญญาที่ตั้งใจทำทับคิวจองเดิม
-- (ฝั่งที่ "ชนะ" ในกรณีส่งรถ/ต่อเวลา/รายเดือน ไม่ใช่ bookings เพราะ bookings ฝั่งนั้นยังคง confirmed อยู่เหมือนเดิม)
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS fast_lane BOOLEAN DEFAULT FALSE;
ALTER TABLE monthly_rentals ADD COLUMN IF NOT EXISTS fast_lane BOOLEAN DEFAULT FALSE;
