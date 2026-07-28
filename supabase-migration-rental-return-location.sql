-- =============================================
-- RENTALS RETURN LOCATION (รายวันเท่านั้น)
-- ให้พนักงานระบุได้ตอนส่งรถว่าลูกค้าจะคืนที่ร้านหรือที่อื่น (เผื่อรับคืนนอกสถานที่)
-- แสดงในหน้ารับคืนรถให้พนักงานกะอื่นรู้ว่าต้องไปรับที่ไหน
-- =============================================

ALTER TABLE rentals ADD COLUMN IF NOT EXISTS return_type TEXT;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS return_address TEXT;
