-- =============================================
-- BOOKING REASSIGN NOTE (แจ้งพนักงานหน้าส่งรถว่าเปลี่ยนรุ่นจากที่ลูกค้าจองไว้)
-- ลูกค้าอาจถือใบจองเดิม (รุ่นเดิม) มา แต่ระบบเปลี่ยนรุ่นให้แล้วตอนแก้คิวมีปัญหา
-- เก็บรุ่นเดิม + เหตุผลไว้ โชว์เตือนพนักงานตอนส่งรถ กันงงหน้างาน
-- =============================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS original_requested_brand TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS original_requested_model TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reassign_reason TEXT;
